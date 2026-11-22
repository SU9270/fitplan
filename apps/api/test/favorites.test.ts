import { env, exports } from 'cloudflare:workers';
import { CONSENT_VERSION } from '@fitplan/validators';
import { describe, expect, it } from 'vitest';
import { authed, BASE_URL, seedUsdaFood, signedInUser, unique } from './helpers';

const today = () => new Date().toISOString().slice(0, 10);

interface Favorite {
  id: string;
  libraryKey: string | null;
  portionId: string | null;
  portionLabel: string | null;
  quantity: number;
  grams: number;
  kcal: number | null;
}

async function consentedUser() {
  const user = await signedInUser();
  await authed(user.cookie, 'POST', '/api/me/consents', { kind: 'health_data', version: CONSENT_VERSION, granted: true });
  return user;
}

async function favorites(cookie: string): Promise<Favorite[]> {
  const res = await authed(cookie, 'GET', '/api/foods/favorites');
  expect(res.status).toBe(200);
  return ((await res.json()) as { foods: Favorite[] }).foods;
}

async function star(cookie: string, foodId: string) {
  const res = await authed(cookie, 'PUT', `/api/foods/${foodId}/favorite`);
  expect(res.status).toBe(204);
}

async function isFavorite(cookie: string, foodId: string): Promise<boolean | undefined> {
  const res = await authed(cookie, 'GET', `/api/foods/${foodId}`);
  return ((await res.json()) as { food: { favorite?: boolean } }).food.favorite;
}

/** Log `foodId` today at lunch and return the entry id. */
async function log(cookie: string, foodId: string, portionId: string | null, quantity: number): Promise<string> {
  const res = await authed(cookie, 'POST', '/api/diary/entries', { date: today(), meal: 'lunch', foodId, portionId, quantity });
  expect(res.status).toBe(201);
  return ((await res.json()) as { entry: { id: string } }).entry.id;
}

const customFood = (name: string) => ({ name, servingLabel: '1 bowl', servingGrams: 200, kcal: 300, proteinG: 20, carbsG: 30, fatG: 10 });

describe('favorite foods', () => {
  it('stars a food once, lists it, and unstars it', async () => {
    const { cookie } = await signedInUser();
    const food = await seedUsdaFood({ name: unique('Egg') });

    await star(cookie, food.id);
    await star(cookie, food.id);
    expect((await favorites(cookie)).map((f) => f.id)).toEqual([food.id]);
    expect(await isFavorite(cookie, food.id)).toBe(true);

    expect((await authed(cookie, 'DELETE', `/api/foods/${food.id}/favorite`)).status).toBe(204);
    expect((await authed(cookie, 'DELETE', `/api/foods/${food.id}/favorite`)).status).toBe(204);
    expect(await favorites(cookie)).toEqual([]);
    expect(await isFavorite(cookie, food.id)).toBe(false);
  });

  it('lists newest favorites first with the library key', async () => {
    const { cookie } = await signedInUser();
    const a = await seedUsdaFood({ name: unique('Rice') });
    const b = await seedUsdaFood({ name: unique('Tofu') });
    const key = unique('rice').replaceAll('-', '_');
    await env.DB.prepare('UPDATE foods SET library_key = ? WHERE id = ?').bind(key, a.id).run();

    await star(cookie, a.id);
    await star(cookie, b.id);
    await env.DB.prepare("UPDATE favorite_foods SET created_at = '2026-01-01T00:00:00.000Z' WHERE food_id = ?").bind(a.id).run();

    const list = await favorites(cookie);
    expect(list.map((f) => f.id)).toEqual([b.id, a.id]);
    expect(list.map((f) => f.libraryKey)).toEqual([null, key]);
  });

  it("refuses another user's custom food and keeps lists apart", async () => {
    const a = await signedInUser();
    const b = await signedInUser();
    const created = await authed(b.cookie, 'POST', '/api/foods', customFood(unique('noodles')));
    const theirs = ((await created.json()) as { food: { id: string } }).food.id;

    const res = await authed(a.cookie, 'PUT', `/api/foods/${theirs}/favorite`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: 'not_found' });
    expect(await favorites(a.cookie)).toEqual([]);

    const usda = await seedUsdaFood({ name: unique('Oats') });
    await star(a.cookie, usda.id);
    expect(await favorites(b.cookie)).toEqual([]);
  });

  it('drops a deleted custom food from the list', async () => {
    const { cookie } = await signedInUser();
    const created = await authed(cookie, 'POST', '/api/foods', customFood(unique('stew')));
    const id = ((await created.json()) as { food: { id: string } }).food.id;
    await star(cookie, id);
    expect((await favorites(cookie)).map((f) => f.id)).toEqual([id]);

    expect((await authed(cookie, 'DELETE', `/api/foods/${id}`)).status).toBe(204);
    expect(await favorites(cookie)).toEqual([]);
  });

  it('uses the last logged amount', async () => {
    const { cookie } = await consentedUser();
    const food = await seedUsdaFood({ name: unique('Egg'), kcal: 150, portions: [{ label: '1 large', grams: 50 }] });
    await star(cookie, food.id);
    const first = await log(cookie, food.id, food.portionIds[0] ?? null, 2);
    await log(cookie, food.id, null, 80);
    await env.DB.prepare("UPDATE diary_entries SET created_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").bind(first).run();

    expect(await favorites(cookie)).toMatchObject([{ portionId: null, portionLabel: null, quantity: 80, grams: 80, kcal: 120 }]);
  });

  it("shows the grams the portion weighs now, which is what a one-tap add logs", async () => {
    const { cookie } = await consentedUser();
    const food = await seedUsdaFood({ name: unique('Yogurt'), kcal: 100, portions: [{ label: '1 cup', grams: 30 }] });
    await star(cookie, food.id);
    await log(cookie, food.id, food.portionIds[0] ?? null, 2);
    // A re-import (or editing a custom food) changes the portion's weight in place.
    await env.DB.prepare('UPDATE food_portions SET grams = 50 WHERE id = ?').bind(food.portionIds[0]).run();

    expect(await favorites(cookie)).toMatchObject([
      { portionId: food.portionIds[0], portionLabel: '1 cup', quantity: 2, grams: 100, kcal: 100 },
    ]);
  });

  it('uses the first portion × 1, or 100 g, for a food never logged', async () => {
    const { cookie } = await signedInUser();
    const withPortions = await seedUsdaFood({
      name: unique('Egg'),
      kcal: 150,
      portions: [
        { label: '1 large', grams: 50 },
        { label: '1 cup', grams: 240 },
      ],
    });
    const bare = await seedUsdaFood({ name: unique('Mystery'), kcal: null });
    await star(cookie, withPortions.id);
    await star(cookie, bare.id);

    const byId = new Map((await favorites(cookie)).map((f) => [f.id, f]));
    expect(byId.get(withPortions.id)).toMatchObject({
      portionId: withPortions.portionIds[0],
      portionLabel: '1 large',
      quantity: 1,
      grams: 50,
      kcal: 75,
    });
    expect(byId.get(bare.id)).toMatchObject({ portionId: null, portionLabel: null, quantity: 100, grams: 100, kcal: null });
  });

  it('falls back to grams when the logged portion was deleted', async () => {
    const { cookie } = await consentedUser();
    const food = await seedUsdaFood({ name: unique('Egg'), portions: [{ label: '1 large', grams: 50 }] });
    await star(cookie, food.id);
    await log(cookie, food.id, food.portionIds[0] ?? null, 2);
    await env.DB.prepare('DELETE FROM food_portions WHERE id = ?').bind(food.portionIds[0]).run();

    expect(await favorites(cookie)).toMatchObject([{ portionId: null, portionLabel: null, quantity: 100, grams: 100 }]);
  });

  it('lists more than 100 favorites', async () => {
    const { cookie, email } = await signedInUser();
    const user = await env.DB.prepare('SELECT id FROM user WHERE email = ?').bind(email).first<{ id: string }>();
    expect(user).not.toBeNull();
    for (let i = 0; i < 120; i += 1) {
      const food = await seedUsdaFood({ name: unique('Bulk') });
      await env.DB.prepare('INSERT INTO favorite_foods (user_id, food_id) VALUES (?, ?)').bind(user?.id, food.id).run();
    }
    expect(await favorites(cookie)).toHaveLength(120);
  });

  it('needs a session', async () => {
    const res = await exports.default.fetch(`${BASE_URL}/api/foods/favorites`);
    expect(res.status).toBe(401);
  });
});
