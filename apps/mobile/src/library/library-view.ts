import type { LibraryGroup } from '@fitplan/core';
import type { Meal } from '@fitplan/validators';
import type { Locale, MessageKey } from '../i18n';
import { formatNumber } from '../diary/amount';

/** The fields of a library food the grid uses (see GET /api/foods/library). */
export interface LibraryTileFood {
  key: string;
  name: string;
  nameZh: string | null;
  per100g: { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null };
  fiberG: number | null;
  omega3AlaG: number | null;
  omega3EpaDhaG: number | null;
}

/** The meal a food picked now most likely belongs to (the food screen can change it). */
export function mealAt(now: Date): Meal {
  const hour = now.getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 17) return 'snack';
  if (hour < 21) return 'dinner';
  return 'snack';
}

/**
 * The grid's short name: the Chinese name without its note in brackets (鸡胸肉（烤）→ 鸡胸肉);
 * in English the image key spelled out (USDA names are long: "Chicken, broilers or fryers, …").
 */
export function shortName(food: Pick<LibraryTileFood, 'key' | 'nameZh'>, locale: Locale): string {
  if (locale === 'zh' && food.nameZh) return food.nameZh.replace(/（[^）]*）$/, '').trim() || food.nameZh;
  const words = food.key.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The value shown under a food in a group: the nutrient the group is about, per 100 g. */
export function groupValue(food: LibraryTileFood, group: LibraryGroup): { key: MessageKey; n: string } | null {
  const grams = (key: MessageKey, v: number | null) => (v === null ? null : { key, n: formatNumber(v) });
  switch (group) {
    case 'carbs':
      return grams('library.value.carbs', food.per100g.carbsG);
    case 'protein':
      return grams('library.value.protein', food.per100g.proteinG);
    case 'fat':
      return grams('library.value.fat', food.per100g.fatG);
    case 'fiber':
      return grams('library.value.fiber', food.fiberG);
    case 'omega3':
      // Fish are rich in EPA + DHA, seeds and nuts in ALA; show whichever the food has more of.
      if (food.omega3EpaDhaG !== null && food.omega3EpaDhaG >= (food.omega3AlaG ?? 0)) {
        return { key: 'library.value.epaDha', n: String(Math.round(food.omega3EpaDhaG * 1000)) };
      }
      return grams('library.value.ala', food.omega3AlaG);
    case 'vegetable':
    case 'fruit':
      return food.per100g.kcal === null ? null : { key: 'library.value.kcal', n: String(Math.round(food.per100g.kcal)) };
  }
}
