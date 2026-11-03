import { env } from 'cloudflare:workers';
import { CONSENT_VERSION } from '@fitplan/validators';
import { describe, expect, it } from 'vitest';
import { authed, seedUsdaFood, signedInUser, unique } from './helpers';

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

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
  quick: boolean;
  slot: string;
  nutrients: { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null };
}
interface RecentFood {
  foodId: string;
  portionId: string | null;
  portionLabel: string | null;
  quantity: number;
  grams: number;
  kcal: number | null;
  count: number;
}

async function consentedUser() {
  const user = await signedInUser();
  await authed(user.cookie, 'POST', '/api/me/consents', { kind: 'health_data', version: CONSENT_VERSION, granted: true });
  return user;
}

async function entries(cookie: string, date = today()): Promise<Entry[]> {
  const res = await authed(cookie, 'GET', `/api/diary?date=${date}`);
  return ((await res.json()) as { entries: Entry[] }).entries;
}

async function log(cookie: string, body: Record<string, unknown>): Promise<Entry> {
  const res = await authed(cookie, 'POST', '/api/diary/entries', { date: today(), meal: 'lunch', portionId: null, quantity: 100, ...body });
  expect(res.status).toBe(201);
  return ((await res.json()) as { entry: Entry }).entry;
}

const food = (name: string, extra: Record<string, unknown> = {}) =>
  seedUsdaFood({ name: `${name} ${unique('f')}`, portions: [{ label: '1 cup', grams: 150 }], ...extra });

describe('POST /api/diary/quick', () => {
  it('adds a nutrient-only entry; unknown macros stay unknown', async () => {
    const { cookie } = await consentedUser();
    const res = await authed(cookie, 'POST', '/api/diary/quick', { date: today(), meal: 'snack', name: '奶茶', kcal: 320, carbsG: 50 });
    expect(res.status).toBe(201);
    const entry = ((await res.json()) as { entry: Entry }).entry;
    expect(entry).toMatchObject({
      quick: true,
      foodId: null,
      name: '奶茶',
      meal: 'snack',
      portionId: null,
      nutrients: { kcal: 320, proteinG: null, carbsG: 50, fatG: null },
      slot: 'staple',
    });

    const day = (await (await authed(cookie, 'GET', `/api/diary?date=${today()}`)).json()) as { totals: { kcal: number }; unknown: string[] };
    expect(day.totals.kcal).toBe(320);
    expect(day.unknown).toEqual(['proteinG', 'fatG']);
  });

  it('validates, needs consent, and its amount cannot change', async () => {
    const { cookie } = await consentedUser();
    expect((await authed(cookie, 'POST', '/api/diary/quick', { date: today(), meal: 'snack' })).status).toBe(400);
    const res = await authed(cookie, 'POST', '/api/diary/quick', { date: today(), meal: 'snack', kcal: 100 });
    const entry = ((await res.json()) as { entry: Entry }).entry;
    const patch = (body: unknown) => authed(cookie, 'PATCH', `/api/diary/entries/${entry.id}`, body);
    const amount = await patch({ portionId: null, quantity: 200 });
    expect(amount.status).toBe(400);
    expect(await amount.json()).toEqual({ error: 'invalid_input', fields: { quantity: 'quick_entry' } });
    expect((await patch({ meal: 'dinner' })).status).toBe(200);

    const noConsent = await signedInUser();
    expect((await authed(noConsent.cookie, 'POST', '/api/diary/quick', { date: today(), meal: 'snack', kcal: 100 })).status).toBe(403);
  });
});

describe('POST /api/diary/copy', () => {
  it('copies a whole day or one meal as snapshots, in order', async () => {
    const { cookie } = await consentedUser();
    const rice = await food('Rice', { kcal: 130 });
    const egg = await food('Egg', { kcal: 155 });
    await log(cookie, { date: yesterday(), meal: 'breakfast', foodId: egg.id, portionId: egg.portionIds[0], quantity: 2 });
    await log(cookie, { date: yesterday(), meal: 'lunch', foodId: rice.id, quantity: 200 });
    await authed(cookie, 'POST', '/api/diary/quick', { date: yesterday(), meal: 'lunch', name: 'Tea', kcal: 50 });
    // A later change to the food must not leak into the copy.
    await env.DB.prepare('UPDATE foods SET kcal = 999 WHERE id = ?').bind(rice.id).run();

    const lunch = await authed(cookie, 'POST', '/api/diary/copy', { fromDate: yesterday(), toDate: today(), meal: 'lunch' });
    expect(lunch.status).toBe(201);
    expect(await lunch.json()).toEqual({ copied: 2 });
    const copied = await entries(cookie);
    expect(copied.map((e) => [e.meal, e.name.split(' ')[0] ?? e.name, e.quick])).toEqual([
      ['lunch', 'Rice', false],
      ['lunch', 'Tea', true],
    ]);
    expect(copied[0]?.nutrients.kcal).toBeCloseTo(260, 6);

    const all = await authed(cookie, 'POST', '/api/diary/copy', { fromDate: yesterday(), toDate: today() });
    expect(await all.json()).toEqual({ copied: 3 });
    expect((await entries(cookie)).filter((e) => e.meal === 'breakfast')).toMatchObject([{ quantity: 2, portionLabel: '1 cup' }]);
  });

  it('copies nothing from an empty day and never copies other users’ entries', async () => {
    const owner = await consentedUser();
    const other = await consentedUser();
    const rice = await food('Rice');
    await log(owner.cookie, { date: yesterday(), foodId: rice.id });
    const res = await authed(other.cookie, 'POST', '/api/diary/copy', { fromDate: yesterday(), toDate: today() });
    expect(await res.json()).toEqual({ copied: 0 });
    expect(await entries(other.cookie)).toEqual([]);
  });

  it('rejects a target date too far ahead and needs consent', async () => {
    const { cookie } = await consentedUser();
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const res = await authed(cookie, 'POST', '/api/diary/copy', { fromDate: today(), toDate: future });
    expect(await res.json()).toEqual({ error: 'invalid_input', fields: { toDate: 'date_in_future' } });
    const noConsent = await signedInUser();
    expect((await authed(noConsent.cookie, 'POST', '/api/diary/copy', { fromDate: yesterday(), toDate: today() })).status).toBe(403);
  });
});

describe('GET /api/diary/recent', () => {
  it('lists frequent foods by count and recent ones by time, without repeats, with the last amount', async () => {
    const { cookie } = await consentedUser();
    const rice = await food('Rice', { kcal: 130 });
    const egg = await food('Egg', { kcal: 155 });
    const tofu = await food('Tofu', { kcal: 80 });
    await log(cookie, { foodId: rice.id, quantity: 100 });
    await log(cookie, { foodId: egg.id, portionId: egg.portionIds[0], quantity: 1 });
    await log(cookie, { foodId: rice.id, quantity: 100 });
    await log(cookie, { foodId: rice.id, portionId: rice.portionIds[0], quantity: 1.5 });
    await log(cookie, { foodId: tofu.id, quantity: 120 });
    await log(cookie, { foodId: egg.id, portionId: egg.portionIds[0], quantity: 2 });
    await authed(cookie, 'POST', '/api/diary/quick', { date: today(), meal: 'snack', kcal: 99 });

    const body = (await (await authed(cookie, 'GET', '/api/diary/recent')).json()) as { frequent: RecentFood[]; recent: RecentFood[] };
    expect(body.frequent.map((f) => [f.foodId, f.count])).toEqual([
      [rice.id, 3],
      [egg.id, 2],
    ]);
    // The newest entry decides the amount: rice 1.5 × 1 cup (225 g), egg 2 × 1 cup.
    expect(body.frequent[0]).toMatchObject({ portionId: rice.portionIds[0], portionLabel: '1 cup', quantity: 1.5, grams: 225 });
    expect(body.frequent[0]?.kcal).toBeCloseTo(130 * 2.25, 6);
    expect(body.recent.map((f) => f.foodId)).toEqual([tofu.id]);
    expect(body.recent[0]).toMatchObject({ portionId: null, quantity: 120, count: 1 });
  });

  it('drops deleted custom foods and is private', async () => {
    const owner = await consentedUser();
    const other = await consentedUser();
    const label = { name: 'Bar', servingLabel: null, servingGrams: 60, kcal: 210, proteinG: 20, carbsG: 24, fatG: 7 };
    const custom = ((await (await authed(owner.cookie, 'POST', '/api/foods', label)).json()) as { food: { id: string } }).food;
    await log(owner.cookie, { foodId: custom.id, quantity: 60 });
    const get = async (cookie: string) =>
      (await (await authed(cookie, 'GET', '/api/diary/recent')).json()) as { frequent: RecentFood[]; recent: RecentFood[] };
    expect((await get(owner.cookie)).recent.map((f) => f.foodId)).toEqual([custom.id]);
    expect(await get(other.cookie)).toEqual({ frequent: [], recent: [] });
    await authed(owner.cookie, 'DELETE', `/api/foods/${custom.id}`);
    expect(await get(owner.cookie)).toEqual({ frequent: [], recent: [] });
  });
});

describe('/api/meal-templates', () => {
  interface Template {
    id: string;
    name: string;
    items: { name: string; quick: boolean }[];
    kcal: number;
  }

  it('saves a meal as snapshots, lists it and adds it to another day and meal', async () => {
    const { cookie } = await consentedUser();
    const rice = await food('Rice', { kcal: 130 });
    const chicken = await food('Chicken', { kcal: 165 });
    await log(cookie, { meal: 'dinner', foodId: chicken.id, quantity: 100 });
    await log(cookie, { meal: 'dinner', foodId: rice.id, portionId: rice.portionIds[0], quantity: 1 });
    await authed(cookie, 'POST', '/api/diary/quick', { date: today(), meal: 'dinner', name: 'Sauce', kcal: 40 });

    const created = await authed(cookie, 'POST', '/api/meal-templates', { name: '鸡胸饭', date: today(), meal: 'dinner' });
    expect(created.status).toBe(201);
    const template = ((await created.json()) as { template: Template }).template;
    expect(template).toMatchObject({ name: '鸡胸饭', kcal: Math.round(165 + 130 * 1.5 + 40) });
    expect(template.items.map((i) => i.quick)).toEqual([false, false, true]);

    await env.DB.prepare('UPDATE foods SET kcal = 1 WHERE id = ?').bind(chicken.id).run();
    const list = (await (await authed(cookie, 'GET', '/api/meal-templates')).json()) as { templates: Template[] };
    expect(list.templates.map((t) => t.id)).toEqual([template.id]);

    const applied = await authed(cookie, 'POST', `/api/meal-templates/${template.id}/apply`, { date: yesterday(), meal: 'lunch' });
    expect(await applied.json()).toEqual({ copied: 3 });
    const added = await entries(cookie, yesterday());
    expect(added.map((e) => e.meal)).toEqual(['lunch', 'lunch', 'lunch']);
    expect(added[0]?.nutrients.kcal).toBeCloseTo(165, 6);
    expect(added[1]).toMatchObject({ portionId: rice.portionIds[0], quantity: 1 });
  });

  it('rejects an empty meal, keeps templates private and deletes them', async () => {
    const owner = await consentedUser();
    const other = await consentedUser();
    expect((await authed(owner.cookie, 'POST', '/api/meal-templates', { name: 'x', date: today(), meal: 'lunch' })).status).toBe(400);

    const rice = await food('Rice');
    await log(owner.cookie, { foodId: rice.id });
    const template = ((await (await authed(owner.cookie, 'POST', '/api/meal-templates', { name: 'Rice', date: today(), meal: 'lunch' })).json()) as {
      template: Template;
    }).template;

    expect(((await (await authed(other.cookie, 'GET', '/api/meal-templates')).json()) as { templates: Template[] }).templates).toEqual([]);
    expect((await authed(other.cookie, 'POST', `/api/meal-templates/${template.id}/apply`, { date: today(), meal: 'lunch' })).status).toBe(404);
    expect((await authed(other.cookie, 'DELETE', `/api/meal-templates/${template.id}`)).status).toBe(404);

    expect((await authed(owner.cookie, 'DELETE', `/api/meal-templates/${template.id}`)).status).toBe(204);
    expect(await (await authed(owner.cookie, 'GET', '/api/meal-templates')).json()).toEqual({ templates: [] });
  });
});
