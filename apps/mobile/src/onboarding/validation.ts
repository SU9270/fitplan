import { profileInputSchema } from '@fitplan/validators';
import type { MessageKey } from '../i18n';
import { heightCmOf, parseNumber, weightKgOf, type OnboardingDraft } from './draft-model';

const fields = profileInputSchema.shape;

export type StepErrors<K extends string> = Partial<Record<K, MessageKey>>;

/** Per-field problems on the basics step. An empty object means the step is complete. */
export function basicsErrors(draft: OnboardingDraft): StepErrors<'age' | 'sex' | 'height' | 'weight'> {
  const errors: StepErrors<'age' | 'sex' | 'height' | 'weight'> = {};
  if (!fields.age.safeParse(parseNumber(draft.age)).success) errors.age = 'onboarding.error.age';
  if (draft.sex === null) errors.sex = 'onboarding.error.sex';
  if (!fields.heightCm.safeParse(heightCmOf(draft.height)).success) errors.height = 'onboarding.error.height';
  if (!fields.weightKg.safeParse(weightKgOf(draft.weight)).success) errors.weight = 'onboarding.error.weight';
  return errors;
}

export function lifestyleErrors(draft: OnboardingDraft): StepErrors<'activity' | 'days' | 'experience'> {
  const errors: StepErrors<'activity' | 'days' | 'experience'> = {};
  if (draft.activityLevel === null) errors.activity = 'onboarding.error.activity';
  if (draft.trainingDaysPerWeek === null) errors.days = 'onboarding.error.days';
  if (draft.trainingExperience === null) errors.experience = 'onboarding.error.experience';
  return errors;
}

export const hasErrors = (errors: object): boolean => Object.keys(errors).length > 0;
