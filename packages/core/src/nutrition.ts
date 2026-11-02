import { NUTRIENT_BASIS_G } from './constants';
import type { NutrientKey, NutrientTotals, Nutrients } from './types';

export const NUTRIENT_KEYS = ['kcal', 'proteinG', 'carbsG', 'fatG'] as const satisfies readonly NutrientKey[];

function mapNutrients(n: Nutrients, f: (value: number) => number): Nutrients {
  return {
    kcal: n.kcal === null ? null : f(n.kcal),
    proteinG: n.proteinG === null ? null : f(n.proteinG),
    carbsG: n.carbsG === null ? null : f(n.carbsG),
    fatG: n.fatG === null ? null : f(n.fatG),
  };
}

/** Nutrients in `grams` of a food given per 100 g. Unknown stays unknown; nothing is rounded. */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  return mapNutrients(per100g, (v) => (v * grams) / NUTRIENT_BASIS_G);
}

/** A nutrition label (values per serving of `servingG` grams) → values per 100 g. Not rounded. */
export function per100gFromServing(perServing: Nutrients, servingG: number): Nutrients {
  return mapNutrients(perServing, (v) => (v * NUTRIENT_BASIS_G) / servingG);
}

/** Sums unrounded values and rounds only the result; unknown values count as 0 and are reported. */
export function sumNutrients(items: readonly Nutrients[]): NutrientTotals {
  const sums = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const unknown = new Set<NutrientKey>();
  for (const item of items) {
    for (const key of NUTRIENT_KEYS) {
      const value = item[key];
      if (value === null) unknown.add(key);
      else sums[key] += value;
    }
  }
  return {
    totals: {
      kcal: Math.round(sums.kcal),
      proteinG: Math.round(sums.proteinG),
      carbsG: Math.round(sums.carbsG),
      fatG: Math.round(sums.fatG),
    },
    unknown: NUTRIENT_KEYS.filter((key) => unknown.has(key)),
  };
}
