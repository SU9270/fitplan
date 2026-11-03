import { describe, expect, it } from 'vitest';
import {
  CONSENT_VERSION,
  NICKNAME_MAX_LENGTH,
  consentInputSchema,
  mealSharesSchema,
  nicknameSchema,
  profileInputSchema,
  settingsPatchSchema,
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

describe('settingsPatchSchema', () => {
  it('accepts either or both preferences', () => {
    expect(settingsPatchSchema.parse({ unitSystem: 'imperial' })).toEqual({ unitSystem: 'imperial' });
    expect(settingsPatchSchema.parse({ locale: 'en', unitSystem: 'metric' })).toEqual({ locale: 'en', unitSystem: 'metric' });
  });

  it('rejects unknown values and empty patches', () => {
    expect(settingsPatchSchema.safeParse({ locale: 'fr' }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({}).success).toBe(false);
  });
});

describe('nicknameSchema', () => {
  it('trims and bounds the length', () => {
    expect(nicknameSchema.parse('  小苏  ')).toBe('小苏');
    expect(nicknameSchema.safeParse('   ').success).toBe(false);
    expect(nicknameSchema.safeParse('a'.repeat(NICKNAME_MAX_LENGTH)).success).toBe(true);
    expect(nicknameSchema.safeParse('a'.repeat(NICKNAME_MAX_LENGTH + 1)).success).toBe(false);
  });
});

describe('mealSharesSchema', () => {
  it('accepts shares in steps of 5 that total 100', () => {
    expect(mealSharesSchema.safeParse({ breakfast: 25, lunch: 30, dinner: 30, snack: 15 }).success).toBe(true);
    expect(mealSharesSchema.safeParse({ breakfast: 0, lunch: 50, dinner: 50, snack: 0 }).success).toBe(true);
  });

  it('rejects totals other than 100, odd steps and out-of-range values', () => {
    expect(mealSharesSchema.safeParse({ breakfast: 25, lunch: 30, dinner: 30, snack: 10 }).success).toBe(false);
    expect(mealSharesSchema.safeParse({ breakfast: 23, lunch: 32, dinner: 30, snack: 15 }).success).toBe(false);
    expect(mealSharesSchema.safeParse({ breakfast: -5, lunch: 40, dinner: 50, snack: 15 }).success).toBe(false);
  });

  it('is accepted alone by settingsPatchSchema', () => {
    expect(settingsPatchSchema.safeParse({ mealShares: { breakfast: 20, lunch: 35, dinner: 35, snack: 10 } }).success).toBe(true);
  });
});
