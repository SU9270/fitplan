import {
  ACTIVITY_FACTORS,
  BMR_AGE_COEF,
  BMR_HEIGHT_COEF,
  BMR_WEIGHT_COEF,
  CM_PER_M,
  DAYS_PER_WEEK,
  GAIN_SURPLUS,
  KCAL_FLOOR,
  KCAL_PER_KG,
  LOSS_WEEKLY_PCT,
  MAX_DEFICIT_RATIO,
  SEX_CONSTANT,
} from './constants';
import type { ActivityLevel, Goal, Pace, Sex } from './types';

export function bmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / CM_PER_M;
  return weightKg / (heightM * heightM);
}

export function bmrKcal(sex: Sex, age: number, heightCm: number, weightKg: number): number {
  return (
    BMR_WEIGHT_COEF * weightKg +
    BMR_HEIGHT_COEF * heightCm -
    BMR_AGE_COEF * age +
    SEX_CONSTANT[sex]
  );
}

export function tdeeKcal(bmr: number, level: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[level];
}

export function calorieTarget(args: {
  goal: Goal;
  pace: Pace;
  tdee: number;
  bmr: number;
  weightKg: number;
  sex: Sex;
}): { kcal: number; raisedToFloor: boolean } {
  const { goal, pace, tdee, bmr, weightKg, sex } = args;

  let kcal: number;
  if (goal === 'lose') {
    const weeklyLossKg = weightKg * LOSS_WEEKLY_PCT[pace];
    const dailyDeficit = Math.min(
      (weeklyLossKg * KCAL_PER_KG) / DAYS_PER_WEEK,
      tdee * MAX_DEFICIT_RATIO,
    );
    kcal = tdee - dailyDeficit;
  } else {
    kcal = tdee * GAIN_SURPLUS[pace];
  }

  const floor = Math.max(bmr, KCAL_FLOOR[sex]);
  if (kcal < floor) {
    return { kcal: floor, raisedToFloor: true };
  }
  return { kcal, raisedToFloor: false };
}
