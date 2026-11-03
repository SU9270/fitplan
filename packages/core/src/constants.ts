import type { ActivityLevel, Goal, Meal, MealShares, Pace, PlateSlot, Sex } from './types';

// Mifflin-St Jeor: BMR = 10*kg + 6.25*cm - 5*age + sexConstant
export const BMR_WEIGHT_COEF = 10;
export const BMR_HEIGHT_COEF = 6.25;
export const BMR_AGE_COEF = 5;

export const SEX_CONSTANT: Record<Sex, number> = {
  male: 5,
  female: -161,
  unspecified: -78,
};

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  1: 1.2,
  2: 1.375,
  3: 1.55,
  4: 1.725,
  5: 1.9,
};

/** Weekly body-weight loss as a fraction of current weight. */
export const LOSS_WEEKLY_PCT: Record<Pace, number> = {
  conservative: 0.005,
  standard: 0.0075,
  aggressive: 0.01,
};

/** TDEE multiplier when gaining. */
export const GAIN_SURPLUS: Record<Pace, number> = {
  conservative: 1.05,
  standard: 1.1,
  aggressive: 1.15,
};

export const KCAL_PER_KG = 7700;
export const DAYS_PER_WEEK = 7;
export const MAX_DEFICIT_RATIO = 0.25;

/** Minimum daily kcal; the effective floor is max(BMR, this value). */
export const KCAL_FLOOR: Record<Sex, number> = {
  male: 1500,
  female: 1200,
  unspecified: 1350,
};

export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose: 2.0,
  gain: 1.8,
};
export const FAT_MIN_G_PER_KG = 0.8;
export const FAT_MIN_KCAL_RATIO = 0.2;

export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_CARBS = 4;
export const KCAL_PER_G_FAT = 9;

export const CM_PER_M = 100;

// Safety thresholds
export const MIN_AGE = 18;
export const MIN_BMI_FOR_LOSS = 18.5;
export const CONSULT_BMI = 35;

/** BMI is reported with 1 decimal: round(x * 10) / 10. */
export const BMI_ROUND_FACTOR = 10;

/** Food nutrient values are stored per this many grams (USDA convention). */
export const NUTRIENT_BASIS_G = 100;

// ---------------------------------------------------------------------------
// Plates and gap feedback (phase 3 spec, docs/superpowers/specs/2026-11-03-plate-feedback-design.md)
// ---------------------------------------------------------------------------

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const satisfies readonly Meal[];

export const PLATE_SLOTS = ['protein', 'staple', 'vegetable', 'other'] as const satisfies readonly PlateSlot[];

/** Requirements v2.1 §10.8 suggestion: breakfast 25 %, lunch 30 %, dinner 30 %, snacks 15 %. */
export const DEFAULT_MEAL_SHARES: MealShares = { breakfast: 25, lunch: 30, dinner: 30, snack: 15 };
/** Meal shares change in steps of this many percent. */
export const MEAL_SHARE_STEP = 5;
export const MEAL_SHARES_TOTAL = 100;

/** USDA categories that go to the vegetable cell regardless of macros. */
export const VEGETABLE_CATEGORIES: readonly string[] = ['Vegetables and Vegetable Products'];
/**
 * Foods in a vegetable category with at least this many kcal per 100 g are starchy (potato,
 * sweet potato, corn, taro, peas) and are placed by their macros instead (usually staple), as in
 * Chinese meals; leafy and other vegetables stay well below it (broccoli 35, carrot 41).
 */
export const STARCHY_VEGETABLE_MIN_KCAL = 70;
/** USDA categories that go to "other" (fruit, drinks, snacks, fats, condiments) regardless of macros. */
export const OTHER_CATEGORIES: readonly string[] = [
  'Fruits and Fruit Juices',
  'Beverages',
  'Alcoholic Beverages',
  'Sweets',
  'Snacks',
  'Fats and Oils',
  'Spices and Herbs',
  'Soups, Sauces, and Gravies',
];
/**
 * A food whose protein supplies at least this share of its energy goes to the protein cell.
 * "Largest energy source" (requirements §3.4) would put eggs (34 % protein, 61 % fat), tofu and
 * salmon under "other".
 */
export const PROTEIN_SLOT_MIN_ENERGY_SHARE = 0.3;

/** Within ±10 % of a meal target counts as met (requirements §3.3). */
export const GAP_TOLERANCE = 0.1;
/** Meals that get the "no vegetables yet" hint. */
export const VEGETABLE_HINT_MEALS: readonly Meal[] = ['lunch', 'dinner'];

export const MAX_SUGGESTIONS = 3;
/** Suggested amounts are multiples of half a portion … */
export const SUGGESTION_PORTION_STEP = 0.5;
/** … and at most this many portions. */
export const SUGGESTION_MAX_PORTIONS = 3;
/**
 * A short protein / staple cell is topped up from a food already in it ("one more egg") when at
 * most this many extra portions close the gap; otherwise a new food is suggested.
 */
export const MAX_TOP_UP_PORTIONS = 1;
/** "Halve it" for an entry logged in grams rounds to this many grams. */
export const REDUCE_GRAMS_STEP = 5;
/** The suggested vegetable is the one whose portion is closest to this weight (a side dish). */
export const VEGETABLE_SUGGESTION_GRAMS = 100;
/** Score penalty for a suggestion that is not a whole number of portions. */
export const FRACTIONAL_PORTION_PENALTY = 0.05;

/** The food library's groups, in display order (docs/superpowers/specs/2026-11-03-food-library-tab-design.md). */
export const LIBRARY_GROUPS = ['carbs', 'protein', 'fat', 'vegetable', 'fruit', 'fiber', 'omega3'] as const;
/** USDA category of the library's fruit group. */
export const FRUIT_CATEGORY = 'Fruits and Fruit Juices';
/** "Fat" group: fat supplies at least this share of the energy (and protein too little for the protein group). */
export const FAT_GROUP_MIN_ENERGY_SHARE = 0.5;
/** "High fiber": GB 28050-2011 「高或富含膳食纤维」, at least 6 g per 100 g. */
export const HIGH_FIBER_MIN_G = 6;
/**
 * "Rich in omega-3": the EU "high omega-3" claim (Regulation (EC) 1924/2006): at least 0.6 g
 * ALA, or 80 mg EPA + DHA combined, both per 100 g and per 100 kcal. China's GB 28050 has no
 * omega-3 claim.
 */
export const HIGH_OMEGA3_MIN_ALA_G = 0.6;
export const HIGH_OMEGA3_MIN_EPA_DHA_G = 0.08;
