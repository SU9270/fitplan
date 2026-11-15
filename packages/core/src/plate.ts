import {
  FRACTIONAL_PORTION_PENALTY,
  GAP_TOLERANCE,
  KCAL_PER_G_CARBS,
  KCAL_PER_G_FAT,
  KCAL_PER_G_PROTEIN,
  LIGHT_MEAL_CATEGORIES,
  LIGHT_MEALS,
  MEAL_GAP_NUTRIENTS,
  MAX_SUGGESTIONS,
  MAX_TOP_UP_PORTIONS,
  MEALS,
  OTHER_CATEGORIES,
  PROTEIN_SLOT_MIN_ENERGY_SHARE,
  STARCHY_VEGETABLE_MIN_KCAL,
  REDUCE_GRAMS_STEP,
  SUGGESTION_MAX_PORTIONS,
  SUGGESTION_PORTION_STEP,
  VEGETABLE_CATEGORIES,
  VEGETABLE_HINT_MEALS,
  VEGETABLE_SUGGESTION_GRAMS,
} from './constants';
import { scaleNutrients, sumNutrients } from './nutrition';
import type { MacroTargets, Meal, MealShares, Nutrients, PlateSlot } from './types';

// See docs/superpowers/specs/2026-11-03-plate-feedback-design.md for the rules implemented here.

/**
 * Which plate cell a food goes to: vegetable (unless starchy, >= 70 kcal / 100 g) and "other"
 * USDA categories first, then protein when protein supplies >= 30 % of the energy, then staple
 * when carbs outweigh fat, else other. Unknown nutrients count as 0; foods without a category
 * (custom foods) use the macro rules.
 */
export function plateSlot(food: { category: string | null; per100g: Nutrients }): PlateSlot {
  const starchy = (food.per100g.kcal ?? 0) >= STARCHY_VEGETABLE_MIN_KCAL;
  if (food.category !== null && VEGETABLE_CATEGORIES.includes(food.category) && !starchy) return 'vegetable';
  if (food.category !== null && OTHER_CATEGORIES.includes(food.category)) return 'other';
  const protein = (food.per100g.proteinG ?? 0) * KCAL_PER_G_PROTEIN;
  const carbs = (food.per100g.carbsG ?? 0) * KCAL_PER_G_CARBS;
  const fat = (food.per100g.fatG ?? 0) * KCAL_PER_G_FAT;
  const energy = protein + carbs + fat;
  if (energy > 0 && protein / energy >= PROTEIN_SLOT_MIN_ENERGY_SHARE) return 'protein';
  if (carbs > fat) return 'staple';
  return 'other';
}

/** Daily targets split by meal shares (whole percent); each value rounded on its own. */
export function mealTargets(daily: MacroTargets, shares: MealShares): Record<Meal, MacroTargets> {
  const split = (share: number): MacroTargets => ({
    kcal: Math.round((daily.kcal * share) / 100),
    proteinG: Math.round((daily.proteinG * share) / 100),
    carbsG: Math.round((daily.carbsG * share) / 100),
    fatG: Math.round((daily.fatG * share) / 100),
  });
  return Object.fromEntries(MEALS.map((meal) => [meal, split(shares[meal])])) as Record<Meal, MacroTargets>;
}

export type GapStatus = 'short' | 'met' | 'over';

export interface NutrientGap {
  status: GapStatus;
  /** eaten − target (negative when short). */
  diff: number;
}

/** Only the nutrients the meal is checked on (see MEAL_GAP_NUTRIENTS). */
export type MealGap = Partial<Record<keyof MacroTargets, NutrientGap>>;

function nutrientGap(target: number, eaten: number): NutrientGap {
  const diff = eaten - target;
  if (target <= 0) return { status: eaten > 0 ? 'over' : 'met', diff };
  if (eaten < target * (1 - GAP_TOLERANCE)) return { status: 'short', diff };
  if (eaten > target * (1 + GAP_TOLERANCE)) return { status: 'over', diff };
  return { status: 'met', diff };
}

/**
 * The meal's nutrients (MEAL_GAP_NUTRIENTS: all four at lunch and dinner, kcal and protein at
 * breakfast and snacks) against its target: within ±10 % is met (both bounds inclusive).
 */
export function mealGap(meal: Meal, target: MacroTargets, eaten: MacroTargets): MealGap {
  const gap: MealGap = {};
  for (const key of MEAL_GAP_NUTRIENTS[meal]) gap[key] = nutrientGap(target[key], eaten[key]);
  return gap;
}

/** A diary entry as the suggestion engine sees it. */
export interface PlateEntry {
  id: string;
  foodId: string | null;
  slot: PlateSlot;
  /** Per-100 g snapshot. */
  per100g: Nutrients;
  grams: number;
  quantity: number;
  /** Null when the amount was entered in grams (then `quantity` is grams). */
  portionId: string | null;
}

/** A food that may be suggested, with the portion suggestions are counted in. */
export interface SuggestionCandidate {
  foodId: string;
  /** USDA category; light meals only get LIGHT_MEAL_CATEGORIES. */
  category: string | null;
  slot: PlateSlot;
  per100g: Nutrients;
  portion: { id: string; grams: number };
}

export type Suggestion =
  | {
      kind: 'add';
      reason: 'protein' | 'staple' | 'vegetable';
      foodId: string;
      portionId: string;
      quantity: number;
      /** What the added amount brings (unrounded). */
      change: Nutrients;
    }
  | {
      /** Change the amount of an entry already in the meal: more of it, or half of it. */
      kind: 'adjust';
      reason: 'protein' | 'staple' | 'kcal';
      entryId: string;
      portionId: string | null;
      /** The entry's new quantity (portions, or grams when `portionId` is null). */
      quantity: number;
      /** The difference in nutrients (negative when reduced, unrounded). */
      change: Nutrients;
    };

export interface SuggestionInput {
  meal: Meal;
  target: MacroTargets;
  entries: readonly PlateEntry[];
  candidates: readonly SuggestionCandidate[];
}

const roundToStep = (value: number, step: number) => Math.round(value / step) * step;
const byFoodId = (a: { foodId: string }, b: { foodId: string }) => (a.foodId < b.foodId ? -1 : a.foodId > b.foodId ? 1 : 0);

/**
 * The candidate (and amount) that best fills `need` grams of `nutrient`: portions rounded to
 * 0.5 and kept within 0.5–2; closer to the need is better, fractional portions and going past
 * the meal's kcal band cost extra. Ties go to the lower food id, so results are stable.
 */
function bestAddition(
  candidates: readonly SuggestionCandidate[],
  nutrient: 'proteinG' | 'carbsG',
  need: number,
  kcalRoom: { eaten: number; target: number },
): { candidate: SuggestionCandidate; quantity: number } | null {
  let best: { candidate: SuggestionCandidate; quantity: number; score: number } | null = null;
  for (const candidate of [...candidates].sort(byFoodId)) {
    const perPortion = ((candidate.per100g[nutrient] ?? 0) * candidate.portion.grams) / 100;
    if (perPortion <= 0) continue;
    const quantity = Math.min(
      SUGGESTION_MAX_PORTIONS,
      Math.max(SUGGESTION_PORTION_STEP, roundToStep(need / perPortion, SUGGESTION_PORTION_STEP)),
    );
    const addedKcal = ((candidate.per100g.kcal ?? 0) * candidate.portion.grams * quantity) / 100;
    const kcalOver = Math.max(0, kcalRoom.eaten + addedKcal - kcalRoom.target * (1 + GAP_TOLERANCE));
    const score =
      Math.abs(perPortion * quantity - need) / need +
      (Number.isInteger(quantity) ? 0 : FRACTIONAL_PORTION_PENALTY) +
      (kcalRoom.target > 0 ? kcalOver / kcalRoom.target : 0);
    if (best === null || score < best.score) best = { candidate, quantity, score };
  }
  return best && { candidate: best.candidate, quantity: best.quantity };
}

function addition(
  reason: 'protein' | 'staple' | 'vegetable',
  pick: { candidate: SuggestionCandidate; quantity: number },
): Suggestion {
  return {
    kind: 'add',
    reason,
    foodId: pick.candidate.foodId,
    portionId: pick.candidate.portion.id,
    quantity: pick.quantity,
    change: scaleNutrients(pick.candidate.per100g, pick.candidate.portion.grams * pick.quantity),
  };
}

/** Portions step by 0.5; gram entries by 5 g. */
const stepOf = (entry: PlateEntry) => (entry.portionId === null ? REDUCE_GRAMS_STEP : SUGGESTION_PORTION_STEP);

/** An entry set to `quantity`, with the nutrient difference that makes. */
function adjusted(entry: PlateEntry, reason: 'protein' | 'staple' | 'kcal', quantity: number): Suggestion {
  const gramsPerUnit = entry.grams / entry.quantity;
  return {
    kind: 'adjust',
    reason,
    entryId: entry.id,
    portionId: entry.portionId,
    quantity,
    change: scaleNutrients(entry.per100g, gramsPerUnit * (quantity - entry.quantity)),
  };
}

/** Halve an entry (to the nearest step); null when it cannot shrink. */
function halved(entry: PlateEntry): Suggestion | null {
  const step = stepOf(entry);
  const quantity = roundToStep(entry.quantity / 2, step);
  if (quantity < step || quantity >= entry.quantity) return null;
  return adjusted(entry, 'kcal', quantity);
}

/**
 * "One more egg": the entry in the short cell whose extra amount (one step at least) best fills
 * `need`, as long as that is at most one more portion (or, for gram entries, at most double).
 */
function topUp(
  entries: readonly PlateEntry[],
  reason: 'protein' | 'staple',
  nutrient: 'proteinG' | 'carbsG',
  need: number,
): Suggestion | null {
  let best: { entry: PlateEntry; quantity: number; miss: number } | null = null;
  for (const entry of entries) {
    const perUnit = ((entry.per100g[nutrient] ?? 0) * entry.grams) / entry.quantity / 100;
    if (perUnit <= 0) continue;
    const step = stepOf(entry);
    const extra = Math.max(step, roundToStep(need / perUnit, step));
    const limit = entry.portionId === null ? entry.quantity : MAX_TOP_UP_PORTIONS;
    if (extra > limit) continue;
    const miss = Math.abs(extra * perUnit - need);
    if (best === null || miss < best.miss) best = { entry, quantity: entry.quantity + extra, miss };
  }
  return best && adjusted(best.entry, reason, best.quantity);
}

/**
 * Up to three adjustments for one meal, in this order: protein short → more of a protein entry
 * (at most one more portion) or else add a protein food; kcal over → halve the biggest staple /
 * "other" entry; carbs short (and kcal not over; lunch and dinner only) → more of a staple entry
 * or else add a staple; lunch / dinner without vegetables → add a ~100 g vegetable portion.
 * Foods already in the meal are not added again; breakfast and snacks only get foods from
 * LIGHT_MEAL_CATEGORIES. An empty meal gets no suggestions (feedback only after choosing).
 */
export function suggestAdjustments({ meal, target, entries, candidates }: SuggestionInput): Suggestion[] {
  if (entries.length === 0) return [];
  const eaten = sumNutrients(entries.map((e) => scaleNutrients(e.per100g, e.grams))).totals;
  const gap = mealGap(meal, target, eaten);
  const inMeal = new Set(entries.map((e) => e.foodId).filter((id): id is string => id !== null));
  const light = LIGHT_MEALS.includes(meal);
  const suits = (c: SuggestionCandidate) => !light || (c.category !== null && LIGHT_MEAL_CATEGORIES.includes(c.category));
  const available = (slot: PlateSlot) => candidates.filter((c) => c.slot === slot && !inMeal.has(c.foodId) && suits(c));
  const kcalRoom = { eaten: eaten.kcal, target: target.kcal };
  const suggestions: Suggestion[] = [];

  const inSlot = (slot: PlateSlot) => entries.filter((e) => e.slot === slot);

  if (gap.proteinG?.status === 'short') {
    const need = -gap.proteinG.diff;
    const more = topUp(inSlot('protein'), 'protein', 'proteinG', need);
    const pick = more ? null : bestAddition(available('protein'), 'proteinG', need, kcalRoom);
    if (more) suggestions.push(more);
    else if (pick) suggestions.push(addition('protein', pick));
  }

  if (gap.kcal?.status === 'over') {
    const biggest = entries
      .filter((e) => e.slot === 'staple' || e.slot === 'other')
      .map((e) => ({ entry: e, kcal: scaleNutrients(e.per100g, e.grams).kcal ?? 0 }))
      .sort((a, b) => b.kcal - a.kcal || (a.entry.id < b.entry.id ? -1 : 1));
    for (const { entry } of biggest) {
      const reduce = halved(entry);
      if (reduce) {
        suggestions.push(reduce);
        break;
      }
    }
  } else if (gap.carbsG?.status === 'short') {
    const need = -gap.carbsG.diff;
    const more = topUp(inSlot('staple'), 'staple', 'carbsG', need);
    const pick = more ? null : bestAddition(available('staple'), 'carbsG', need, kcalRoom);
    if (more) suggestions.push(more);
    else if (pick) suggestions.push(addition('staple', pick));
  }

  if (VEGETABLE_HINT_MEALS.includes(meal) && !entries.some((e) => e.slot === 'vegetable')) {
    // One portion of the vegetable whose portion is closest to a side-dish weight (100 g).
    const distance = (c: SuggestionCandidate) => Math.abs(c.portion.grams - VEGETABLE_SUGGESTION_GRAMS);
    const vegetable = available('vegetable').sort((a, b) => distance(a) - distance(b) || byFoodId(a, b))[0];
    if (vegetable) suggestions.push(addition('vegetable', { candidate: vegetable, quantity: 1 }));
  }

  return suggestions.slice(0, MAX_SUGGESTIONS);
}
