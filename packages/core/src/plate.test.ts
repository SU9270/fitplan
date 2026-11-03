import { describe, expect, it } from 'vitest';
import { DEFAULT_MEAL_SHARES } from './constants';
import { mealGap, mealTargets, plateSlot, suggestAdjustments, type PlateEntry, type SuggestionCandidate } from './plate';
import type { Nutrients } from './types';

// Per-100 g values from USDA SR Legacy (FoodData Central, 2018-04).
const food = {
  egg: { kcal: 143, proteinG: 12.56, carbsG: 0.72, fatG: 9.51 },
  boiledEgg: { kcal: 155, proteinG: 12.58, carbsG: 1.12, fatG: 10.61 },
  tofu: { kcal: 78, proteinG: 9.04, carbsG: 2.85, fatG: 4.17 },
  salmon: { kcal: 206, proteinG: 22.1, carbsG: 0, fatG: 12.35 },
  chicken: { kcal: 165, proteinG: 31.02, carbsG: 0, fatG: 3.57 },
  greekYogurt: { kcal: 59, proteinG: 10.19, carbsG: 3.6, fatG: 0.39 },
  rice: { kcal: 130, proteinG: 2.69, carbsG: 28.17, fatG: 0.28 },
  wholeWheatBread: { kcal: 252, proteinG: 12.45, carbsG: 42.71, fatG: 3.5 },
  blackBeans: { kcal: 132, proteinG: 8.86, carbsG: 23.71, fatG: 0.54 },
  broccoli: { kcal: 34, proteinG: 2.82, carbsG: 6.64, fatG: 0.37 },
  spinach: { kcal: 23, proteinG: 2.86, carbsG: 3.63, fatG: 0.39 },
  bakedPotato: { kcal: 93, proteinG: 2.5, carbsG: 21.15, fatG: 0.13 },
  bakedSweetPotato: { kcal: 90, proteinG: 2.01, carbsG: 20.71, fatG: 0.15 },
  edamame: { kcal: 109, proteinG: 11.22, carbsG: 7.61, fatG: 4.73 },
  carrot: { kcal: 41, proteinG: 0.93, carbsG: 9.58, fatG: 0.24 },
  apple: { kcal: 52, proteinG: 0.26, carbsG: 13.81, fatG: 0.17 },
  oliveOil: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 },
  peanutButter: { kcal: 598, proteinG: 22.21, carbsG: 22.31, fatG: 51.36 },
  cheddar: { kcal: 403, proteinG: 22.87, carbsG: 3.37, fatG: 33.31 },
} satisfies Record<string, Nutrients>;

const VEG = 'Vegetables and Vegetable Products';

describe('plateSlot', () => {
  it('puts protein-rich foods in the protein cell even when fat supplies more energy', () => {
    for (const per100g of [food.egg, food.boiledEgg, food.tofu, food.salmon, food.chicken, food.greekYogurt]) {
      expect(plateSlot({ category: null, per100g })).toBe('protein');
    }
  });

  it('puts carb-dominant foods in the staple cell', () => {
    for (const per100g of [food.rice, food.wholeWheatBread, food.blackBeans]) {
      expect(plateSlot({ category: null, per100g })).toBe('staple');
    }
  });

  it('puts fat-dominant foods in "other"', () => {
    expect(plateSlot({ category: null, per100g: food.peanutButter })).toBe('other');
    expect(plateSlot({ category: null, per100g: food.cheddar })).toBe('other');
  });

  it('lets the USDA category decide vegetables and fruit / fats', () => {
    expect(plateSlot({ category: VEG, per100g: food.broccoli })).toBe('vegetable');
    expect(plateSlot({ category: 'Fruits and Fruit Juices', per100g: food.apple })).toBe('other');
    expect(plateSlot({ category: 'Fats and Oils', per100g: food.oliveOil })).toBe('other');
    expect(plateSlot({ category: VEG, per100g: food.carrot })).toBe('vegetable');
    // Without the category an apple is a carb food.
    expect(plateSlot({ category: null, per100g: food.apple })).toBe('staple');
  });

  it('places starchy vegetables (>= 70 kcal / 100 g) by their macros, like a Chinese meal would', () => {
    expect(plateSlot({ category: VEG, per100g: food.bakedPotato })).toBe('staple');
    expect(plateSlot({ category: VEG, per100g: food.bakedSweetPotato })).toBe('staple');
    expect(plateSlot({ category: VEG, per100g: food.edamame })).toBe('protein');
    expect(plateSlot({ category: VEG, per100g: { kcal: 69, proteinG: 1, carbsG: 15, fatG: 0 } })).toBe('vegetable');
    expect(plateSlot({ category: VEG, per100g: { kcal: 70, proteinG: 1, carbsG: 15, fatG: 0 } })).toBe('staple');
  });

  it('treats unknown nutrients as 0 and an all-unknown food as "other"', () => {
    expect(plateSlot({ category: null, per100g: { kcal: 100, proteinG: 20, carbsG: null, fatG: null } })).toBe('protein');
    expect(plateSlot({ category: null, per100g: { kcal: null, proteinG: null, carbsG: null, fatG: null } })).toBe('other');
  });

  it('includes the 30 % protein boundary', () => {
    // protein 30 kcal, carbs 70 kcal → exactly 30 %.
    expect(plateSlot({ category: null, per100g: { kcal: 100, proteinG: 7.5, carbsG: 17.5, fatG: 0 } })).toBe('protein');
    expect(plateSlot({ category: null, per100g: { kcal: 100, proteinG: 7.4, carbsG: 17.6, fatG: 0 } })).toBe('staple');
  });
});

describe('mealTargets', () => {
  it('splits the day by the default shares and rounds each value', () => {
    const daily = { kcal: 2056, proteinG: 140, carbsG: 248, fatG: 56 };
    expect(mealTargets(daily, DEFAULT_MEAL_SHARES)).toEqual({
      breakfast: { kcal: 514, proteinG: 35, carbsG: 62, fatG: 14 },
      lunch: { kcal: 617, proteinG: 42, carbsG: 74, fatG: 17 },
      dinner: { kcal: 617, proteinG: 42, carbsG: 74, fatG: 17 },
      snack: { kcal: 308, proteinG: 21, carbsG: 37, fatG: 8 },
    });
  });

  it('gives a 0 % meal zero targets', () => {
    const t = mealTargets({ kcal: 2000, proteinG: 100, carbsG: 200, fatG: 60 }, { breakfast: 0, lunch: 40, dinner: 40, snack: 20 });
    expect(t.breakfast).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe('mealGap', () => {
  const target = { kcal: 600, proteinG: 40, carbsG: 70, fatG: 20 };

  it('marks short, met and over with the signed difference', () => {
    expect(mealGap('lunch', target, { kcal: 600, proteinG: 15, carbsG: 90, fatG: 20 })).toEqual({
      kcal: { status: 'met', diff: 0 },
      proteinG: { status: 'short', diff: -25 },
      carbsG: { status: 'over', diff: 20 },
      fatG: { status: 'met', diff: 0 },
    });
  });

  it('includes both ±10 % bounds in "met"', () => {
    expect(mealGap('lunch', target, { kcal: 540, proteinG: 44, carbsG: 70, fatG: 20 }).kcal?.status).toBe('met');
    expect(mealGap('lunch', target, { kcal: 539, proteinG: 44, carbsG: 70, fatG: 20 }).kcal?.status).toBe('short');
    expect(mealGap('lunch', target, { kcal: 660, proteinG: 44, carbsG: 70, fatG: 20 }).kcal?.status).toBe('met');
    expect(mealGap('lunch', target, { kcal: 661, proteinG: 44, carbsG: 70, fatG: 20 }).kcal?.status).toBe('over');
  });

  it('checks only kcal and protein at breakfast and snacks', () => {
    const eaten = { kcal: 300, proteinG: 15, carbsG: 2, fatG: 20 };
    expect(Object.keys(mealGap('breakfast', target, eaten))).toEqual(['kcal', 'proteinG']);
    expect(Object.keys(mealGap('snack', target, eaten))).toEqual(['kcal', 'proteinG']);
    expect(Object.keys(mealGap('dinner', target, eaten))).toEqual(['kcal', 'proteinG', 'carbsG', 'fatG']);
  });

  it('handles a zero target', () => {
    const zero = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    expect(mealGap('lunch', zero, zero).kcal).toEqual({ status: 'met', diff: 0 });
    expect(mealGap('lunch', zero, { ...zero, kcal: 50 }).kcal).toEqual({ status: 'over', diff: 50 });
  });
});

describe('suggestAdjustments', () => {
  const CATEGORIES: Record<string, string> = {
    'usda-boiled-egg': 'Dairy and Egg Products',
    'usda-chicken': 'Poultry Products',
    'usda-greek-yogurt': 'Dairy and Egg Products',
    'usda-rice': 'Cereal Grains and Pasta',
    'usda-bread': 'Baked Products',
  };
  const candidate = (foodId: string, slot: SuggestionCandidate['slot'], per100g: Nutrients, grams: number): SuggestionCandidate => ({
    foodId,
    category: CATEGORIES[foodId] ?? 'Vegetables and Vegetable Products',
    slot,
    per100g,
    portion: { id: `${foodId}-p`, grams },
  });
  // Portions as in SR Legacy: 1 large egg 50 g, 0.5 breast 86 g, 1 container yogurt 170 g, 1 cup rice 158 g.
  const candidates = [
    candidate('usda-boiled-egg', 'protein', food.boiledEgg, 50),
    candidate('usda-chicken', 'protein', food.chicken, 86),
    candidate('usda-greek-yogurt', 'protein', food.greekYogurt, 170),
    candidate('usda-rice', 'staple', food.rice, 158),
    candidate('usda-bread', 'staple', food.wholeWheatBread, 32),
    candidate('usda-broccoli', 'vegetable', food.broccoli, 91),
    candidate('usda-spinach', 'vegetable', food.spinach, 30),
  ];
  const entry = (id: string, foodId: string, slot: PlateEntry['slot'], per100g: Nutrients, grams: number, portion = true): PlateEntry => ({
    id,
    foodId,
    slot,
    per100g,
    grams,
    quantity: portion ? 1 : grams,
    portionId: portion ? `${foodId}-p` : null,
  });
  const lunchTarget = { kcal: 617, proteinG: 42, carbsG: 74, fatG: 17 };

  it('gives nothing for an empty meal', () => {
    expect(suggestAdjustments({ meal: 'lunch', target: lunchTarget, entries: [], candidates })).toEqual([]);
  });

  it('fills a protein gap, then a staple gap, then adds the vegetable portion closest to 100 g', () => {
    // Half a cup of rice only: protein short by ~40 g, carbs short, no vegetables.
    const s = suggestAdjustments({
      meal: 'lunch',
      target: lunchTarget,
      entries: [entry('e1', 'usda-tofu', 'protein', food.tofu, 50)],
      candidates,
    });
    expect(s.map((x) => [x.kind, x.reason])).toEqual([
      ['add', 'protein'],
      ['add', 'staple'],
      ['add', 'vegetable'],
    ]);
    // 37 g protein short (42 − 5 from the tofu): 2 yogurts (34.6 g, whole portions) beat
    // 1.5 × half a chicken breast (40.0 g, but a half portion) and 3 eggs (18.9 g).
    expect(s[0]).toMatchObject({ foodId: 'usda-greek-yogurt', portionId: 'usda-greek-yogurt-p', quantity: 2 });
    expect(s[0]?.change.proteinG).toBeCloseTo(10.19 * 1.7 * 2, 6);
    expect(s[1]).toMatchObject({ kind: 'add', foodId: 'usda-rice' });
    // Broccoli 91 g is closer to 100 g than spinach 30 g.
    expect(s[2]).toMatchObject({ foodId: 'usda-broccoli', quantity: 1 });
  });

  it('halves the biggest staple or "other" entry when the meal is over its kcal band', () => {
    const s = suggestAdjustments({
      meal: 'dinner',
      target: lunchTarget,
      entries: [
        { ...entry('rice', 'usda-rice', 'staple', food.rice, 158 * 3), quantity: 3 },
        entry('pb', 'usda-pb', 'other', food.peanutButter, 32),
        entry('chicken', 'usda-chicken', 'protein', food.chicken, 172),
        entry('broc', 'usda-broccoli', 'vegetable', food.broccoli, 91),
      ],
      candidates,
    });
    // 3 cups of rice (616 kcal) is the biggest: halve to 1.5 cups.
    expect(s).toEqual([
      expect.objectContaining({ kind: 'adjust', reason: 'kcal', entryId: 'rice', portionId: 'usda-rice-p', quantity: 1.5 }),
    ]);
    expect(s[0]?.change.kcal).toBeCloseTo(-130 * 1.58 * 1.5, 6);
  });

  it('rounds a halved gram entry to 5 g and skips entries that cannot shrink', () => {
    const big = suggestAdjustments({
      meal: 'snack',
      target: { kcal: 100, proteinG: 0, carbsG: 0, fatG: 0 },
      entries: [entry('oil', 'usda-oil', 'other', food.oliveOil, 33, false)],
      candidates,
    });
    expect(big).toEqual([expect.objectContaining({ kind: 'adjust', reason: 'kcal', portionId: null, quantity: 15 })]);
    const tiny = suggestAdjustments({
      meal: 'snack',
      target: { kcal: 10, proteinG: 0, carbsG: 0, fatG: 0 },
      entries: [entry('oil', 'usda-oil', 'other', food.oliveOil, 5, false)],
      candidates,
    });
    expect(tiny).toEqual([]);
  });

  it('tops up a food already in the cell when at most one more portion closes the gap', () => {
    // 1 cup of rice (44.5 g carbs) for a 74 g carbs lunch: half a cup more (+22 g) instead of a new staple.
    const rice = { ...entry('r', 'usda-rice', 'staple', food.rice, 158), quantity: 1 };
    const chicken = entry('c', 'usda-chicken', 'protein', food.chicken, 140);
    const s = suggestAdjustments({ meal: 'lunch', target: lunchTarget, entries: [rice, chicken], candidates });
    expect(s[0]).toMatchObject({ kind: 'adjust', reason: 'staple', entryId: 'r', quantity: 1.5 });
    expect(s[0]?.change.carbsG).toBeCloseTo(28.17 * 0.79, 6);

    // 2 eggs, 6 g protein short: one more egg.
    const eggs = { ...entry('e', 'usda-egg', 'protein', food.boiledEgg, 100), quantity: 2 };
    const breakfast = suggestAdjustments({
      meal: 'breakfast',
      target: { kcal: 400, proteinG: 19, carbsG: 0, fatG: 25 },
      entries: [eggs],
      candidates,
    });
    expect(breakfast[0]).toMatchObject({ kind: 'adjust', reason: 'protein', entryId: 'e', quantity: 3 });
  });

  it('adds a new food when topping up would need more than one more portion', () => {
    const eggs = { ...entry('e', 'usda-egg', 'protein', food.boiledEgg, 100), quantity: 2 };
    const s = suggestAdjustments({ meal: 'breakfast', target: { kcal: 500, proteinG: 35, carbsG: 0, fatG: 30 }, entries: [eggs], candidates });
    // 22 g short = 3.5 more eggs: suggest another food instead, a breakfast one (not chicken).
    expect(s[0]).toMatchObject({ kind: 'add', reason: 'protein' });
    expect(s[0]?.kind === 'add' && s[0].foodId).not.toBe('usda-chicken');
  });

  it('never asks for more carbs at breakfast, and suggests no rice or meat there', () => {
    const eggs = { ...entry('e', 'usda-egg', 'protein', food.boiledEgg, 100), quantity: 2 };
    const s = suggestAdjustments({
      meal: 'breakfast',
      target: { kcal: 800, proteinG: 40, carbsG: 130, fatG: 25 },
      entries: [eggs],
      candidates,
    });
    expect(s.map((x) => x.reason)).not.toContain('staple');
    const added = s.flatMap((x) => (x.kind === 'add' ? [x.foodId] : []));
    expect(added.every((id) => id !== 'usda-rice' && id !== 'usda-chicken')).toBe(true);
  });

  it('does not suggest a staple when kcal is over, nor foods already in the meal', () => {
    const s = suggestAdjustments({
      meal: 'lunch',
      target: lunchTarget,
      entries: [entry('pb', 'usda-pb', 'other', food.peanutButter, 150), entry('broc', 'usda-broccoli', 'vegetable', food.broccoli, 91)],
      candidates,
    });
    expect(s.map((x) => x.reason)).toEqual(['protein', 'kcal']);
    expect(s.every((x) => x.kind !== 'add' || x.foodId !== 'usda-broccoli')).toBe(true);
  });

  it('only hints vegetables at lunch and dinner', () => {
    const balanced = [entry('c', 'usda-chicken', 'protein', food.chicken, 120), entry('r', 'usda-rice', 'staple', food.rice, 250)];
    const at = (meal: 'breakfast' | 'dinner') =>
      suggestAdjustments({ meal, target: lunchTarget, entries: balanced, candidates }).map((x) => x.reason);
    expect(at('dinner')).toEqual(['vegetable']);
    expect(at('breakfast')).toEqual([]);
  });

  it('caps the portions at 2 and is stable for the same input', () => {
    const input = {
      meal: 'lunch' as const,
      target: { kcal: 2000, proteinG: 200, carbsG: 50, fatG: 50 },
      entries: [entry('r', 'usda-rice', 'staple', food.rice, 50)],
      candidates,
    };
    const first = suggestAdjustments(input);
    expect(first[0]).toMatchObject({ reason: 'protein', quantity: 2 });
    expect(suggestAdjustments({ ...input, candidates: [...candidates].reverse() })).toEqual(first);
  });
});
