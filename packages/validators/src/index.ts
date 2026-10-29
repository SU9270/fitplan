import { z } from 'zod';
import type {
  ActivityLevel,
  Goal,
  HealthFlags,
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
