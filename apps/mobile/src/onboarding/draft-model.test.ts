import { toProfileInput } from './to-profile-input';
import { computePreview } from './preview';
import {
  draftFromProfile,
  emptyDraft,
  heightCmOf,
  setHeightField,
  setWeightField,
  switchUnitSystem,
  weightKgOf,
  type OnboardingDraft,
} from './draft-model';
import { basicsErrors, lifestyleErrors } from './validation';

function typedMetric(): OnboardingDraft {
  let draft: OnboardingDraft = { ...emptyDraft(), age: '20', sex: 'male' };
  draft = setHeightField(draft, 'cm', '175');
  draft = setWeightField(draft, 'kg', '70');
  return draft;
}

describe('switchUnitSystem', () => {
  it('shows the converted values in the other unit', () => {
    const imperial = switchUnitSystem(typedMetric(), 'imperial');
    expect(imperial.unitSystem).toBe('imperial');
    expect(imperial.height).toMatchObject({ ft: '5', in: '9' });
    expect(imperial.weight.lb).toBe('154.3');
  });

  it('switching to imperial and back leaves the typed values untouched', () => {
    const start = typedMetric();
    const back = switchUnitSystem(switchUnitSystem(start, 'imperial'), 'metric');
    expect(back.height.cm).toBe('175');
    expect(back.weight.kg).toBe('70');
    expect(heightCmOf(back.height)).toBe(175);
    expect(weightKgOf(back.weight)).toBe(70);
  });

  it('does not drift over repeated round trips', () => {
    let draft = typedMetric();
    draft = setHeightField(draft, 'cm', '172');
    draft = setWeightField(draft, 'kg', '73.4');
    for (let i = 0; i < 5; i++) draft = switchUnitSystem(switchUnitSystem(draft, 'imperial'), 'metric');
    expect(draft.height.cm).toBe('172');
    expect(draft.weight.kg).toBe('73.4');
  });

  it('keeps imperial entries exact when going to metric and back', () => {
    let draft = switchUnitSystem(emptyDraft(), 'imperial');
    draft = setHeightField(setHeightField(draft, 'ft', '5'), 'in', '7');
    draft = setWeightField(draft, 'lb', '150');
    const back = switchUnitSystem(switchUnitSystem(draft, 'metric'), 'imperial');
    expect(back.height).toMatchObject({ ft: '5', in: '7' });
    expect(back.weight.lb).toBe('150');
  });

  it('leaves the other unit blank when the typed value is incomplete', () => {
    const imperial = switchUnitSystem(emptyDraft(), 'imperial');
    expect(imperial.height).toMatchObject({ ft: '', in: '' });
    expect(imperial.weight.lb).toBe('');
  });

  it('editing in the shown unit makes it the source of truth', () => {
    let draft = switchUnitSystem(typedMetric(), 'imperial');
    draft = setWeightField(draft, 'lb', '160');
    expect(draft.weight.source).toBe('imperial');
    expect(draft.height.source).toBe('metric');
    expect(weightKgOf(draft.weight)).toBeCloseTo(72.57, 2);
    expect(heightCmOf(draft.height)).toBe(175);
  });
});

describe('validation', () => {
  it('flags every missing basics field and accepts a complete one', () => {
    expect(Object.keys(basicsErrors(emptyDraft())).sort()).toEqual(['age', 'height', 'sex', 'weight']);
    expect(basicsErrors(typedMetric())).toEqual({});
  });

  it('rejects out-of-range numbers', () => {
    const bad = { ...typedMetric(), age: '12' };
    expect(basicsErrors(bad)).toEqual({ age: 'onboarding.error.age' });
    expect(basicsErrors({ ...typedMetric(), age: '20.5' })).toEqual({ age: 'onboarding.error.age' });
  });

  it('flags missing lifestyle answers', () => {
    expect(Object.keys(lifestyleErrors(emptyDraft())).sort()).toEqual(['activity', 'days', 'experience']);
  });
});

describe('computePreview', () => {
  it('is hidden until basics are complete', () => {
    expect(computePreview(emptyDraft())).toBeNull();
  });

  it('gives BMI only before an activity level is chosen', () => {
    const preview = computePreview(typedMetric());
    expect(preview?.hasTargets).toBe(false);
    expect(preview?.result.bmi).toBe(22.9);
  });

  it('matches the worked example: 70 kg / 175 cm / 20 y male, moderate activity, standard loss', () => {
    const preview = computePreview({ ...typedMetric(), activityLevel: 3 });
    expect(preview?.hasTargets).toBe(true);
    expect(preview?.result.status).toBe('safe');
    expect(preview?.result.targets).toMatchObject({ kcal: 2056, proteinG: 140 });
  });

  it('flags under-age as blocked', () => {
    const preview = computePreview({ ...typedMetric(), age: '17' });
    expect(preview?.result.status).toBe('blocked');
    expect(preview?.result.reasons).toContain('under_age');
  });
});

describe('draftFromProfile', () => {
  const saved = {
    age: 20,
    sex: 'male' as const,
    heightCm: 170.18,
    weightKg: 68.04,
    activityLevel: 3 as const,
    trainingDaysPerWeek: 4,
    trainingExperience: 'beginner' as const,
    goal: 'lose' as const,
    pace: 'aggressive' as const,
    healthFlags: { pregnantOrNursing: false, eatingDisorderHistory: false, medicalDiet: false },
    unitSystem: 'imperial' as const,
  };

  it('reopens an imperial profile in imperial units and rebuilds the same payload', () => {
    const draft = draftFromProfile(saved);
    expect(draft.height).toMatchObject({ source: 'imperial', ft: '5', in: '7' });
    expect(draft.weight).toMatchObject({ source: 'imperial', lb: '150' });
    const input = toProfileInput(draft, 'en');
    expect(input.heightCm).toBeCloseTo(saved.heightCm, 2);
    expect(input.weightKg).toBeCloseTo(saved.weightKg, 1);
    expect(input.pace).toBe('aggressive');
  });

  it('reopens a metric profile as typed', () => {
    const draft = draftFromProfile({ ...saved, unitSystem: 'metric', heightCm: 175, weightKg: 70 });
    expect(draft.height).toMatchObject({ source: 'metric', cm: '175' });
    expect(draft.weight).toMatchObject({ source: 'metric', kg: '70' });
  });
});
