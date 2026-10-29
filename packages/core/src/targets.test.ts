import { describe, expect, it } from 'vitest';
import { computeTargets } from './targets';

const base = {
  age: 20,
  sex: 'male',
  heightCm: 175,
  weightKg: 70,
  activityLevel: 3,
  goal: 'lose',
  pace: 'standard',
  healthFlags: { pregnantOrNursing: false, eatingDisorderHistory: false, medicalDiet: false },
} as const;

describe('computeTargets', () => {
  it('safe case returns targets', () => {
    expect(computeTargets(base)).toMatchObject({
      status: 'safe',
      reasons: [],
      bmi: 22.9,
      bmrKcal: 1699,
      tdeeKcal: 2633,
      targets: { kcal: 2056, proteinG: 140, carbsG: 248, fatG: 56 },
      effectivePace: 'standard',
    });
  });

  it('blocks under 18', () => {
    const r = computeTargets({ ...base, age: 17 });
    expect(r.status).toBe('blocked');
    expect(r.reasons).toEqual(['under_age']);
    expect(r.targets).toBeNull();
    expect(r.bmrKcal).toBeGreaterThan(0);
    expect(r.tdeeKcal).toBeGreaterThan(0);
  });

  it('blocks loss below BMI 18.5 but allows gain', () => {
    const r = computeTargets({ ...base, heightCm: 170, weightKg: 53 });
    expect(r.status).toBe('blocked');
    expect(r.reasons).toEqual(['bmi_too_low_for_loss']);
    expect(r.targets).toBeNull();
    expect(computeTargets({ ...base, heightCm: 170, weightKg: 53, goal: 'gain' }).status).toBe('safe');
  });

  it('confirms aggressive pace, high BMI and floor', () => {
    const r = computeTargets({
      ...base,
      age: 30,
      heightCm: 180,
      weightKg: 120,
      activityLevel: 1,
      pace: 'aggressive',
    });
    expect(r.status).toBe('confirm');
    expect(r.reasons).toEqual(['aggressive_pace', 'high_bmi_consult', 'raised_to_floor']);
    expect(r.targets?.kcal).toBe(2180);
  });

  it('safe mode forces conservative loss', () => {
    const r = computeTargets({
      ...base,
      pace: 'aggressive',
      healthFlags: { ...base.healthFlags, medicalDiet: true },
    });
    expect(r).toMatchObject({ status: 'confirm', reasons: ['safe_mode'], effectivePace: 'conservative' });
  });

  it('safe mode keeps gain pace', () => {
    const r = computeTargets({
      ...base,
      goal: 'gain',
      healthFlags: { ...base.healthFlags, pregnantOrNursing: true },
    });
    expect(r).toMatchObject({ status: 'confirm', reasons: ['safe_mode'], effectivePace: 'standard' });
  });

  it('safe mode keeps aggressive gain pace and flags it', () => {
    const r = computeTargets({
      ...base,
      goal: 'gain',
      pace: 'aggressive',
      healthFlags: { ...base.healthFlags, eatingDisorderHistory: true },
    });
    expect(r.reasons).toEqual(['safe_mode', 'aggressive_pace']);
    expect(r.effectivePace).toBe('aggressive');
  });

  it('keeps safe_mode alongside blocking reasons', () => {
    const r = computeTargets({
      ...base,
      age: 17,
      healthFlags: { ...base.healthFlags, medicalDiet: true },
    });
    expect(r.status).toBe('blocked');
    expect(r.reasons).toEqual(['safe_mode', 'under_age']);
    expect(r.targets).toBeNull();
  });

  it('flags a gain target raised to the floor', () => {
    // male, 80y, 150cm, 45kg, activity 1, gain, conservative.
    // BMR = 10*45 + 6.25*150 - 5*80 + 5 = 450 + 937.5 - 400 + 5 = 992.5
    // TDEE = 992.5 * 1.2 = 1191; gain kcal = 1191 * 1.05 = 1250.55
    // floor = max(BMR 992.5, male 1500) = 1500 -> 1250.55 < 1500, raised to 1500.
    // (A 60y/160cm/50kg male would give 1518.3 and NOT be raised.)
    const r = computeTargets({
      ...base,
      age: 80,
      heightCm: 150,
      weightKg: 45,
      activityLevel: 1,
      goal: 'gain',
      pace: 'conservative',
    });
    expect(r.status).toBe('confirm');
    expect(r.reasons).toContain('raised_to_floor');
    expect(r.reasons).toEqual(['raised_to_floor']);
    expect(r.targets?.kcal).toBe(1500);
  });
});
