import { profileInputSchema } from '@fitplan/validators';
import { emptyDraft, type OnboardingDraft } from './draft-model';
import { toProfileInput } from './to-profile-input';

const complete: OnboardingDraft = {
  ...emptyDraft(),
  age: '20',
  sex: 'male',
  activityLevel: 3,
  trainingDaysPerWeek: 4,
  trainingExperience: 'intermediate',
  consent: true,
};

const metric: OnboardingDraft = {
  ...complete,
  unitSystem: 'metric',
  height: { source: 'metric', cm: '175', ft: '', in: '' },
  weight: { source: 'metric', kg: '70', lb: '' },
};

const imperial: OnboardingDraft = {
  ...complete,
  unitSystem: 'imperial',
  height: { source: 'imperial', cm: '', ft: '5', in: '7' },
  weight: { source: 'imperial', kg: '', lb: '150' },
};

describe('toProfileInput', () => {
  it('converts imperial draft to metric', () => {
    const input = toProfileInput(imperial, 'en');
    expect(input.heightCm).toBeCloseTo(170.18, 2);
    expect(input.weightKg).toBeCloseTo(68.04, 2);
    expect(input.unitSystem).toBe('imperial');
  });

  it('passes metric draft unchanged', () => {
    const input = toProfileInput(metric, 'zh');
    expect(input).toEqual({
      age: 20,
      sex: 'male',
      heightCm: 175,
      weightKg: 70,
      activityLevel: 3,
      trainingDaysPerWeek: 4,
      trainingExperience: 'intermediate',
      goal: 'lose',
      pace: 'standard',
      healthFlags: { pregnantOrNursing: false, eatingDisorderHistory: false, medicalDiet: false },
      unitSystem: 'metric',
      locale: 'zh',
      confirmed: false,
    });
  });

  it('output satisfies profileInputSchema', () => {
    for (const draft of [metric, imperial]) {
      const parsed = profileInputSchema.safeParse(toProfileInput(draft, 'en'));
      expect(parsed.success).toBe(true);
    }
  });

  it('uses the typed values even while the other unit is shown', () => {
    // 175 cm typed, then the switch flipped to imperial: the derived 5′9″ must not leak in.
    const flipped: OnboardingDraft = {
      ...metric,
      unitSystem: 'imperial',
      height: { source: 'metric', cm: '175', ft: '5', in: '9' },
      weight: { source: 'metric', kg: '70', lb: '154.3' },
    };
    const input = toProfileInput(flipped, 'en');
    expect(input.heightCm).toBe(175);
    expect(input.weightKg).toBe(70);
  });

  it('throws when the draft is incomplete', () => {
    expect(() => toProfileInput(emptyDraft(), 'en')).toThrow();
    expect(() => toProfileInput({ ...metric, sex: null }, 'en')).toThrow();
    expect(() => toProfileInput({ ...metric, weight: { source: 'metric', kg: 'abc', lb: '' } }, 'en')).toThrow();
  });
});
