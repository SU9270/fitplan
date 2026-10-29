import { profileInputSchema, type ProfileInput } from '@fitplan/validators';
import type { Locale } from '../i18n';
import { heightCmOf, parseNumber, weightKgOf, type OnboardingDraft } from './draft-model';

/** The profile payload for a draft, or `null` while any answer is missing or out of range. Always `confirmed: false`. */
export function tryToProfileInput(draft: OnboardingDraft, locale: Locale): ProfileInput | null {
  const { sex, activityLevel, trainingDaysPerWeek, trainingExperience } = draft;
  if (sex === null || activityLevel === null || trainingDaysPerWeek === null || trainingExperience === null) {
    return null;
  }
  const parsed = profileInputSchema.safeParse({
    age: parseNumber(draft.age),
    sex,
    // The only place that converts: the typed unit goes in, metric comes out.
    heightCm: heightCmOf(draft.height),
    weightKg: weightKgOf(draft.weight),
    activityLevel,
    trainingDaysPerWeek,
    trainingExperience,
    goal: draft.goal,
    pace: draft.pace,
    healthFlags: { ...draft.healthFlags },
    unitSystem: draft.unitSystem,
    locale,
    confirmed: false,
  });
  return parsed.success ? parsed.data : null;
}

/** Same as `tryToProfileInput`, for callers that have already checked the draft is complete. */
export function toProfileInput(draft: OnboardingDraft, locale: Locale): ProfileInput {
  const input = tryToProfileInput(draft, locale);
  if (input === null) throw new Error('Onboarding draft is incomplete or out of range');
  return input;
}
