import {
  FAT_MIN_G_PER_KG,
  FAT_MIN_KCAL_RATIO,
  KCAL_PER_G_CARBS,
  KCAL_PER_G_FAT,
  KCAL_PER_G_PROTEIN,
  PROTEIN_G_PER_KG,
} from './constants';
import type { Goal, MacroTargets } from './types';

/** Computes from the unrounded kcal; only the outputs are rounded. */
export function macroTargets(kcal: number, weightKg: number, goal: Goal): MacroTargets {
  const protein = PROTEIN_G_PER_KG[goal] * weightKg;
  const fat = Math.max(FAT_MIN_G_PER_KG * weightKg, (kcal * FAT_MIN_KCAL_RATIO) / KCAL_PER_G_FAT);
  const carbs = Math.max(
    0,
    (kcal - protein * KCAL_PER_G_PROTEIN - fat * KCAL_PER_G_FAT) / KCAL_PER_G_CARBS,
  );
  return {
    kcal: Math.round(kcal),
    proteinG: Math.round(protein),
    carbsG: Math.round(carbs),
    fatG: Math.round(fat),
  };
}
