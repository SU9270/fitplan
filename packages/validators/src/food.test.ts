import { describe, expect, it } from 'vitest';
import {
  customFoodInputSchema,
  diaryCopyInputSchema,
  diaryEntryInputSchema,
  diaryEntryPatchSchema,
  foodSearchQuerySchema,
  isCalendarDate,
  isDateWithinLogWindow,
  mealTemplateInputSchema,
  quickAddInputSchema,
} from './food';

type Schema = { safeParse(v: unknown): { success: boolean; error?: { issues: { path: PropertyKey[] }[] } } };

function failingPaths(schema: Schema, input: unknown): string[] {
  const r = schema.safeParse(input);
  // One entry per failing field (a refinement may report a field that already failed).
  return r.success ? [] : [...new Set((r.error?.issues ?? []).map((i) => i.path.map(String).join('.')))];
}

describe('isCalendarDate', () => {
  it('accepts real dates only', () => {
    expect(isCalendarDate('2026-11-02')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2026-1-2')).toBe(false);
    expect(isCalendarDate('2026-11-02T00:00:00Z')).toBe(false);
  });
});

describe('isDateWithinLogWindow', () => {
  const now = new Date('2026-11-02T23:30:00Z');
  it('allows up to one day after the UTC date', () => {
    expect(isDateWithinLogWindow('2026-11-01', now)).toBe(true);
    expect(isDateWithinLogWindow('2026-11-03', now)).toBe(true);
    expect(isDateWithinLogWindow('2026-11-04', now)).toBe(false);
  });
  it('rolls over month ends', () => {
    expect(isDateWithinLogWindow('2026-12-01', new Date('2026-11-30T12:00:00Z'))).toBe(true);
  });
});

describe('foodSearchQuerySchema', () => {
  it('trims and coerces the limit', () => {
    expect(foodSearchQuerySchema.parse({ q: '  鸡胸 ', limit: '5' })).toEqual({ q: '鸡胸', limit: 5 });
    expect(foodSearchQuerySchema.parse({ q: 'rice' }).limit).toBe(20);
  });
  it('rejects empty queries and out-of-range limits', () => {
    expect(failingPaths(foodSearchQuerySchema, { q: '   ' })).toEqual(['q']);
    expect(failingPaths(foodSearchQuerySchema, { q: 'rice', limit: '51' })).toEqual(['limit']);
    expect(failingPaths(foodSearchQuerySchema, { q: 'rice', limit: 'abc' })).toEqual(['limit']);
  });
});

describe('customFoodInputSchema', () => {
  const bar = { name: ' Protein bar ', servingLabel: '1 bar', servingGrams: 60, kcal: 210, proteinG: 20, carbsG: 24, fatG: 7 };

  it('accepts a nutrition label and trims the name', () => {
    expect(customFoodInputSchema.parse(bar).name).toBe('Protein bar');
    expect(customFoodInputSchema.parse({ ...bar, servingLabel: undefined }).servingLabel).toBeNull();
  });

  it('rejects empty names, zero servings and negative values', () => {
    expect(failingPaths(customFoodInputSchema, { ...bar, name: ' ', servingGrams: 0, fatG: -1 }).sort()).toEqual([
      'fatG',
      'name',
      'servingGrams',
    ]);
  });

  it('rejects macros heavier than the serving', () => {
    expect(failingPaths(customFoodInputSchema, { ...bar, servingGrams: 40 })).toEqual(['servingGrams']);
  });
});

describe('diaryEntryInputSchema', () => {
  const entry = { date: '2026-11-02', meal: 'lunch', foodId: 'usda-171477', portionId: null, quantity: 150 };

  it('accepts grams (portionId null) or a portion', () => {
    expect(diaryEntryInputSchema.safeParse(entry).success).toBe(true);
    expect(diaryEntryInputSchema.safeParse({ ...entry, portionId: 'p1', quantity: 1.5 }).success).toBe(true);
  });

  it('rejects impossible dates, unknown meals and bad quantities', () => {
    expect(
      failingPaths(diaryEntryInputSchema, { ...entry, date: '2026-02-30', meal: 'brunch', quantity: 0 }).sort(),
    ).toEqual(['date', 'meal', 'quantity']);
    expect(failingPaths(diaryEntryInputSchema, { ...entry, date: '1999-12-31' })).toEqual(['date']);
    expect(failingPaths(diaryEntryInputSchema, { ...entry, quantity: 5001 })).toEqual(['quantity']);
  });

  it('requires portionId to be present (null for grams)', () => {
    const { portionId: _omit, ...withoutPortion } = entry;
    expect(failingPaths(diaryEntryInputSchema, withoutPortion)).toEqual(['portionId']);
  });
});

describe('diaryEntryPatchSchema', () => {
  it('accepts a meal change or an amount change', () => {
    expect(diaryEntryPatchSchema.safeParse({ meal: 'snack' }).success).toBe(true);
    expect(diaryEntryPatchSchema.safeParse({ portionId: null, quantity: 80 }).success).toBe(true);
  });

  it('needs portionId and quantity together, and something to change', () => {
    expect(failingPaths(diaryEntryPatchSchema, { quantity: 80 })).toEqual(['quantity']);
    expect(failingPaths(diaryEntryPatchSchema, {})).toEqual(['_root']);
  });
});

describe('quickAddInputSchema', () => {
  const quick = { date: '2026-11-03', meal: 'snack', kcal: 250 };

  it('needs only kcal; name defaults to empty and macros to unknown', () => {
    expect(quickAddInputSchema.parse(quick)).toEqual({ ...quick, name: '', proteinG: null, carbsG: null, fatG: null });
    expect(quickAddInputSchema.parse({ ...quick, name: ' 奶茶 ', proteinG: 3 })).toMatchObject({ name: '奶茶', proteinG: 3 });
  });

  it('rejects missing or out-of-range kcal and negative macros', () => {
    expect(failingPaths(quickAddInputSchema, { date: '2026-11-03', meal: 'snack' })).toEqual(['kcal']);
    expect(failingPaths(quickAddInputSchema, { ...quick, kcal: 5001, fatG: -1 }).sort()).toEqual(['fatG', 'kcal']);
  });
});

describe('diaryCopyInputSchema / mealTemplateInputSchema', () => {
  it('accept a day or a single meal, and need a template name', () => {
    expect(diaryCopyInputSchema.safeParse({ fromDate: '2026-11-02', toDate: '2026-11-03' }).success).toBe(true);
    expect(diaryCopyInputSchema.safeParse({ fromDate: '2026-11-02', toDate: '2026-11-03', meal: 'lunch' }).success).toBe(true);
    expect(failingPaths(diaryCopyInputSchema, { fromDate: '2026-02-30', toDate: '2026-11-03', meal: 'brunch' }).sort()).toEqual([
      'fromDate',
      'meal',
    ]);
    expect(failingPaths(mealTemplateInputSchema, { name: '  ', date: '2026-11-03', meal: 'lunch' })).toEqual(['name']);
  });
});
