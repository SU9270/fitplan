import type { ActivityLevel, Goal, Pace, Sex } from './types';

// Mifflin-St Jeor: BMR = 10*kg + 6.25*cm - 5*age + sexConstant
export const BMR_WEIGHT_COEF = 10;
export const BMR_HEIGHT_COEF = 6.25;
export const BMR_AGE_COEF = 5;

export const SEX_CONSTANT: Record<Sex, number> = {
  male: 5,
  female: -161,
  unspecified: -78,
};

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  1: 1.2,
  2: 1.375,
  3: 1.55,
  4: 1.725,
  5: 1.9,
};

/** Weekly body-weight loss as a fraction of current weight. */
export const LOSS_WEEKLY_PCT: Record<Pace, number> = {
  conservative: 0.005,
  standard: 0.0075,
  aggressive: 0.01,
};

/** TDEE multiplier when gaining. */
export const GAIN_SURPLUS: Record<Pace, number> = {
  conservative: 1.05,
  standard: 1.1,
  aggressive: 1.15,
};

export const KCAL_PER_KG = 7700;
export const DAYS_PER_WEEK = 7;
export const MAX_DEFICIT_RATIO = 0.25;

/** Minimum daily kcal; the effective floor is max(BMR, this value). */
export const KCAL_FLOOR: Record<Sex, number> = {
  male: 1500,
  female: 1200,
  unspecified: 1350,
};

export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose: 2.0,
  gain: 1.8,
};
export const FAT_MIN_G_PER_KG = 0.8;
export const FAT_MIN_KCAL_RATIO = 0.2;

export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_CARBS = 4;
export const KCAL_PER_G_FAT = 9;

export const CM_PER_M = 100;

// Safety thresholds
export const MIN_AGE = 18;
export const MIN_BMI_FOR_LOSS = 18.5;
export const CONSULT_BMI = 35;

/** BMI is reported with 1 decimal: round(x * 10) / 10. */
export const BMI_ROUND_FACTOR = 10;
