import {
  FAT_GROUP_MIN_ENERGY_SHARE,
  FRUIT_CATEGORY,
  HIGH_FIBER_MIN_G,
  HIGH_OMEGA3_MIN_ALA_G,
  HIGH_OMEGA3_MIN_EPA_DHA_G,
  KCAL_PER_G_CARBS,
  KCAL_PER_G_FAT,
  KCAL_PER_G_PROTEIN,
  LIBRARY_GROUPS,
  PROTEIN_SLOT_MIN_ENERGY_SHARE,
} from './constants';
import { plateSlot } from './plate';
import type { Nutrients } from './types';

// See docs/superpowers/specs/2026-11-03-food-library-tab-design.md for the rules implemented here.

export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];

export interface LibraryFoodFacts {
  category: string | null;
  per100g: Nutrients;
  fiberG: number | null;
  /** Alpha-linolenic acid, g per 100 g. */
  omega3AlaG: number | null;
  /** EPA + DHA combined, g per 100 g. */
  omega3EpaDhaG: number | null;
}

/** Whether `amount` per 100 g reaches `min` both per 100 g and per 100 kcal. */
function richIn(amount: number | null, min: number, kcal: number | null): boolean {
  if (amount === null || amount < min) return false;
  return kcal === null || kcal === 0 || (amount / kcal) * 100 >= min;
}

/**
 * The library groups a food appears in (a food can be in several, e.g. avocado: fruit, fat and
 * high fiber), in display order. Carbs, protein and vegetable follow the plate cells, except
 * that a protein-rich food the plate puts under "other" (protein powder) is listed under protein;
 * unknown nutrients never put a food in a group.
 */
export function libraryGroups(food: LibraryFoodFacts): LibraryGroup[] {
  const protein = (food.per100g.proteinG ?? 0) * KCAL_PER_G_PROTEIN;
  const carbs = (food.per100g.carbsG ?? 0) * KCAL_PER_G_CARBS;
  const fat = (food.per100g.fatG ?? 0) * KCAL_PER_G_FAT;
  const energy = protein + carbs + fat;
  const proteinRich = energy > 0 && protein / energy >= PROTEIN_SLOT_MIN_ENERGY_SHARE;

  const groups = new Set<LibraryGroup>();
  const slot = plateSlot(food);
  if (slot === 'staple') groups.add('carbs');
  // Protein powder is a USDA "Beverage", which the plate puts under "other".
  if (slot === 'protein' || (slot === 'other' && proteinRich)) groups.add('protein');
  if (slot === 'vegetable') groups.add('vegetable');
  if (food.category === FRUIT_CATEGORY) groups.add('fruit');
  if (energy > 0 && fat / energy >= FAT_GROUP_MIN_ENERGY_SHARE && !proteinRich) groups.add('fat');

  if ((food.fiberG ?? 0) >= HIGH_FIBER_MIN_G) groups.add('fiber');
  const kcal = food.per100g.kcal;
  if (richIn(food.omega3AlaG, HIGH_OMEGA3_MIN_ALA_G, kcal) || richIn(food.omega3EpaDhaG, HIGH_OMEGA3_MIN_EPA_DHA_G, kcal)) {
    groups.add('omega3');
  }
  return LIBRARY_GROUPS.filter((g) => groups.has(g));
}
