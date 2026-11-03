import { NUTRIENT_BASIS_G, type Nutrients } from '@fitplan/core';
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

/** Share of a target reached, clamped to 0..1 for a progress bar (0 when there is no target). */
export function progress(eaten: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, eaten / target));
}
