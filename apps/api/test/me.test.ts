import { env } from 'cloudflare:workers';
import { CONSENT_VERSION } from '@fitplan/validators';
import { describe, expect, it } from 'vitest';
import { authed, signedInUser } from './helpers';

// Mirrors the `base` fixture in packages/core (kcal target 2056).
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
  const res = await authed(user.cookie, 'POST', '/api/me/consents', {
    kind: 'health_data',
    version: CONSENT_VERSION,
    granted: true,
  });
  expect(res.status).toBe(201);
  return user;
}

interface PutBody {
  profile: Record<string, unknown>;
  result: { status: string; reasons: string[]; targets: { kcal: number } | null };
  goalVersionId: string | null;
}

async function countGoalVersions(): Promise<number> {
  const row = await env.DB.prepare('SELECT count(*) AS n FROM goal_versions').first<{ n: number }>();
  return row?.n ?? 0;
}

async function countGoalVersionsFor(email: string): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT count(*) AS n FROM goal_versions WHERE user_id = (SELECT id FROM user WHERE email = ?)',
  )
    .bind(email)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

describe('/api/me', () => {
  it('requires a session', async () => {
    const res = await authed('', 'GET', '/api/me/profile');
    expect(res.status).toBe(401);
  });

  it('POST /api/me/consents rejects invalid input', async () => {
    const { cookie } = await signedInUser();
    const res = await authed(cookie, 'POST', '/api/me/consents', { kind: 'marketing', version: '', granted: true });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; fields: Record<string, string> };
    expect(body.error).toBe('invalid_input');
    expect(body.fields.kind).toBeDefined();
    expect(body.fields.version).toBeDefined();
  });

  it('PUT /api/me/profile requires consent', async () => {
    const { cookie } = await signedInUser();
    const res = await authed(cookie, 'PUT', '/api/me/profile', profile);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'consent_required' });
  });

  it('PUT /api/me/profile requires the latest consent to be granted', async () => {
    const { cookie } = await consentedUser();
    await authed(cookie, 'POST', '/api/me/consents', { kind: 'health_data', version: CONSENT_VERSION, granted: false });
    const res = await authed(cookie, 'PUT', '/api/me/profile', profile);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'consent_required' });
    const get = await authed(cookie, 'GET', '/api/me/profile');
    expect(await get.json()).toEqual({ profile: null, latestGoal: null });
  });

  it('PUT /api/me/profile rejects implausible numbers', async () => {
    const { cookie } = await consentedUser();
    const res = await authed(cookie, 'PUT', '/api/me/profile', {
      ...profile,
      heightCm: 1700,
      healthFlags: { ...profile.healthFlags, medicalDiet: 'yes' },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; fields: Record<string, string> };
    expect(body.error).toBe('invalid_input');
    expect(body.fields.heightCm).toBeDefined();
    expect(body.fields['healthFlags.medicalDiet']).toBeDefined();
  });

  it('saves profile and appends a goal version', async () => {
    const { cookie } = await consentedUser();
    const res = await authed(cookie, 'PUT', '/api/me/profile', profile);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PutBody;
    expect(body.result.targets?.kcal).toBe(2056);
    expect(body.goalVersionId).toBeTruthy();
    expect(body.profile).toMatchObject({ age: 20, heightCm: 175, locale: 'zh' });
    expect(body.profile).not.toHaveProperty('confirmed');
  });

  it('returns 422 for a 17-year-old', async () => {
    const { cookie, email } = await consentedUser();
    const res = await authed(cookie, 'PUT', '/api/me/profile', { ...profile, age: 17 });
    expect(res.status).toBe(422);
    const body = (await res.json()) as PutBody;
    expect(body.result.reasons).toContain('under_age');
    expect(body.goalVersionId).toBeNull();
    expect(body.profile).toMatchObject({ age: 17 });
    expect(await countGoalVersionsFor(email)).toBe(0);
    // The profile is still saved.
    const get = await authed(cookie, 'GET', '/api/me/profile');
    expect(await get.json()).toMatchObject({ profile: { age: 17 }, latestGoal: null });
  });

  it('confirm status needs confirmed flag', async () => {
    const { cookie, email } = await consentedUser();
    const risky = {
      ...profile,
      age: 30,
      heightCm: 180,
      weightKg: 120,
      activityLevel: 1,
      pace: 'aggressive',
    };
    const first = await authed(cookie, 'PUT', '/api/me/profile', risky);
    expect(first.status).toBe(409);
    const firstBody = (await first.json()) as PutBody;
    expect(firstBody.result.status).toBe('confirm');
    expect(firstBody.result.reasons).toContain('aggressive_pace');
    expect(firstBody.goalVersionId).toBeNull();
    expect(await countGoalVersionsFor(email)).toBe(0);

    const second = await authed(cookie, 'PUT', '/api/me/profile', { ...risky, confirmed: true });
    expect(second.status).toBe(200);
    expect(((await second.json()) as PutBody).goalVersionId).toBeTruthy();
    expect(await countGoalVersionsFor(email)).toBe(1);
  });

  it('identical resubmission does not append a goal version', async () => {
    const { cookie, email } = await consentedUser();
    const first = (await (await authed(cookie, 'PUT', '/api/me/profile', profile)).json()) as PutBody;
    const second = (await (await authed(cookie, 'PUT', '/api/me/profile', profile)).json()) as PutBody;
    expect(second.goalVersionId).toBe(first.goalVersionId);
    expect(await countGoalVersionsFor(email)).toBe(1);
  });

  it('locale, unit and training changes do not append a goal version', async () => {
    const { cookie, email } = await consentedUser();
    const first = (await (await authed(cookie, 'PUT', '/api/me/profile', profile)).json()) as PutBody;
    const res = await authed(cookie, 'PUT', '/api/me/profile', {
      ...profile,
      locale: 'en',
      unitSystem: 'imperial',
      trainingDaysPerWeek: 5,
      trainingExperience: 'advanced',
    });
    const second = (await res.json()) as PutBody;
    expect(second.goalVersionId).toBe(first.goalVersionId);
    expect(await countGoalVersionsFor(email)).toBe(1);
    const get = (await (await authed(cookie, 'GET', '/api/me/profile')).json()) as { profile: Record<string, unknown> };
    expect(get.profile).toMatchObject({ locale: 'en', unitSystem: 'imperial', trainingDaysPerWeek: 5 });
  });

  it('a target-relevant change appends a new goal version', async () => {
    const { cookie, email } = await consentedUser();
    const first = (await (await authed(cookie, 'PUT', '/api/me/profile', profile)).json()) as PutBody;
    const second = (await (
      await authed(cookie, 'PUT', '/api/me/profile', { ...profile, weightKg: 68 })
    ).json()) as PutBody;
    expect(second.goalVersionId).toBeTruthy();
    expect(second.goalVersionId).not.toBe(first.goalVersionId);
    expect(await countGoalVersionsFor(email)).toBe(2);
    const get = (await (await authed(cookie, 'GET', '/api/me/profile')).json()) as {
      latestGoal: { id: string };
    };
    expect(get.latestGoal.id).toBe(second.goalVersionId);
  });

  it('GET /api/me/profile returns null before anything is saved', async () => {
    const { cookie } = await consentedUser();
    const res = await authed(cookie, 'GET', '/api/me/profile');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ profile: null, latestGoal: null });
  });

  it('GET /api/me/profile returns saved data', async () => {
    const { cookie } = await consentedUser();
    await authed(cookie, 'PUT', '/api/me/profile', profile);
    const res = await authed(cookie, 'GET', '/api/me/profile');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      profile: Record<string, unknown>;
      latestGoal: { status: string; targets: { kcal: number }; effectiveAt: string; bmi: number };
    };
    expect(body.profile).toMatchObject({ age: 20, sex: 'male', goal: 'lose', healthFlags: profile.healthFlags });
    expect(body.latestGoal.targets.kcal).toBe(2056);
    expect(body.latestGoal.status).toBe('safe');
    expect(body.latestGoal.bmi).toBe(22.9);
    expect(new Date(body.latestGoal.effectiveAt).toISOString()).toBe(body.latestGoal.effectiveAt);
  });

  it("users cannot see each other's profile", async () => {
    const a = await consentedUser();
    const b = await consentedUser();
    await authed(a.cookie, 'PUT', '/api/me/profile', { ...profile, weightKg: 70 });
    await authed(b.cookie, 'PUT', '/api/me/profile', { ...profile, weightKg: 90, sex: 'female' });

    const ra = (await (await authed(a.cookie, 'GET', '/api/me/profile')).json()) as {
      profile: { weightKg: number; sex: string };
      latestGoal: { id: string };
    };
    const rb = (await (await authed(b.cookie, 'GET', '/api/me/profile')).json()) as typeof ra;
    expect(ra.profile).toMatchObject({ weightKg: 70, sex: 'male' });
    expect(rb.profile).toMatchObject({ weightKg: 90, sex: 'female' });
    expect(ra.latestGoal.id).not.toBe(rb.latestGoal.id);
    expect(await countGoalVersions()).toBeGreaterThanOrEqual(2);
  });
});
