import { z } from 'zod';
import { MEAL_SHARE_STEP, MEAL_SHARES_TOTAL } from '@fitplan/core';
import type {
  ActivityLevel,
  Goal,
  HealthFlags,
  MealShares,
  Pace,
  Sex,
  TargetInput,
} from '@fitplan/core';

/** Version of the health-data consent text the user agrees to. */
export const CONSENT_VERSION = '2026-10-29';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
/** Compile-time check: fails typecheck if a Zod schema drifts from core's type. */
function assertSameType<_A, _B>(_proof: Equal<_A, _B>): void {}

const sexSchema = z.enum(['male', 'female', 'unspecified']);
const goalSchema = z.enum(['lose', 'gain']);
const paceSchema = z.enum(['conservative', 'standard', 'aggressive']);
const activityLevelSchema = z.literal([1, 2, 3, 4, 5]);
const healthFlagsSchema = z.object({
  pregnantOrNursing: z.boolean(),
  eatingDisorderHistory: z.boolean(),
  medicalDiet: z.boolean(),
});

assertSameType<z.infer<typeof sexSchema>, Sex>(true);
assertSameType<z.infer<typeof goalSchema>, Goal>(true);
assertSameType<z.infer<typeof paceSchema>, Pace>(true);
assertSameType<z.infer<typeof activityLevelSchema>, ActivityLevel>(true);
assertSameType<z.infer<typeof healthFlagsSchema>, HealthFlags>(true);

export const profileInputSchema = z.object({
  // 13 (not 18) on purpose: a minor must pass validation so core's guardrail
  // can block them with a friendly reason.
  age: z.number().int().min(13).max(100),
  sex: sexSchema,
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(300),
  activityLevel: activityLevelSchema,
  trainingDaysPerWeek: z.number().int().min(0).max(7),
  trainingExperience: z.enum(['beginner', 'intermediate', 'advanced']),
  goal: goalSchema,
  pace: paceSchema,
  healthFlags: healthFlagsSchema,
  unitSystem: z.enum(['metric', 'imperial']),
  locale: z.enum(['zh', 'en']),
  confirmed: z.boolean().default(false),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export const consentInputSchema = z.object({
  kind: z.literal('health_data'),
  version: z.string().min(1),
  granted: z.boolean(),
});

export type ConsentInput = z.infer<typeof consentInputSchema>;

const mealShare = z.number().int().min(0).max(MEAL_SHARES_TOTAL).multipleOf(MEAL_SHARE_STEP);

/** How the daily targets are split over the meals (whole percent, steps of 5, total 100). */
export const mealSharesSchema = z
  .object({ breakfast: mealShare, lunch: mealShare, dinner: mealShare, snack: mealShare })
  .refine((s) => s.breakfast + s.lunch + s.dinner + s.snack === MEAL_SHARES_TOTAL, {
    message: 'shares_must_total_100',
    path: ['_root'],
  });

assertSameType<z.infer<typeof mealSharesSchema>, MealShares>(true);

/** PATCH /api/me/settings: preferences that never change the daily targets. */
export const settingsPatchSchema = z
  .object({
    unitSystem: profileInputSchema.shape.unitSystem.optional(),
    locale: profileInputSchema.shape.locale.optional(),
    mealShares: mealSharesSchema.optional(),
  })
  .refine((s) => s.unitSystem !== undefined || s.locale !== undefined || s.mealShares !== undefined, {
    message: 'nothing_to_update',
    path: ['_root'],
  });

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/** The display name (Better Auth's `user.name`), changed on the profile page. */
export const NICKNAME_MAX_LENGTH = 40;
export const nicknameSchema = z.string().trim().min(1).max(NICKNAME_MAX_LENGTH);

/** Keep only the fields core's target calculation consumes. */
export function toTargetInput(p: ProfileInput): TargetInput {
  return {
    age: p.age,
    sex: p.sex,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    activityLevel: p.activityLevel,
    goal: p.goal,
    pace: p.pace,
    healthFlags: { ...p.healthFlags },
  };
}

export * from './food';
