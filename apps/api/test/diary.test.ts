import { env } from 'cloudflare:workers';
import { CONSENT_VERSION } from '@fitplan/validators';
import { describe, expect, it } from 'vitest';
import { authed, seedUsdaFood, signedInUser, unique } from './helpers';

interface Entry {
  id: string;
  meal: string;
  foodId: string | null;
  name: string;
  nameZh: string | null;
  portionId: string | null;
  portionLabel: string | null;
  quantity: number;
  grams: number;
  nutrients: { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null };
}
interface Day {
  date: string;
  entries: Entry[];
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  unknown: string[];
  target: { kcal: number } | null;
}

const today = () => new Date().toISOString().slice(0, 10);

async function consentedUser() {
  const user = await signedInUser();
  await authed(user.cookie, 'POST', '/api/me/consents', { kind: 'health_data', version: CONSENT_VERSION, granted: true });
  return user;
}

async function getDay(cookie: string, date = today()): Promise<Day> {
  const res = await authed(cookie, 'GET', `/api/diary?date=${date}`);
  expect(res.status).toBe(200);
  return (await res.json()) as Day;
}

async function log(cookie: string, body: Record<string, unknown>) {
  return authed(cookie, 'POST', '/api/diary/entries', { date: today(), meal: 'lunch', portionId: null, quantity: 100, ...body });
}

async function logOk(cookie: string, body: Record<string, unknown>): Promise<Entry> {
  const res = await log(cookie, body);
  expect(res.status).toBe(201);
  return ((await res.json()) as { entry: Entry }).entry;
}

// Shaped like a cooked chicken breast (test numbers).
const chicken = () =>
  seedUsdaFood({
    name: `Chicken ${unique('c')}`,
    nameZh: '鸡胸肉',
    kcal: 165,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
    portions: [{ label: '1 cup, chopped', grams: 140 }],
  });

describe('/api/diary', () => {
  it('requires a session', async () => {
    expect((await authed('', 'GET', `/api/diary?date=${today()}`)).status).toBe(401);
    expect((await authed('', 'POST', '/api/diary/entries', {})).status).toBe(401);
  });

  it('logging requires health-data consent', async () => {
    const { cookie } = await signedInUser();
    const food = await chicken();
    const res = await log(cookie, { foodId: food.id });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: 'consent_required' });
  });

  it('logs grams or portions, snapshots the food, and totals the day', async () => {
    const { cookie } = await consentedUser();
    const food = await chicken();

    const byGrams = await logOk(cookie, { foodId: food.id, meal: 'lunch', quantity: 150 });
    expect(byGrams).toMatchObject({
      meal: 'lunch',
      foodId: food.id,
      nameZh: '鸡胸肉',
      portionId: null,
      portionLabel: null,
      quantity: 150,
      grams: 150,
      nutrients: { kcal: 247.5, proteinG: 46.5, carbsG: 0 },
    });
    expect(byGrams.nutrients.fatG).toBeCloseTo(5.4, 10);

    const byPortion = await logOk(cookie, { foodId: food.id, meal: 'dinner', portionId: food.portionIds[0], quantity: 1.5 });
    expect(byPortion).toMatchObject({ portionLabel: '1 cup, chopped', quantity: 1.5, grams: 210 });

    const day = await getDay(cookie);
    expect(day.entries.map((e) => e.id)).toEqual([byGrams.id, byPortion.id]);
    // 165 × 3.6 = 594 kcal; protein 31 × 3.6 = 111.6; fat 3.6 × 3.6 = 12.96
    expect(day.totals).toEqual({ kcal: 594, proteinG: 112, carbsG: 0, fatG: 13 });
    expect(day.unknown).toEqual([]);
    expect(day.target).toBeNull();
  });

  it('lists unknown nutrients and returns the latest goal as target', async () => {
    const { cookie } = await consentedUser();
    const put = await authed(cookie, 'PUT', '/api/me/profile', {
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
    });
    expect(put.status).toBe(200);
    const sauce = await seedUsdaFood({ name: `Sauce ${unique('s')}`, kcal: 50, proteinG: null, carbsG: 10, fatG: null });
    await logOk(cookie, { foodId: sauce.id, quantity: 20 });

    const day = await getDay(cookie);
    expect(day.totals).toEqual({ kcal: 10, proteinG: 0, carbsG: 2, fatG: 0 });
    expect(day.unknown).toEqual(['proteinG', 'fatG']);
    expect(day.target).toMatchObject({ kcal: 2056 });
  });

  it('keeps days apart', async () => {
    const { cookie } = await consentedUser();
    const food = await chicken();
    await logOk(cookie, { foodId: food.id, date: '2026-01-01' });
    expect((await getDay(cookie, '2026-01-01')).entries).toHaveLength(1);
    expect((await getDay(cookie, '2026-01-02')).entries).toHaveLength(0);
  });

  it('rejects bad dates, foreign portions, unknown foods and oversized amounts', async () => {
    const { cookie } = await consentedUser();
    const food = await chicken();
    const other = await chicken();

    expect((await authed(cookie, 'GET', '/api/diary?date=2026-02-30')).status).toBe(400);
    expect((await authed(cookie, 'GET', '/api/diary')).status).toBe(400);

    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const cases: [Record<string, unknown>, number, Record<string, string> | null][] = [
      [{ foodId: food.id, date: future }, 400, { date: 'date_in_future' }],
      [{ foodId: food.id, portionId: other.portionIds[0], quantity: 1 }, 400, { portionId: 'not_found' }],
      [{ foodId: food.id, portionId: food.portionIds[0], quantity: 40 }, 400, { quantity: 'too_big' }],
      [{ foodId: food.id, quantity: 5001 }, 400, null],
      [{ foodId: 'usda-0' }, 404, null],
    ];
    for (const [body, status, fields] of cases) {
      const res = await log(cookie, body);
      expect({ body, status: res.status }).toEqual({ body, status });
      if (fields) expect(await res.json()).toEqual({ error: 'invalid_input', fields });
    }
  });

  it('cannot log, see or touch other users’ custom foods and entries', async () => {
    const owner = await consentedUser();
    const other = await consentedUser();
    const label = { name: 'Secret bar', servingLabel: null, servingGrams: 60, kcal: 210, proteinG: 20, carbsG: 24, fatG: 7 };
    const custom = ((await (await authed(owner.cookie, 'POST', '/api/foods', label)).json()) as { food: { id: string } }).food;
    expect((await log(other.cookie, { foodId: custom.id })).status).toBe(404);

    const entry = await logOk(owner.cookie, { foodId: custom.id });
    expect((await authed(other.cookie, 'PATCH', `/api/diary/entries/${entry.id}`, { meal: 'snack' })).status).toBe(404);
    expect((await authed(other.cookie, 'DELETE', `/api/diary/entries/${entry.id}`)).status).toBe(404);
    expect((await getDay(other.cookie)).entries).toEqual([]);
    expect((await getDay(owner.cookie)).entries.map((e) => e.meal)).toEqual(['lunch']);
  });

  it('PATCH changes the meal and/or amount; DELETE removes the entry', async () => {
    const { cookie } = await consentedUser();
    const food = await chicken();
    const entry = await logOk(cookie, { foodId: food.id, quantity: 100 });

    const patch = (body: unknown) => authed(cookie, 'PATCH', `/api/diary/entries/${entry.id}`, body);
    const moved = await patch({ meal: 'snack' });
    expect(moved.status).toBe(200);
    expect(((await moved.json()) as { entry: Entry }).entry).toMatchObject({ meal: 'snack', grams: 100 });

    const resized = await patch({ portionId: food.portionIds[0], quantity: 2 });
    expect(((await resized.json()) as { entry: Entry }).entry).toMatchObject({
      meal: 'snack',
      portionLabel: '1 cup, chopped',
      grams: 280,
      nutrients: { kcal: 462 },
    });

    expect((await patch({ quantity: 3 })).status).toBe(400);
    expect((await authed(cookie, 'DELETE', `/api/diary/entries/${entry.id}`)).status).toBe(204);
    expect((await authed(cookie, 'DELETE', `/api/diary/entries/${entry.id}`)).status).toBe(404);
    expect((await getDay(cookie)).entries).toEqual([]);
  });

  it('entries keep their snapshot when a custom food is edited or deleted', async () => {
    const { cookie } = await consentedUser();
    const label = { name: 'Dumplings', servingLabel: '6 pcs', servingGrams: 150, kcal: 300, proteinG: 12, carbsG: 36, fatG: 12 };
    const food = ((await (await authed(cookie, 'POST', '/api/foods', label)).json()) as {
      food: { id: string; portions: { id: string }[] };
    }).food;
    const entry = await logOk(cookie, { foodId: food.id, portionId: food.portions[0]?.id, quantity: 1 });
    expect(entry.nutrients.kcal).toBeCloseTo(300, 6);

    await authed(cookie, 'PUT', `/api/foods/${food.id}`, { ...label, name: 'Dumplings (fried)', kcal: 450 });
    const afterEdit = (await getDay(cookie)).entries[0];
    expect(afterEdit).toMatchObject({ name: 'Dumplings', portionLabel: '6 pcs' });
    expect(afterEdit?.nutrients.kcal).toBeCloseTo(300, 6);

    expect((await authed(cookie, 'DELETE', `/api/foods/${food.id}`)).status).toBe(204);
    const afterDelete = (await getDay(cookie)).entries[0];
    expect(afterDelete).toMatchObject({ foodId: null, portionId: null, name: 'Dumplings', portionLabel: '6 pcs' });

    // The amount can still be changed in grams, scaled from the snapshot; a portion no longer exists.
    const patch = (body: unknown) => authed(cookie, 'PATCH', `/api/diary/entries/${entry.id}`, body);
    expect((await patch({ portionId: food.portions[0]?.id, quantity: 2 })).status).toBe(400);
    const grams = await patch({ portionId: null, quantity: 75 });
    expect(grams.status).toBe(200);
    expect(((await grams.json()) as { entry: Entry }).entry.nutrients.kcal).toBeCloseTo(150, 6);
  });

  it('deleting the account removes its entries and custom foods', async () => {
    const { cookie, email } = await consentedUser();
    const label = { name: 'Gone', servingLabel: null, servingGrams: 100, kcal: 100, proteinG: 1, carbsG: 1, fatG: 1 };
    const food = ((await (await authed(cookie, 'POST', '/api/foods', label)).json()) as { food: { id: string } }).food;
    await logOk(cookie, { foodId: food.id });
    await env.DB.prepare('DELETE FROM user WHERE email = ?').bind(email).run();
    const left = await env.DB.prepare('SELECT (SELECT count(*) FROM foods WHERE id = ?) AS foods, (SELECT count(*) FROM diary_entries WHERE food_id = ?) AS entries')
      .bind(food.id, food.id)
      .first();
    expect(left).toEqual({ foods: 0, entries: 0 });
  });
});
