import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db/client';
import { saveProfile } from '../src/profile-service';
import { signedInUser } from './helpers';

const input = {
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
  confirmed: false,
} as const;

async function userId(email: string): Promise<string> {
  const row = await env.DB.prepare('SELECT id FROM user WHERE email = ?').bind(email).first<{ id: string }>();
  if (!row) throw new Error('user not found');
  return row.id;
}

describe('saveProfile', () => {
  it('interleaved identical saves store one goal version and all return its id', async () => {
    const id = await userId((await signedInUser()).email);
    const db = createDb(env.DB);

    // Started together, every call reads "no version yet" before any of them writes.
    const outcomes = await Promise.all(Array.from({ length: 4 }, () => saveProfile(db, id, input)));

    const rows = await env.DB.prepare('SELECT id FROM goal_versions WHERE user_id = ?').bind(id).all<{ id: string }>();
    expect(rows.results).toHaveLength(1);
    expect(outcomes.map((o) => o.status)).toEqual([200, 200, 200, 200]);
    expect(new Set(outcomes.map((o) => o.body.goalVersionId))).toEqual(new Set([rows.results[0]?.id]));
  });
});
