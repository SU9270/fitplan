import { setWeightField } from './draft-model';
import { initialState, onboardingReducer, type OnboardingState } from './draft-state';

const profile = {
  age: 30,
  sex: 'female' as const,
  heightCm: 165,
  weightKg: 60,
  activityLevel: 2 as const,
  trainingDaysPerWeek: 2,
  trainingExperience: 'beginner' as const,
  goal: 'gain' as const,
  pace: 'conservative' as const,
  healthFlags: { pregnantOrNursing: false, eatingDisorderHistory: false, medicalDiet: false },
  unitSystem: 'metric' as const,
};

const run = (state: OnboardingState, ...actions: Parameters<typeof onboardingReducer>[1][]) =>
  actions.reduce(onboardingReducer, state);

/** User A signed in, hydrated from a saved profile and typed something. */
function userAWithDraft(): OnboardingState {
  return run(
    initialState(),
    { type: 'user', userId: 'A' },
    { type: 'hydrate', profile, forUserId: 'A' },
    { type: 'update', update: (d) => setWeightField(d, 'kg', '99') },
    { type: 'submission', submission: { status: 'confirm', result: {} as never } },
  );
}

describe('onboardingReducer user keying', () => {
  it('claims the draft for the first signed-in user without wiping it', () => {
    const typed = run(initialState(), { type: 'update', update: (d) => ({ ...d, age: '25' }) });
    expect(run(typed, { type: 'user', userId: 'A' }).draft.age).toBe('25');
    expect(run(typed, { type: 'user', userId: 'A' }).ownerId).toBe('A');
  });

  it('keeps the draft when the same user signs back in (401 path)', () => {
    const a = userAWithDraft();
    const again = run(a, { type: 'user', userId: 'A' });
    expect(again).toBe(a);
    expect(again.draft.weight.kg).toBe('99');
    expect(again.consentRecorded).toBe(true);
  });

  it('gives a different user a clean state: draft, consent, hydration and submission', () => {
    const b = run(userAWithDraft(), { type: 'user', userId: 'B' });
    expect(b).toEqual(initialState('B'));
    expect(b.hydrated).toBe(false);
    expect(b.consentRecorded).toBe(false);
    expect(b.submission).toBeNull();
  });

  it('ignores a profile fetched for the previous user', () => {
    const b = run(userAWithDraft(), { type: 'user', userId: 'B' });
    const late = run(b, { type: 'hydrate', profile, forUserId: 'A' });
    expect(late).toBe(b);
    expect(late.hydrated).toBe(false);
  });

  it('lets the new user hydrate from their own profile', () => {
    const b = run(userAWithDraft(), { type: 'user', userId: 'B' }, { type: 'hydrate', profile: null, forUserId: 'B' });
    expect(b.hydrated).toBe(true);
    expect(b.draft.age).toBe('');
  });

  it('hydrates only once', () => {
    const a = userAWithDraft();
    expect(run(a, { type: 'hydrate', profile: null, forUserId: 'A' })).toBe(a);
  });

  it('reset (user-initiated sign-out) forgets the owner too, so a hydrate that races it is dropped', () => {
    const cleared = run(userAWithDraft(), { type: 'reset' });
    expect(cleared).toEqual(initialState());
    expect(run(cleared, { type: 'hydrate', profile, forUserId: 'A' })).toBe(cleared);
    // ...and whoever signs in next starts clean, even if it is A again.
    expect(run(cleared, { type: 'user', userId: 'A' })).toEqual(initialState('A'));
  });
});

describe('onboardingReducer edit (re-open the questionnaire from Today)', () => {
  const saved = { ...profile, weightKg: 58, pace: 'standard' as const };

  it('replaces the draft with the saved profile and clears the last submission', () => {
    const edited = run(userAWithDraft(), { type: 'edit', profile: saved, forUserId: 'A' });
    expect(edited.draft.weight.kg).toBe('58');
    expect(edited.draft.pace).toBe('standard');
    expect(edited.draft.consent).toBe(true);
    expect(edited.hydrated).toBe(true);
    expect(edited.consentRecorded).toBe(true);
    expect(edited.submission).toBeNull();
    expect(edited.ownerId).toBe('A');
  });

  it('works on a fresh launch too (not hydrated yet), so the layout does not refetch over it', () => {
    const fresh = run(initialState(), { type: 'user', userId: 'A' }, { type: 'edit', profile: saved, forUserId: 'A' });
    expect(fresh.hydrated).toBe(true);
    expect(fresh.draft.age).toBe('30');
    // A late first-load hydrate must not overwrite it.
    expect(run(fresh, { type: 'hydrate', profile: null, forUserId: 'A' })).toBe(fresh);
  });

  it("ignores a profile for someone who is no longer the draft's owner", () => {
    const b = run(userAWithDraft(), { type: 'user', userId: 'B' });
    expect(run(b, { type: 'edit', profile: saved, forUserId: 'A' })).toBe(b);
  });
});
