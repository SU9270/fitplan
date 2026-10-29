import { describe, expect, it } from 'vitest';
import {
  CONSENT_VERSION,
  consentInputSchema,
  profileInputSchema,
  toTargetInput,
} from './index';

const valid = {
  age: 30,
  sex: 'male',
  heightCm: 175,
  weightKg: 75,
  activityLevel: 3,
  trainingDaysPerWeek: 4,
  trainingExperience: 'intermediate',
  goal: 'lose',
  pace: 'standard',
  healthFlags: {
    pregnantOrNursing: false,
    eatingDisorderHistory: false,
    medicalDiet: false,
  },
  unitSystem: 'metric',
  locale: 'zh',
};

function failingPaths(input: unknown): string[] {
  const r = profileInputSchema.safeParse(input);
  if (r.success) return [];
  return r.error.issues.map((i) => i.path.join('.'));
}

describe('profileInputSchema', () => {
  it('accepts a valid profile and defaults confirmed to false', () => {
    const r = profileInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.confirmed).toBe(false);
  });

  it('rejects implausible numbers with the error path on the field', () => {
    expect(failingPaths({ ...valid, heightCm: 1700 })).toContain('heightCm');
    expect(failingPaths({ ...valid, weightKg: 0 })).toContain('weightKg');
    expect(failingPaths({ ...valid, age: -1 })).toContain('age');
    expect(failingPaths({ ...valid, weightKg: NaN })).toContain('weightKg');
    expect(failingPaths({ ...valid, weightKg: Infinity })).toContain('weightKg');
    expect(failingPaths({ ...valid, age: 30.5 })).toContain('age');
    expect(failingPaths({ ...valid, trainingDaysPerWeek: 8 })).toContain(
      'trainingDaysPerWeek',
    );
    expect(failingPaths({ ...valid, trainingDaysPerWeek: 2.5 })).toContain(
      'trainingDaysPerWeek',
    );
    expect(failingPaths({ ...valid, activityLevel: 6 })).toContain('activityLevel');
    expect(failingPaths({ ...valid, activityLevel: 2.5 })).toContain('activityLevel');
    expect(failingPaths({ ...valid, healthFlags: { ...valid.healthFlags, medicalDiet: 'yes' } })).toContain(
      'healthFlags.medicalDiet',
    );
  });

  it('accepts boundary values', () => {
    for (const patch of [
      { age: 13 },
      { age: 100 },
      { heightCm: 120 },
      { heightCm: 230 },
      { weightKg: 30 },
      { weightKg: 300 },
      { trainingDaysPerWeek: 0 },
      { trainingDaysPerWeek: 7 },
    ]) {
      expect(profileInputSchema.safeParse({ ...valid, ...patch }).success).toBe(true);
    }
    expect(failingPaths({ ...valid, age: 12 })).toContain('age');
    expect(failingPaths({ ...valid, age: 101 })).toContain('age');
  });

  it('rejects unknown enum values', () => {
    expect(failingPaths({ ...valid, sex: 'other' })).toContain('sex');
    expect(failingPaths({ ...valid, goal: 'maintain' })).toContain('goal');
    expect(failingPaths({ ...valid, pace: 'fast' })).toContain('pace');
    expect(failingPaths({ ...valid, unitSystem: 'si' })).toContain('unitSystem');
    expect(failingPaths({ ...valid, locale: 'fr' })).toContain('locale');
    expect(failingPaths({ ...valid, trainingExperience: 'pro' })).toContain(
      'trainingExperience',
    );
  });

  it('accepts age 17 so guardrails can block it', () => {
    expect(profileInputSchema.safeParse({ ...valid, age: 17 }).success).toBe(true);
  });
});

describe('toTargetInput', () => {
  it('maps fields one to one and drops non-target fields', () => {
    const p = profileInputSchema.parse({ ...valid, confirmed: true });
    const t = toTargetInput(p);
    expect(t).toEqual({
      age: 30,
      sex: 'male',
      heightCm: 175,
      weightKg: 75,
      activityLevel: 3,
      goal: 'lose',
      pace: 'standard',
      healthFlags: valid.healthFlags,
    });
    for (const k of [
      'trainingDaysPerWeek',
      'trainingExperience',
      'unitSystem',
      'locale',
      'confirmed',
    ]) {
      expect(t).not.toHaveProperty(k);
    }
  });
});

describe('consentInputSchema', () => {
  it('accepts a health_data consent', () => {
    expect(
      consentInputSchema.safeParse({
        kind: 'health_data',
        version: CONSENT_VERSION,
        granted: true,
      }).success,
    ).toBe(true);
  });

  it('rejects other kinds, empty version, non-boolean granted', () => {
    const base = { kind: 'health_data', version: CONSENT_VERSION, granted: true };
    const paths = (x: unknown) => {
      const r = consentInputSchema.safeParse(x);
      return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    };
    expect(paths({ ...base, kind: 'marketing' })).toContain('kind');
    expect(paths({ ...base, version: '' })).toContain('version');
    expect(paths({ ...base, granted: 'yes' })).toContain('granted');
  });

  it('exposes the consent version', () => {
    expect(CONSENT_VERSION).toBe('2026-10-29');
  });
});
