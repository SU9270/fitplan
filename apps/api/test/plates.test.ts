import { env } from 'cloudflare:workers';
import { CONSENT_VERSION } from '@fitplan/validators';
import { describe, expect, it } from 'vitest';
import { authed, seedUsdaFood, signedInUser, unique } from './helpers';

// Mirrors the `base` fixture in packages/core: daily target 2056 kcal / 140 P / 248 C / 56 F.
const profile = {
  age: 20,
  sex: 'male',
  heightCm: 175,
  weightKg: 70,
  activityLevel: 3,
  trainingDaysPerWeek: 3,
  trainingExperience: 'beginner',
  goal: 'lose',
  pace: 'standard',
  healthFlags: { pregnantOrNursing: false, eatingDisorderHistory: false, medicalDiet: false },
  unitSystem: 'metric',
  locale: 'zh',
} as const;

const VEG = 'Vegetables and Vegetable Products';
const today = () => new Date().toISOString().slice(0, 10);

interface Gap {
  status: 'short' | 'met' | 'over';
  diff: number;
}
interface Suggestion {
  kind: 'add' | 'adjust';
  reason: string;
  foodId?: string;
  entryId?: string;
  portionId: string | null;
  portionLabel: string | null;
  quantity: number;
  name: string;
  nameZh: string | null;
}
interface MealView {
  meal: string;
  totals: { kcal: number; proteinG: number };
}
interface Feedback {
  gap: Record<'kcal' | 'proteinG' | 'carbsG' | 'fatG', Gap>;
  hasVegetables: boolean;
  meal: string;
  suggestions: Suggestion[];
}
interface Day {
  entries: { id: string; slot: string; meal: string }[];
  target: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  meals: MealView[];
  feedback: Feedback | null;
}

async function userWithGoal() {
  const user = await signedInUser();
  await authed(user.cookie, 'POST', '/api/me/consents', { kind: 'health_data', version: CONSENT_VERSION, granted: true });
  expect((await authed(user.cookie, 'PUT', '/api/me/profile', profile)).status).toBe(200);
  return user;
}

/** `meal`: the meal the suggestions go to (the app sends the meal of the current time). */
async function day(cookie: string, meal?: string): Promise<Day> {
  const res = await authed(cookie, 'GET', `/api/diary?date=${today()}${meal ? `&meal=${meal}` : ''}`);
  expect(res.status).toBe(200);
  return (await res.json()) as Day;
}

const meal = (d: Day, name: string) => d.meals.find((m) => m.meal === name) as MealView;
const feedback = (d: Day) => d.feedback as Feedback;

async function log(cookie: string, body: Record<string, unknown>) {
  const res = await authed(cookie, 'POST', '/api/diary/entries', { date: today(), meal: 'lunch', portionId: null, quantity: 100, ...body });
  expect(res.status).toBe(201);
  return ((await res.json()) as { entry: { id: string; slot: string } }).entry;
}

describe('plates', () => {
  it('gives every entry a plate cell from its category snapshot and macros', async () => {
    const { cookie } = await userWithGoal();
    const broccoli = await seedUsdaFood({ name: `Broccoli ${unique('b')}`, category: VEG, kcal: 34, proteinG: 2.82, carbsG: 6.64, fatG: 0.37 });
    const egg = await seedUsdaFood({ name: `Egg ${unique('e')}`, category: 'Dairy and Egg Products', kcal: 143, proteinG: 12.56, carbsG: 0.72, fatG: 9.51 });
    const rice = await seedUsdaFood({ name: `Rice ${unique('r')}`, kcal: 130, proteinG: 2.69, carbsG: 28.17, fatG: 0.28 });

    expect((await log(cookie, { foodId: broccoli.id })).slot).toBe('vegetable');
    expect((await log(cookie, { foodId: egg.id })).slot).toBe('protein');
    expect((await log(cookie, { foodId: rice.id })).slot).toBe('staple');

    // The cell comes from the snapshot: re-categorizing the food later does not move the entry.
    await env.DB.prepare('UPDATE foods SET category = ? WHERE id = ?').bind('Fruits and Fruit Juices', broccoli.id).run();
    expect((await day(cookie)).entries.map((e) => e.slot)).toEqual(['vegetable', 'protein', 'staple']);
    const detail = (await (await authed(cookie, 'GET', `/api/foods/${broccoli.id}`)).json()) as { food: { slot: string } };
    expect(detail.food.slot).toBe('other');
  });

  it('gives feedback for the whole day, and only once dinner has an entry', async () => {
    const { cookie } = await userWithGoal();
    const rice = await seedUsdaFood({ name: `Rice ${unique('r')}`, kcal: 130, proteinG: 2.69, carbsG: 28.17, fatG: 0.28 });
    const egg = await seedUsdaFood({ name: `Egg ${unique('e')}`, category: 'Dairy and Egg Products', kcal: 143, proteinG: 12.56, carbsG: 0.72, fatG: 9.51 });
    await log(cookie, { foodId: rice.id, meal: 'lunch', quantity: 300 });

    const before = await day(cookie);
    expect(before.meals).toEqual([
      { meal: 'breakfast', totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } },
      { meal: 'lunch', totals: { kcal: 390, proteinG: 8, carbsG: 85, fatG: 1 } },
      { meal: 'dinner', totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } },
      { meal: 'snack', totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } },
    ]);
    expect(before.feedback).toBeNull();

    await log(cookie, { foodId: egg.id, meal: 'dinner', quantity: 100 });
    const after = await day(cookie);
    // 300 g rice + 100 g egg: 533 kcal, 21 g protein, 85 g carbs, 10 g fat, against 2056 / 140 / 248 / 56.
    expect(feedback(after)).toMatchObject({
      gap: {
        kcal: { status: 'short', diff: 533 - 2056 },
        proteinG: { status: 'short', diff: 21 - 140 },
        carbsG: { status: 'short', diff: 85 - 248 },
        fatG: { status: 'short', diff: 10 - 56 },
      },
      hasVegetables: false,
      meal: 'dinner',
    });
  });

  it('has no target, feedback or suggestions without a goal', async () => {
    const user = await signedInUser();
    await authed(user.cookie, 'POST', '/api/me/consents', { kind: 'health_data', version: CONSENT_VERSION, granted: true });
    const rice = await seedUsdaFood({ name: `Rice ${unique('r')}` });
    await log(user.cookie, { foodId: rice.id, meal: 'dinner' });
    expect(await day(user.cookie)).toMatchObject({ target: null, feedback: null });
  });

  it('suggests only curated candidates, with names and the curated portion, and applying one closes the gap', async () => {
    const { cookie } = await userWithGoal();
    const t = unique('cand');
    const yogurt = await seedUsdaFood({
      name: `Yogurt ${t}`,
      nameZh: `酸奶${t}`,
      category: 'Dairy and Egg Products',
      kcal: 59,
      proteinG: 10.19,
      carbsG: 3.6,
      fatG: 0.39,
      portions: [
        { label: '1 cup', grams: 245 },
        { label: '1 container', grams: 170 },
      ],
      suggestPortion: 1,
    });
    const broccoli = await seedUsdaFood({
      name: `Broccoli ${t}`,
      category: VEG,
      kcal: 35,
      proteinG: 2.38,
      carbsG: 7.18,
      fatG: 0.41,
      portions: [{ label: '0.5 cup, chopped', grams: 78 }],
      suggestPortion: 0,
    });
    // Not curated: never suggested even though it would fit.
    await seedUsdaFood({ name: `Chicken ${t}`, kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, portions: [{ label: '3 oz', grams: 85 }] });
    const rice = await seedUsdaFood({ name: `Rice ${t}`, kcal: 130, proteinG: 2.69, carbsG: 28.17, fatG: 0.28 });
    await log(cookie, { foodId: rice.id, meal: 'dinner', quantity: 250 });

    const before = feedback(await day(cookie));
    const curated = await env.DB.prepare('SELECT id FROM foods WHERE suggest_portion_id IS NOT NULL').all<{ id: string }>();
    const curatedIds = new Set(curated.results.map((r) => r.id));
    expect(before.suggestions.length).toBeGreaterThan(0);
    expect(before.suggestions.length).toBeLessThanOrEqual(3);
    for (const s of before.suggestions) {
      expect(s.kind).toBe('add');
      expect(curatedIds.has(s.foodId ?? '')).toBe(true);
      expect(s.portionLabel).not.toBeNull();
    }
    expect(before.suggestions[0]).toMatchObject({ reason: 'protein' });
    const veg = before.suggestions.find((s) => s.reason === 'vegetable');
    expect(veg).toMatchObject({ foodId: broccoli.id, portionLabel: '0.5 cup, chopped', quantity: 1 });

    // The yogurt is the only curated protein food (test storage is isolated per test).
    const protein = before.suggestions[0] as Suggestion;
    expect(protein).toMatchObject({ foodId: yogurt.id, portionLabel: '1 container', nameZh: `酸奶${t}` });
    expect(curatedIds).toEqual(new Set([yogurt.id, broccoli.id]));
    await log(cookie, { meal: before.meal, foodId: protein.foodId, portionId: protein.portionId, quantity: protein.quantity });
    const after = feedback(await day(cookie));
    expect(after.gap.proteinG.diff).toBeGreaterThan(before.gap.proteinG.diff);
  });

  it('makes the suggestions for the meal the app asks for: a snack gets no vegetables', async () => {
    const { cookie } = await userWithGoal();
    const t = unique('snack');
    await seedUsdaFood({
      name: `Yogurt ${t}`,
      category: 'Dairy and Egg Products',
      kcal: 59,
      proteinG: 10.19,
      carbsG: 3.6,
      fatG: 0.39,
      portions: [{ label: '1 container', grams: 170 }],
      suggestPortion: 0,
    });
    await seedUsdaFood({ name: `Broccoli ${t}`, category: VEG, kcal: 35, proteinG: 2.38, carbsG: 7.18, fatG: 0.41, portions: [{ label: '0.5 cup', grams: 78 }], suggestPortion: 0 });
    const rice = await seedUsdaFood({ name: `Rice ${t}`, kcal: 130, proteinG: 2.69, carbsG: 28.17, fatG: 0.28 });
    await log(cookie, { foodId: rice.id, meal: 'dinner', quantity: 250 });

    expect(feedback(await day(cookie)).suggestions.map((s) => s.reason)).toEqual(['protein', 'vegetable']);
    const late = feedback(await day(cookie, 'snack'));
    expect(late.meal).toBe('snack');
    expect(late.suggestions.map((s) => s.reason)).toEqual(['protein']);

    expect((await authed(cookie, 'GET', `/api/diary?date=${today()}&meal=brunch`)).status).toBe(400);
  });

  it('suggests nothing to cut when the day is over its kcal band', async () => {
    const { cookie } = await userWithGoal();
    const oil = await seedUsdaFood({ name: `Oil ${unique('o')}`, category: 'Fats and Oils', kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 });
    const rice = await seedUsdaFood({ name: `Rice ${unique('r')}`, kcal: 130, proteinG: 2.69, carbsG: 28.17, fatG: 0.28, portions: [{ label: '1 cup', grams: 158 }] });
    // 200 g of oil at lunch (1768 kcal) and 3 cups of rice at dinner (616 kcal): above 2056 + 10 %.
    await log(cookie, { foodId: oil.id, meal: 'lunch', quantity: 200 });
    await log(cookie, { foodId: rice.id, meal: 'dinner', portionId: `${rice.id}-p0`, quantity: 3 });

    const over = feedback(await day(cookie));
    expect(over.gap.kcal.status).toBe('over');
    // Nothing of the meal is changed: only additions (protein, a vegetable) are suggested.
    expect(over.suggestions.filter((s) => s.kind === 'adjust')).toEqual([]);
  });
});

const savedShares = async (cookie: string) =>
  ((await (await authed(cookie, 'GET', '/api/me/profile')).json()) as { mealShares: Record<string, number> }).mealShares;

describe('PATCH /api/me/settings mealShares', () => {
  // Kept as a setting although the diary no longer splits the target by meal (2026-11-22).
  it('saves valid shares', async () => {
    const { cookie } = await userWithGoal();
    const res = await authed(cookie, 'PATCH', '/api/me/settings', { mealShares: { breakfast: 20, lunch: 40, dinner: 30, snack: 10 } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ settings: { mealShares: { breakfast: 20, lunch: 40, dinner: 30, snack: 10 } } });
    expect(await savedShares(cookie)).toEqual({ breakfast: 20, lunch: 40, dinner: 30, snack: 10 });
  });

  it('rejects shares that do not total 100 or are not steps of 5', async () => {
    const { cookie } = await userWithGoal();
    for (const mealShares of [
      { breakfast: 25, lunch: 30, dinner: 30, snack: 10 },
      { breakfast: 23, lunch: 32, dinner: 30, snack: 15 },
    ]) {
      expect((await authed(cookie, 'PATCH', '/api/me/settings', { mealShares })).status).toBe(400);
    }
    expect(await savedShares(cookie)).toEqual({ breakfast: 25, lunch: 30, dinner: 30, snack: 15 });
  });
});
