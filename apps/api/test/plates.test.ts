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
  kind: 'add' | 'reduce';
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
  target: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  totals: { kcal: number; proteinG: number };
  gap: Record<'kcal' | 'proteinG' | 'carbsG' | 'fatG', Gap> | null;
  hasVegetables: boolean;
  suggestions: Suggestion[];
}
interface Day {
  entries: { id: string; slot: string; meal: string }[];
  mealShares: Record<string, number>;
  meals: MealView[];
}

async function userWithGoal() {
  const user = await signedInUser();
  await authed(user.cookie, 'POST', '/api/me/consents', { kind: 'health_data', version: CONSENT_VERSION, granted: true });
  expect((await authed(user.cookie, 'PUT', '/api/me/profile', profile)).status).toBe(200);
  return user;
}

async function day(cookie: string): Promise<Day> {
  const res = await authed(cookie, 'GET', `/api/diary?date=${today()}`);
  expect(res.status).toBe(200);
  return (await res.json()) as Day;
}

const meal = (d: Day, name: string) => d.meals.find((m) => m.meal === name) as MealView;

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

  it('splits the daily target by the default shares and only gives feedback for meals with entries', async () => {
    const { cookie } = await userWithGoal();
    const rice = await seedUsdaFood({ name: `Rice ${unique('r')}`, kcal: 130, proteinG: 2.69, carbsG: 28.17, fatG: 0.28 });
    await log(cookie, { foodId: rice.id, meal: 'lunch', quantity: 300 });

    const d = await day(cookie);
    expect(d.mealShares).toEqual({ breakfast: 25, lunch: 30, dinner: 30, snack: 15 });
    expect(d.meals.map((m) => m.meal)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    expect(meal(d, 'lunch').target).toEqual({ kcal: 617, proteinG: 42, carbsG: 74, fatG: 17 });
    expect(meal(d, 'breakfast').gap).toBeNull();
    // 300 g rice: 390 kcal (short), 8 g protein (short), 85 g carbs (over 74 + 10 %), 1 g fat (short).
    expect(meal(d, 'lunch').gap).toEqual({
      kcal: { status: 'short', diff: 390 - 617 },
      proteinG: { status: 'short', diff: 8 - 42 },
      carbsG: { status: 'over', diff: 85 - 74 },
      fatG: { status: 'short', diff: 1 - 17 },
    });
    expect(meal(d, 'lunch').hasVegetables).toBe(false);
  });

  it('has no targets, feedback or suggestions without a goal', async () => {
    const user = await signedInUser();
    await authed(user.cookie, 'POST', '/api/me/consents', { kind: 'health_data', version: CONSENT_VERSION, granted: true });
    const rice = await seedUsdaFood({ name: `Rice ${unique('r')}` });
    await log(user.cookie, { foodId: rice.id });
    const lunch = meal(await day(user.cookie), 'lunch');
    expect(lunch).toMatchObject({ target: null, gap: null, suggestions: [] });
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

    const dinner = meal(await day(cookie), 'dinner');
    const curated = await env.DB.prepare('SELECT id FROM foods WHERE suggest_portion_id IS NOT NULL').all<{ id: string }>();
    const curatedIds = new Set(curated.results.map((r) => r.id));
    expect(dinner.suggestions.length).toBeGreaterThan(0);
    expect(dinner.suggestions.length).toBeLessThanOrEqual(3);
    for (const s of dinner.suggestions) {
      expect(s.kind).toBe('add');
      expect(curatedIds.has(s.foodId ?? '')).toBe(true);
      expect(s.portionLabel).not.toBeNull();
    }
    expect(dinner.suggestions[0]).toMatchObject({ reason: 'protein' });
    const veg = dinner.suggestions.find((s) => s.reason === 'vegetable');
    expect(veg).toMatchObject({ foodId: broccoli.id, portionLabel: '0.5 cup, chopped', quantity: 1 });

    // The yogurt is the only curated protein food (test storage is isolated per test).
    const protein = dinner.suggestions[0] as Suggestion;
    expect(protein).toMatchObject({ foodId: yogurt.id, portionLabel: '1 container', nameZh: `酸奶${t}` });
    expect(curatedIds).toEqual(new Set([yogurt.id, broccoli.id]));
    await log(cookie, { meal: 'dinner', foodId: protein.foodId, portionId: protein.portionId, quantity: protein.quantity });
    const after = meal(await day(cookie), 'dinner');
    expect(after.gap?.proteinG.diff).toBeGreaterThan(dinner.gap?.proteinG.diff ?? 0);
  });

  it('suggests halving the biggest staple when a meal is over its kcal band', async () => {
    const { cookie } = await userWithGoal();
    const rice = await seedUsdaFood({ name: `Rice ${unique('r')}`, kcal: 130, proteinG: 2.69, carbsG: 28.17, fatG: 0.28, portions: [{ label: '1 cup', grams: 158 }] });
    const entry = await log(cookie, { foodId: rice.id, meal: 'snack', portionId: `${rice.id}-p0`, quantity: 3 });

    const snack = meal(await day(cookie), 'snack');
    expect(snack.gap?.kcal.status).toBe('over');
    const reduce = snack.suggestions.find((s) => s.kind === 'reduce');
    expect(reduce).toMatchObject({ reason: 'kcal', entryId: entry.id, portionId: `${rice.id}-p0`, portionLabel: '1 cup', quantity: 1.5 });

    const res = await authed(cookie, 'PATCH', `/api/diary/entries/${entry.id}`, { portionId: reduce?.portionId, quantity: reduce?.quantity });
    expect(res.status).toBe(200);
    expect(meal(await day(cookie), 'snack').totals.kcal).toBe(Math.round(130 * 1.58 * 1.5));
  });
});

describe('PATCH /api/me/settings mealShares', () => {
  it('saves valid shares and the diary uses them', async () => {
    const { cookie } = await userWithGoal();
    const res = await authed(cookie, 'PATCH', '/api/me/settings', { mealShares: { breakfast: 20, lunch: 40, dinner: 30, snack: 10 } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ settings: { mealShares: { breakfast: 20, lunch: 40, dinner: 30, snack: 10 } } });
    const d = await day(cookie);
    expect(d.mealShares).toEqual({ breakfast: 20, lunch: 40, dinner: 30, snack: 10 });
    expect(meal(d, 'lunch').target?.kcal).toBe(Math.round(2056 * 0.4));
  });

  it('rejects shares that do not total 100 or are not steps of 5', async () => {
    const { cookie } = await userWithGoal();
    for (const mealShares of [
      { breakfast: 25, lunch: 30, dinner: 30, snack: 10 },
      { breakfast: 23, lunch: 32, dinner: 30, snack: 15 },
    ]) {
      expect((await authed(cookie, 'PATCH', '/api/me/settings', { mealShares })).status).toBe(400);
    }
    expect((await day(cookie)).mealShares).toEqual({ breakfast: 25, lunch: 30, dinner: 30, snack: 15 });
  });
});
