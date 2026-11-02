import { z } from 'zod';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];
export const mealSchema = z.enum(MEALS);

/** Upper bound for one diary entry, after a portion × quantity is resolved to grams. */
export const MAX_ENTRY_GRAMS = 5000;
/** Earliest date a diary entry may be logged for. */
export const MIN_DIARY_DATE = '2000-01-01';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written as `YYYY-MM-DD` (rejects 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * The user's local date. Only the shape and range are checked here; "not after tomorrow (UTC)"
 * depends on the clock and is checked by the server (`isDateWithinLogWindow`).
 */
export const isoDateSchema = z
  .string()
  .refine(isCalendarDate, { message: 'invalid_date' })
  .refine((v) => v >= MIN_DIARY_DATE, { message: 'date_out_of_range' });

/**
 * A diary date may be at most one day after the server's UTC date: a user west of UTC is
 * still on "yesterday", one east of it may already be on "tomorrow".
 */
export function isDateWithinLogWindow(date: string, now: Date): boolean {
  const tomorrow = new Date(now.getTime());
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return date <= tomorrow.toISOString().slice(0, 10);
}

/** Query string of GET /api/foods (values arrive as strings). */
export const foodSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type FoodSearchQuery = z.infer<typeof foodSearchQuerySchema>;

const gramsPerServing = z.number().gt(0).max(2000);
const macroGrams = z.number().min(0).max(1000);

/** A custom food as written on a nutrition label: values per serving of `servingGrams` g. */
export const customFoodInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    /** e.g. "1 bar", "1 包"; null → the app shows a generic "1 serving". */
    servingLabel: z.string().trim().min(1).max(40).nullable().default(null),
    servingGrams: gramsPerServing,
    kcal: z.number().min(0).max(5000),
    proteinG: macroGrams,
    carbsG: macroGrams,
    fatG: macroGrams,
  })
  .refine((f) => f.proteinG + f.carbsG + f.fatG <= f.servingGrams, {
    message: 'macros_exceed_serving',
    path: ['servingGrams'],
  });
export type CustomFoodInput = z.infer<typeof customFoodInputSchema>;

const foodId = z.string().min(1).max(64);
/** `portionId: null` → `quantity` is grams; otherwise grams = portion grams × quantity. */
const portionId = z.string().min(1).max(64).nullable();
const quantity = z.number().gt(0).max(MAX_ENTRY_GRAMS);

export const diaryEntryInputSchema = z.object({
  date: isoDateSchema,
  meal: mealSchema,
  foodId,
  portionId,
  quantity,
});
export type DiaryEntryInput = z.infer<typeof diaryEntryInputSchema>;

/** Change the meal and/or the amount. The amount is `portionId` + `quantity`, always together. */
export const diaryEntryPatchSchema = z
  .object({
    meal: mealSchema.optional(),
    portionId: portionId.optional(),
    quantity: quantity.optional(),
  })
  .refine((p) => (p.portionId === undefined) === (p.quantity === undefined), {
    message: 'portion_and_quantity_together',
    path: ['quantity'],
  })
  .refine((p) => p.meal !== undefined || p.quantity !== undefined, {
    message: 'nothing_to_update',
    path: ['_root'],
  });
export type DiaryEntryPatch = z.infer<typeof diaryEntryPatchSchema>;
