import {
  MEALS,
  currentStreak,
  mealGap,
  mealTargets,
  plateSlot,
  scaleNutrients,
  suggestAdjustments,
  sumNutrients,
  type MacroTargets,
  type MealGap,
  type MealShares,
  type NutrientKey,
  type Nutrients,
  type PlateEntry,
  type PlateSlot,
  type Suggestion,
  type SuggestionCandidate,
} from '@fitplan/core';
import {
  MAX_ENTRY_GRAMS,
  isDateWithinLogWindow,
  type DiaryEntryInput,
  type DiaryEntryPatch,
  type Meal,
} from '@fitplan/validators';
import { and, asc, count, eq, isNotNull, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { diaryEntries, foodPortions, foods } from '../db/schema';
import { findVisibleFood } from '../foods/food-service';
import { getLatestTargets, getMealShares } from '../profile-service';

export interface DiaryEntryView {
  id: string;
  date: string;
  meal: Meal;
  /** Null once a custom food was deleted; the entry keeps its own copy of the name and values. */
  foodId: string | null;
  name: string;
  nameZh: string | null;
  portionId: string | null;
  portionLabel: string | null;
  quantity: number;
  grams: number;
  /** What was eaten (scaled to `grams`), unrounded; null = unknown. */
  nutrients: Nutrients;
  /** The plate cell (from the category and per-100 g snapshot). */
  slot: PlateSlot;
}

/** A suggestion with what the app needs to show it. `change` is unrounded. */
export type SuggestionView = Suggestion & {
  name: string;
  nameZh: string | null;
  /** Null for an adjustment of an entry logged in grams. */
  portionLabel: string | null;
};

export interface MealView {
  meal: Meal;
  /** This meal's share of the latest daily target; null without a target. */
  target: MacroTargets | null;
  /** Rounded meal totals. */
  totals: MacroTargets;
  /** Null without a target or before anything is logged in this meal. */
  gap: MealGap | null;
  hasVegetables: boolean;
  /** Up to three, see `suggestAdjustments`. */
  suggestions: SuggestionView[];
}

export interface DiaryDay {
  date: string;
  entries: DiaryEntryView[];
  /** Rounded day totals; unknown values count as 0 and are listed in `unknown`. */
  totals: MacroTargets;
  unknown: NutrientKey[];
  /** The latest goal's daily targets (not necessarily the one in effect on `date`). */
  target: MacroTargets | null;
  mealShares: MealShares;
  /** Breakfast, lunch, dinner, snack. */
  meals: MealView[];
}

/** Field-level problems the schema cannot see (they need the clock or the database). */
export type EntryProblem =
  | { kind: 'not_found' }
  | { kind: 'invalid'; fields: Record<string, string> };

export type EntryResult = { kind: 'ok'; entry: DiaryEntryView } | EntryProblem;

export interface DiaryStats {
  /** Days with at least one entry, up to `today`. */
  loggedDays: number;
  /** See `currentStreak` in @fitplan/core. */
  currentStreak: number;
  /** Entries up to `today`. */
  totalEntries: number;
}

type EntryRow = typeof diaryEntries.$inferSelect;

function per100gOf(row: EntryRow): Nutrients {
  return { kcal: row.kcal, proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG };
}

function toView(row: EntryRow): DiaryEntryView {
  return {
    id: row.id,
    date: row.date,
    meal: row.meal,
    foodId: row.foodId,
    name: row.foodName,
    nameZh: row.foodNameZh,
    portionId: row.portionId,
    portionLabel: row.portionLabel,
    quantity: row.quantity,
    grams: row.grams,
    nutrients: scaleNutrients(per100gOf(row), row.grams),
    slot: plateSlot({ category: row.foodCategory, per100g: per100gOf(row) }),
  };
}

type Candidate = SuggestionCandidate & { name: string; nameZh: string | null; portionLabel: string | null };

/** USDA foods curated as suggestions (data/usda-zh.csv `suggest_portion`), with that portion. */
async function suggestionCandidates(db: Db): Promise<Candidate[]> {
  const rows = await db
    .select({ food: foods, portion: foodPortions })
    .from(foods)
    .innerJoin(foodPortions, eq(foodPortions.id, foods.suggestPortionId))
    .where(isNotNull(foods.suggestPortionId));
  return rows.map(({ food, portion }) => {
    const per100g = { kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG };
    return {
      foodId: food.id,
      slot: plateSlot({ category: food.category, per100g }),
      per100g,
      portion: { id: portion.id, grams: portion.grams },
      name: food.name,
      nameZh: food.nameZh,
      portionLabel: portion.label,
    };
  });
}

function describe(suggestion: Suggestion, candidates: readonly Candidate[], rows: readonly EntryRow[]): SuggestionView | null {
  if (suggestion.kind === 'add') {
    const c = candidates.find((x) => x.foodId === suggestion.foodId);
    return c ? { ...suggestion, name: c.name, nameZh: c.nameZh, portionLabel: c.portionLabel } : null;
  }
  const row = rows.find((r) => r.id === suggestion.entryId);
  return row ? { ...suggestion, name: row.foodName, nameZh: row.foodNameZh, portionLabel: row.portionLabel } : null;
}

function mealViews(
  rows: readonly EntryRow[],
  daily: MacroTargets | null,
  shares: MealShares,
  candidates: readonly Candidate[],
): MealView[] {
  const targets = daily ? mealTargets(daily, shares) : null;
  return MEALS.map((meal) => {
    const inMeal = rows.filter((r) => r.meal === meal);
    const plate: PlateEntry[] = inMeal.map((r) => ({
      id: r.id,
      foodId: r.foodId,
      slot: plateSlot({ category: r.foodCategory, per100g: per100gOf(r) }),
      per100g: per100gOf(r),
      grams: r.grams,
      quantity: r.quantity,
      portionId: r.portionId,
    }));
    const { totals } = sumNutrients(plate.map((e) => scaleNutrients(e.per100g, e.grams)));
    const target = targets ? targets[meal] : null;
    const suggestions = target
      ? suggestAdjustments({ meal, target, entries: plate, candidates })
          .map((s) => describe(s, candidates, inMeal))
          .filter((s): s is SuggestionView => s !== null)
      : [];
    return {
      meal,
      target,
      totals,
      gap: target && plate.length > 0 ? mealGap(target, totals) : null,
      hasVegetables: plate.some((e) => e.slot === 'vegetable'),
      suggestions,
    };
  });
}

export async function getDiaryDay(db: Db, userId: string, date: string): Promise<DiaryDay> {
  const rows = await db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, date)))
    .orderBy(asc(diaryEntries.createdAt), asc(sql`rowid`));
  const entries = rows.map(toView);
  const { totals, unknown } = sumNutrients(entries.map((e) => e.nutrients));
  const [target, mealShares] = await Promise.all([getLatestTargets(db, userId), getMealShares(db, userId)]);
  const candidates = target && rows.length > 0 ? await suggestionCandidates(db) : [];
  return { date, entries, totals, unknown, target, mealShares, meals: mealViews(rows, target, mealShares, candidates) };
}

/** Totals for the profile page. `today` is the user's local date; later dates are ignored. */
export async function getDiaryStats(db: Db, userId: string, today: string): Promise<DiaryStats> {
  const upToToday = and(eq(diaryEntries.userId, userId), lte(diaryEntries.date, today));
  const [days, [entries]] = await db.batch([
    db.selectDistinct({ date: diaryEntries.date }).from(diaryEntries).where(upToToday),
    db.select({ n: count() }).from(diaryEntries).where(upToToday),
  ]);
  const dates = days.map((d) => d.date);
  return { loggedDays: dates.length, currentStreak: currentStreak(dates, today), totalEntries: entries?.n ?? 0 };
}

type Amount = { portionId: string | null; quantity: number };
type ResolvedAmount = { portionId: string | null; portionLabel: string | null; quantity: number; grams: number };

/** grams = portion grams × quantity, or quantity itself when there is no portion. */
async function resolveAmount(
  db: Db,
  foodId: string | null,
  amount: Amount,
): Promise<{ kind: 'ok'; amount: ResolvedAmount } | EntryProblem> {
  if (amount.portionId === null) {
    return { kind: 'ok', amount: { portionId: null, portionLabel: null, quantity: amount.quantity, grams: amount.quantity } };
  }
  const [portion] =
    foodId === null
      ? []
      : await db
          .select()
          .from(foodPortions)
          .where(and(eq(foodPortions.id, amount.portionId), eq(foodPortions.foodId, foodId)))
          .limit(1);
  if (!portion) return { kind: 'invalid', fields: { portionId: 'not_found' } };
  const grams = portion.grams * amount.quantity;
  if (grams > MAX_ENTRY_GRAMS) return { kind: 'invalid', fields: { quantity: 'too_big' } };
  return {
    kind: 'ok',
    amount: { portionId: portion.id, portionLabel: portion.label, quantity: amount.quantity, grams },
  };
}

export async function addDiaryEntry(db: Db, userId: string, input: DiaryEntryInput, now = new Date()): Promise<EntryResult> {
  if (!isDateWithinLogWindow(input.date, now)) return { kind: 'invalid', fields: { date: 'date_in_future' } };
  const food = await findVisibleFood(db, userId, input.foodId);
  if (!food) return { kind: 'not_found' };
  const resolved = await resolveAmount(db, food.id, input);
  if (resolved.kind !== 'ok') return resolved;

  const nowIso = now.toISOString();
  const [row] = await db
    .insert(diaryEntries)
    .values({
      id: crypto.randomUUID(),
      userId,
      date: input.date,
      meal: input.meal,
      foodId: food.id,
      foodName: food.name,
      foodNameZh: food.nameZh,
      foodCategory: food.category,
      ...resolved.amount,
      kcal: food.kcal,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      createdAt: nowIso,
      updatedAt: nowIso,
    })
    .returning();
  if (!row) throw new Error('diary entry insert returned no row');
  return { kind: 'ok', entry: toView(row) };
}

const ownEntry = (userId: string, id: string) => and(eq(diaryEntries.id, id), eq(diaryEntries.userId, userId));

/** Changes the meal and/or amount. The nutrient snapshot stays as logged; only grams change. */
export async function updateDiaryEntry(
  db: Db,
  userId: string,
  id: string,
  patch: DiaryEntryPatch,
  now = new Date(),
): Promise<EntryResult> {
  const [entry] = await db.select().from(diaryEntries).where(ownEntry(userId, id)).limit(1);
  if (!entry) return { kind: 'not_found' };

  let amount: ResolvedAmount | null = null;
  if (patch.quantity !== undefined && patch.portionId !== undefined) {
    const resolved = await resolveAmount(db, entry.foodId, { portionId: patch.portionId, quantity: patch.quantity });
    if (resolved.kind !== 'ok') return resolved;
    amount = resolved.amount;
  }

  const [row] = await db
    .update(diaryEntries)
    .set({ ...(patch.meal ? { meal: patch.meal } : {}), ...(amount ?? {}), updatedAt: now.toISOString() })
    .where(ownEntry(userId, id))
    .returning();
  if (!row) return { kind: 'not_found' };
  return { kind: 'ok', entry: toView(row) };
}

export async function deleteDiaryEntry(db: Db, userId: string, id: string): Promise<boolean> {
  const deleted = await db.delete(diaryEntries).where(ownEntry(userId, id)).returning({ id: diaryEntries.id });
  return deleted.length > 0;
}
