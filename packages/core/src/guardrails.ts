import { CONSULT_BMI, MIN_AGE, MIN_BMI_FOR_LOSS } from './constants';
import type { Goal, GuardrailReason, HealthFlags, Pace } from './types';

/** Any health flag switches the app into safe mode. */
export function isSafeMode(flags: HealthFlags): boolean {
  return flags.pregnantOrNursing || flags.eatingDisorderHistory || flags.medicalDiet;
}

/** Safe mode forces a conservative pace when losing; gaining keeps the requested pace. */
export function effectivePace(goal: Goal, pace: Pace, safeMode: boolean): Pace {
  return safeMode && goal === 'lose' ? 'conservative' : pace;
}

/** Reasons that make a plan impossible. Uses the unrounded BMI. */
export function blockingReasons(args: { age: number; goal: Goal; bmi: number }): GuardrailReason[] {
  const reasons: GuardrailReason[] = [];
  if (args.age < MIN_AGE) reasons.push('under_age');
  if (args.goal === 'lose' && args.bmi < MIN_BMI_FOR_LOSS) reasons.push('bmi_too_low_for_loss');
  return reasons;
}

/** Reasons that require user confirmation. Uses the unrounded BMI. */
export function confirmReasons(args: {
  pace: Pace;
  bmi: number;
  raisedToFloor: boolean;
}): GuardrailReason[] {
  const reasons: GuardrailReason[] = [];
  if (args.pace === 'aggressive') reasons.push('aggressive_pace');
  if (args.bmi >= CONSULT_BMI) reasons.push('high_bmi_consult');
  if (args.raisedToFloor) reasons.push('raised_to_floor');
  return reasons;
}
