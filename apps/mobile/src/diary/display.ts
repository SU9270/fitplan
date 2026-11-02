import { NUTRIENT_BASIS_G, sumNutrients, type NutrientTotals, type Nutrients } from '@fitplan/core';
import { MEALS, type Meal } from '@fitplan/validators';
import type { Locale } from '../i18n';

/** In Chinese the curated Chinese name when there is one; otherwise (and in English) the food's own name. */
export function displayName(item: { name: string; nameZh: string | null }, locale: Locale): string {
  return locale === 'zh' && item.nameZh ? item.nameZh : item.name;
}

/** Per-100 g values behind what an entry's grams contain (the snapshot the server scales). */
export function per100gOf(nutrients: Nutrients, grams: number): Nutrients {
  const per = (v: number | null) => (v === null ? null : (v * NUTRIENT_BASIS_G) / grams);
  return {
    kcal: per(nutrients.kcal),
    proteinG: per(nutrients.proteinG),
    carbsG: per(nutrients.carbsG),
    fatG: per(nutrients.fatG),
  };
}

export interface MealGroup<E> {
  meal: Meal;
  entries: E[];
  /** Rounded from the unrounded entries, like the day total. */
  subtotal: NutrientTotals;
}

/** Entries grouped into breakfast → lunch → dinner → snack, each in logging order. */
export function groupByMeal<E extends { meal: Meal; nutrients: Nutrients }>(entries: readonly E[]): MealGroup<E>[] {
  return MEALS.map((meal) => {
    const inMeal = entries.filter((e) => e.meal === meal);
    return { meal, entries: inMeal, subtotal: sumNutrients(inMeal.map((e) => e.nutrients)) };
  });
}

/** Share of a target reached, clamped to 0..1 for a progress bar (0 when there is no target). */
export function progress(eaten: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, eaten / target));
}

export type EntryAmount = { kind: 'grams'; grams: number } | { kind: 'portion'; quantity: number; label: string | null };

/**
 * How an entry's amount reads: "1.5 × 1 cup" when it was logged by portion, else grams. An
 * entry logged with a custom food's unnamed serving whose food was then deleted has neither a
 * label nor a portion any more, so it falls back to grams.
 */
export function entryAmount(entry: { portionId: string | null; portionLabel: string | null; quantity: number; grams: number }): EntryAmount {
  if (entry.portionLabel !== null || entry.portionId !== null) {
    return { kind: 'portion', quantity: entry.quantity, label: entry.portionLabel };
  }
  return { kind: 'grams', grams: entry.grams };
}
