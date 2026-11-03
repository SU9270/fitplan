import { env, exports } from 'cloudflare:workers';
import { CONSENT_VERSION, NICKNAME_MAX_LENGTH } from '@fitplan/validators';
import { describe, expect, it } from 'vitest';
import { BASE_URL, authed, seedUsdaFood, signedInUser, unique } from './helpers';

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

async function consentedUser() {
  const user = await signedInUser();
  await authed(user.cookie, 'POST', '/api/me/consents', { kind: 'health_data', version: CONSENT_VERSION, granted: true });
  return user;
}

const label = (name: string) => ({ name, servingLabel: null, servingGrams: 100, kcal: 100, proteinG: 1, carbsG: 1, fatG: 1 });

describe('GET /api/foods/mine', () => {
  it('requires a session', async () => {
    expect((await authed('', 'GET', '/api/foods/mine')).status).toBe(401);
  });

  it("lists only the user's own custom foods, most recently changed first", async () => {
    const owner = await signedInUser();
    const other = await signedInUser();
    await seedUsdaFood({ name: `Usda ${unique('u')}` });
    const first = ((await (await authed(owner.cookie, 'POST', '/api/foods', label('First'))).json()) as { food: { id: string } }).food;
    const second = ((await (await authed(owner.cookie, 'POST', '/api/foods', label('Second'))).json()) as { food: { id: string } }).food;
    await authed(other.cookie, 'POST', '/api/foods', label('Not mine'));
    // Editing the first one makes it the most recent.
    await authed(owner.cookie, 'PUT', `/api/foods/${first.id}`, label('First, edited'));

    const res = await authed(owner.cookie, 'GET', '/api/foods/mine');
    expect(res.status).toBe(200);
    const { foods } = (await res.json()) as { foods: { id: string; name: string; source: string }[] };
    expect(foods.map((f) => f.name)).toEqual(['First, edited', 'Second']);
    expect(foods.map((f) => f.id)).toEqual([first.id, second.id]);
    expect(foods.every((f) => f.source === 'custom')).toBe(true);
  });
});

describe('GET /api/diary/stats', () => {
  it('counts days, entries and the current streak up to the given today', async () => {
    const { cookie } = await consentedUser();
    const other = await consentedUser();
    const food = await seedUsdaFood({ name: `Food ${unique('f')}` });
    const log = (c: string, date: string) =>
      authed(c, 'POST', '/api/diary/entries', { date, meal: 'lunch', foodId: food.id, portionId: null, quantity: 100 });
    // 10-29, 10-31 (twice), 11-01; nothing yet on 11-02. 11-03 is after "today" and ignored.
    for (const date of ['2026-10-29', '2026-10-31', '2026-10-31', '2026-11-01']) expect((await log(cookie, date)).status).toBe(201);
    await env.DB.prepare(
      `INSERT INTO diary_entries (id, user_id, date, meal, food_name, quantity, grams)
       SELECT ?, user_id, '2026-11-03', 'lunch', 'later', 1, 1 FROM diary_entries WHERE food_id = ? LIMIT 1`,
    )
      .bind(unique('e'), food.id)
      .run();
    await log(other.cookie, '2026-11-02');

    const res = await authed(cookie, 'GET', '/api/diary/stats?today=2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ loggedDays: 3, currentStreak: 2, totalEntries: 4 });
  });

  it('is all zeros for a new user and rejects a bad date', async () => {
    const { cookie } = await signedInUser();
    expect(await (await authed(cookie, 'GET', '/api/diary/stats?today=2026-11-02')).json()).toEqual({
      loggedDays: 0,
      currentStreak: 0,
      totalEntries: 0,
    });
    expect((await authed(cookie, 'GET', '/api/diary/stats?today=2026-02-30')).status).toBe(400);
    expect((await authed(cookie, 'GET', '/api/diary/stats')).status).toBe(400);
  });
});

describe('PATCH /api/me/settings', () => {
  it('404s before a profile exists and rejects empty or unknown values', async () => {
    const { cookie } = await signedInUser();
    expect((await authed(cookie, 'PATCH', '/api/me/settings', { locale: 'en' })).status).toBe(404);
    expect((await authed(cookie, 'PATCH', '/api/me/settings', {})).status).toBe(400);
    expect((await authed(cookie, 'PATCH', '/api/me/settings', { unitSystem: 'cubits' })).status).toBe(400);
  });

  it('saves unit and language without appending a goal version', async () => {
    const { cookie, email } = await consentedUser();
    expect((await authed(cookie, 'PUT', '/api/me/profile', profile)).status).toBe(200);
    const versions = () =>
      env.DB.prepare('SELECT count(*) AS n FROM goal_versions WHERE user_id = (SELECT id FROM user WHERE email = ?)')
        .bind(email)
        .first<{ n: number }>();
    const before = await versions();

    const res = await authed(cookie, 'PATCH', '/api/me/settings', { unitSystem: 'imperial', locale: 'en' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      settings: { unitSystem: 'imperial', locale: 'en', mealShares: { breakfast: 25, lunch: 30, dinner: 30, snack: 15 } },
    });
    const saved = (await (await authed(cookie, 'GET', '/api/me/profile')).json()) as { profile: Record<string, unknown> };
    expect(saved.profile).toMatchObject({ unitSystem: 'imperial', locale: 'en', heightCm: 175 });
    expect(await versions()).toEqual(before);
  });
});

describe('POST /api/auth/update-user (nickname)', () => {
  // Better Auth rejects cookie-authenticated POSTs without an Origin (CSRF check); the app's
  // Expo client always sends one.
  const rename = (cookie: string, name: unknown) =>
    exports.default.fetch(`${BASE_URL}/api/auth/update-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie, origin: BASE_URL },
      body: JSON.stringify({ name }),
    });

  it('accepts a 1-40 character name', async () => {
    const { cookie } = await signedInUser();
    expect((await rename(cookie, '小苏')).status).toBe(200);
    const session = (await (await authed(cookie, 'GET', '/api/auth/get-session')).json()) as { user: { name: string } };
    expect(session.user.name).toBe('小苏');
  });

  it('rejects blank and overlong names', async () => {
    const { cookie } = await signedInUser();
    for (const name of ['   ', 'a'.repeat(NICKNAME_MAX_LENGTH + 1), 42]) {
      const res = await rename(cookie, name);
      expect({ name, status: res.status }).toEqual({ name, status: 400 });
    }
  });
});
