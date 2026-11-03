import {
  MEALS,
  NUTRIENT_BASIS_G,
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
  type DiaryCopyInput,
  type DiaryEntryInput,
  type DiaryEntryPatch,
  type Meal,
  type QuickAddInput,
} from '@fitplan/validators';
import { and, asc, count, desc, eq, isNotNull, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { diaryEntries, foodPortions, foods } from '../db/schema';
import { findVisibleFood, visibleTo } from '../foods/food-service';
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
  /** A nutrient-only "快速添加" entry: no amount to show or change. */
  quick: boolean;
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
    quick: row.isQuick,
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
      category: food.category,
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
      gap: target && plate.length > 0 ? mealGap(meal, target, totals) : null,
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
  if (patch.quantity !== undefined && entry.isQuick) {
    return { kind: 'invalid', fields: { quantity: 'quick_entry' } };
  }
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

// ---------------------------------------------------------------------------
// Logging efficiency (docs/superpowers/specs/2026-11-03-logging-efficiency-design.md)
// ---------------------------------------------------------------------------

/** The columns that make an entry's snapshot (shared by copies and "我的餐"). */
export type EntrySnapshot = Pick<
  EntryRow,
  | 'foodId'
  | 'foodName'
  | 'foodNameZh'
  | 'foodCategory'
  | 'isQuick'
  | 'portionId'
  | 'portionLabel'
  | 'quantity'
  | 'grams'
  | 'kcal'
  | 'proteinG'
  | 'carbsG'
  | 'fatG'
>;

export function snapshotOf(row: EntrySnapshot): EntrySnapshot {
  return {
    foodId: row.foodId,
    foodName: row.foodName,
    foodNameZh: row.foodNameZh,
    foodCategory: row.foodCategory,
    isQuick: row.isQuick,
    portionId: row.portionId,
    portionLabel: row.portionLabel,
    quantity: row.quantity,
    grams: row.grams,
    kcal: row.kcal,
    proteinG: row.proteinG,
    carbsG: row.carbsG,
    fatG: row.fatG,
  };
}

/** Insert snapshots as new entries of `date` / `meal`, in the given order. Returns the count. */
export async function insertSnapshots(
  db: Db,
  userId: string,
  date: string,
  items: readonly { meal: Meal; snapshot: EntrySnapshot }[],
  now: Date,
): Promise<number> {
  if (items.length === 0) return 0;
  const nowIso = now.toISOString();
  await db.insert(diaryEntries).values(
    items.map(({ meal, snapshot }) => ({
      id: crypto.randomUUID(),
      userId,
      date,
      meal,
      ...snapshot,
      createdAt: nowIso,
      updatedAt: nowIso,
    })),
  );
  return items.length;
}

/** "快速添加": nutrients only, stored per 100 g with grams 100 so totals need no special case. */
export async function addQuickEntry(db: Db, userId: string, input: QuickAddInput, now = new Date()): Promise<EntryResult> {
  if (!isDateWithinLogWindow(input.date, now)) return { kind: 'invalid', fields: { date: 'date_in_future' } };
  const nowIso = now.toISOString();
  const [row] = await db
    .insert(diaryEntries)
    .values({
      id: crypto.randomUUID(),
      userId,
      date: input.date,
      meal: input.meal,
      foodId: null,
      foodName: input.name,
      foodNameZh: null,
      foodCategory: null,
      isQuick: true,
      portionId: null,
      portionLabel: null,
      quantity: 1,
      grams: NUTRIENT_BASIS_G,
      kcal: input.kcal,
      proteinG: input.proteinG,
      carbsG: input.carbsG,
      fatG: input.fatG,
      createdAt: nowIso,
      updatedAt: nowIso,
    })
    .returning();
  if (!row) throw new Error('quick entry insert returned no row');
  return { kind: 'ok', entry: toView(row) };
}

export type CopyResult = { kind: 'ok'; copied: number } | { kind: 'invalid'; fields: Record<string, string> };

/** Copy a day (or one meal of it) to another day, same meals, as snapshots. */
export async function copyDiary(db: Db, userId: string, input: DiaryCopyInput, now = new Date()): Promise<CopyResult> {
  if (!isDateWithinLogWindow(input.toDate, now)) return { kind: 'invalid', fields: { toDate: 'date_in_future' } };
  const rows = await db
    .select()
    .from(diaryEntries)
    .where(
      and(
        eq(diaryEntries.userId, userId),
        eq(diaryEntries.date, input.fromDate),
        input.meal ? eq(diaryEntries.meal, input.meal) : undefined,
      ),
    )
    .orderBy(asc(diaryEntries.createdAt), asc(sql`rowid`));
  const copied = await insertSnapshots(
    db,
    userId,
    input.toDate,
    rows.map((r) => ({ meal: r.meal, snapshot: snapshotOf(r) })),
    now,
  );
  return { kind: 'ok', copied };
}

export interface RecentFood {
  foodId: string;
  /** The food's current names and plate cell. */
  name: string;
  nameZh: string | null;
  slot: PlateSlot;
  /** The last amount logged: a portion (when it still exists) or grams. */
  portionId: string | null;
  portionLabel: string | null;
  quantity: number;
  grams: number;
  /** kcal of that amount with the food's current values; null = unknown. */
  kcal: number | null;
  /** Entries in the last 30 days. */
  count: number;
}

/** Look back over this many of the user's latest entries. */
const RECENT_SCAN_LIMIT = 500;
const FREQUENT_WINDOW_DAYS = 30;
const FREQUENT_MIN_COUNT = 2;
const FREQUENT_MAX = 5;
const RECENT_MAX = 10;

/**
 * Foods the user logs often (>= 2 times in 30 days, by count) and lately (by last time, not
 * repeating the frequent ones), with the last amount for a one-tap re-log. Only foods the user
 * can still see; quick-add entries have no food and are skipped.
 */
export async function getRecentFoods(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<{ frequent: RecentFood[]; recent: RecentFood[] }> {
  const rows = await db
    .select({ entry: diaryEntries, food: foods })
    .from(diaryEntries)
    .innerJoin(foods, eq(foods.id, diaryEntries.foodId))
    .where(and(eq(diaryEntries.userId, userId), visibleTo(userId)))
    .orderBy(desc(diaryEntries.createdAt), desc(sql`${diaryEntries}.rowid`))
    .limit(RECENT_SCAN_LIMIT);

  const cutoff = new Date(now.getTime() - FREQUENT_WINDOW_DAYS * 86_400_000).toISOString();
  const byFood = new Map<string, RecentFood & { lastAt: string }>();
  for (const { entry, food } of rows) {
    const existing = byFood.get(food.id);
    const inWindow = entry.createdAt >= cutoff ? 1 : 0;
    if (existing) {
      existing.count += inWindow;
      continue;
    }
    // The newest entry decides the amount. A deleted portion leaves its label behind: use grams.
    const byPortion = entry.portionId !== null;
    const per100g = { kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG };
    byFood.set(food.id, {
      foodId: food.id,
      name: food.name,
      nameZh: food.nameZh,
      slot: plateSlot({ category: food.category, per100g }),
      portionId: entry.portionId,
      portionLabel: byPortion ? entry.portionLabel : null,
      quantity: byPortion ? entry.quantity : entry.grams,
      grams: entry.grams,
      kcal: scaleNutrients(per100g, entry.grams).kcal,
      count: inWindow,
      lastAt: entry.createdAt,
    });
  }

  const all = [...byFood.values()];
  const frequent = all
    .filter((f) => f.count >= FREQUENT_MIN_COUNT)
    .sort((a, b) => b.count - a.count || (a.lastAt < b.lastAt ? 1 : -1))
    .slice(0, FREQUENT_MAX);
  const shown = new Set(frequent.map((f) => f.foodId));
  const recent = all.filter((f) => !shown.has(f.foodId)).slice(0, RECENT_MAX);
  const strip = ({ lastAt: _lastAt, ...food }: RecentFood & { lastAt: string }): RecentFood => food;
  return { frequent: frequent.map(strip), recent: recent.map(strip) };
}
