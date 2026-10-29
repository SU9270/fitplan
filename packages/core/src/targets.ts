import { BMI_ROUND_FACTOR } from './constants';
import { bmi, bmrKcal, calorieTarget, tdeeKcal } from './energy';
import { blockingReasons, confirmReasons, effectivePace, isSafeMode } from './guardrails';
import { macroTargets } from './macros';
import type { GuardrailReason, TargetInput, TargetResult } from './types';

export function computeTargets(input: TargetInput): TargetResult {
  const { age, sex, heightCm, weightKg, activityLevel, goal, pace, healthFlags } = input;

  const rawBmi = bmi(weightKg, heightCm);
  const rawBmr = bmrKcal(sex, age, heightCm, weightKg);
  const rawTdee = tdeeKcal(rawBmr, activityLevel);

  const safeMode = isSafeMode(healthFlags);
  const finalPace = effectivePace(goal, pace, safeMode);
  const safeReasons: GuardrailReason[] = safeMode ? ['safe_mode'] : [];

  const base = {
    bmi: Math.round(rawBmi * BMI_ROUND_FACTOR) / BMI_ROUND_FACTOR,
    bmrKcal: Math.round(rawBmr),
    tdeeKcal: Math.round(rawTdee),
    effectivePace: finalPace,
  };

  const blocking = blockingReasons({ age, goal, bmi: rawBmi });
  if (blocking.length > 0) {
    return { ...base, status: 'blocked', reasons: [...safeReasons, ...blocking], targets: null };
  }

  const { kcal, raisedToFloor } = calorieTarget({
    goal,
    pace: finalPace,
    tdee: rawTdee,
    bmr: rawBmr,
    weightKg,
    sex,
  });
  const confirm = confirmReasons({ pace: finalPace, bmi: rawBmi, raisedToFloor });
  const reasons = [...safeReasons, ...confirm];

  return {
    ...base,
    status: reasons.length > 0 ? 'confirm' : 'safe',
    reasons,
    targets: macroTargets(kcal, weightKg, goal),
  };
}
