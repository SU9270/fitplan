import { computeTargets, type TargetResult } from '@fitplan/core';
import type { OnboardingDraft } from './draft-model';
import { parseNumber, heightCmOf, weightKgOf } from './draft-model';
import { basicsErrors, hasErrors } from './validation';

/** Activity level used only to get BMI and the blocking checks before the user has picked one. */
const PLACEHOLDER_ACTIVITY = 1;

export interface Preview {
  /** False until the lifestyle step: only BMI and the blocking checks are meaningful then. */
  hasTargets: boolean;
  result: TargetResult;
}

/**
 * Local preview with core's `computeTargets` (the server recomputes on save and wins).
 * `null` until the basics step is complete.
 */
export function computePreview(draft: OnboardingDraft): Preview | null {
  if (hasErrors(basicsErrors(draft)) || draft.sex === null) return null;
  const hasTargets = draft.activityLevel !== null;
  const result = computeTargets({
    age: parseNumber(draft.age),
    sex: draft.sex,
    heightCm: heightCmOf(draft.height),
    weightKg: weightKgOf(draft.weight),
    activityLevel: draft.activityLevel ?? PLACEHOLDER_ACTIVITY,
    goal: draft.goal,
    pace: draft.pace,
    healthFlags: { ...draft.healthFlags },
  });
  return { hasTargets, result };
}
