export type Sex = 'male' | 'female' | 'unspecified';
export type Goal = 'lose' | 'gain';
export type Pace = 'conservative' | 'standard' | 'aggressive';
export type ActivityLevel = 1 | 2 | 3 | 4 | 5;

export interface MacroTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface HealthFlags {
  pregnantOrNursing: boolean;
  eatingDisorderHistory: boolean;
  medicalDiet: boolean;
}

export interface TargetInput {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  pace: Pace;
  healthFlags: HealthFlags;
}

export type GuardrailReason =
  | 'under_age'
  | 'bmi_too_low_for_loss'
  | 'aggressive_pace'
  | 'high_bmi_consult'
  | 'raised_to_floor'
  | 'safe_mode';

export type TargetStatus = 'safe' | 'confirm' | 'blocked';

export interface TargetResult {
  status: TargetStatus;
  reasons: GuardrailReason[];
  bmi: number;
  bmrKcal: number;
  tdeeKcal: number;
  targets: MacroTargets | null;
  effectivePace: Pace;
}
