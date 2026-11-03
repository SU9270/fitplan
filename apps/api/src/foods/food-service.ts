import { per100gFromServing, plateSlot, type Nutrients, type PlateSlot } from '@fitplan/core';
import type { CustomFoodInput, FoodSearchQuery } from '@fitplan/validators';
import { and, asc, desc, eq, exists, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { foodPortions, foods } from '../db/schema';
import { buildSearchText } from './search-text';

export type FoodSource = 'usda' | 'custom';

export interface FoodSummary {
  id: string;
  source: FoodSource;
  name: string;
  nameZh: string | null;
  /** Per 100 g, unrounded; null = unknown. */
  per100g: Nutrients;
  /** The plate cell this food goes to. */
  slot: PlateSlot;
}

export interface FoodPortionView {
  id: string;
  /** Null for a custom food's unnamed serving (the app shows "1 serving"). */
  label: string | null;
  grams: number;
}

export interface FoodDetail extends FoodSummary {
  /** Per 100 g; null = unknown (always null for custom foods). */
  fiberG: number | null;
  sugarsG: number | null;
  sodiumMg: number | null;
  portions: FoodPortionView[];
}

type FoodRow = typeof foods.$inferSelect;

/** At most this many words of a query are matched (each must appear in the food's search text). */
const MAX_SEARCH_TERMS = 5;

/** Escape `\`, `%` and `_` for `LIKE … ESCAPE '\'`, so they match literally. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** The user's own custom foods plus all USDA foods. */
const visibleTo = (userId: string) => or(isNull(foods.ownerUserId), eq(foods.ownerUserId, userId));

function toSummary(row: FoodRow): FoodSummary {
  const per100g = { kcal: row.kcal, proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG };
  return {
    id: row.id,
    source: row.source === 'custom' ? 'custom' : 'usda',
    name: row.name,
    nameZh: row.nameZh,
    per100g,
    slot: plateSlot({ category: row.category, per100g }),
  };
}

/**
 * Every word must appear in the search text (names and aliases, one per line). Ranking: a whole
 * line equals the query → a line starts with it → has a Chinese name → the rest; within a tier
 * shown names starting with the query first, then the user's own foods, then shorter names.
 */
export async function searchFoods(db: Db, userId: string, query: FoodSearchQuery): Promise<FoodSummary[]> {
  const whole = query.q.toLowerCase();
  const terms = whole.split(/\s+/).filter((t) => t !== '').slice(0, MAX_SEARCH_TERMS);
  const matches: SQL[] = terms.map((t) => sql`${foods.searchText} LIKE ${`%${escapeLike(t)}%`} ESCAPE '\\'`);
  const lines = sql`(char(10) || ${foods.searchText} || char(10))`;
  const tier = sql`CASE
    WHEN ${lines} LIKE ${`%\n${escapeLike(whole)}\n%`} ESCAPE '\\' THEN 0
    WHEN ${lines} LIKE ${`%\n${escapeLike(whole)}%`} ESCAPE '\\' THEN 1
    WHEN ${foods.nameZh} IS NOT NULL THEN 2
    ELSE 3 END`;

  // Within a tier, a shown name that starts with the query beats one that merely contains it
  // ("鸡蛋（生）" before "煎蛋" when both have the alias 鸡蛋).
  const shownName = sql`lower(coalesce(${foods.nameZh}, ${foods.name}))`;
  const shownPrefix = sql`CASE WHEN ${shownName} LIKE ${`${escapeLike(whole)}%`} ESCAPE '\\' THEN 0 ELSE 1 END`;

  const rows = await db
    .select()
    .from(foods)
    .where(and(visibleTo(userId), ...matches))
    .orderBy(tier, shownPrefix, sql`${foods.ownerUserId} IS NULL`, sql`length(${shownName})`, asc(foods.name))
    .limit(query.limit);
  return rows.map(toSummary);
}

/** The user's own custom foods, most recently changed first. */
export async function listOwnFoods(db: Db, userId: string): Promise<FoodSummary[]> {
  const rows = await db
    .select()
    .from(foods)
    .where(and(eq(foods.source, 'custom'), eq(foods.ownerUserId, userId)))
    .orderBy(desc(foods.updatedAt), asc(foods.name));
  return rows.map(toSummary);
}

async function portionsOf(db: Db, foodId: string): Promise<FoodPortionView[]> {
  return db
    .select({ id: foodPortions.id, label: foodPortions.label, grams: foodPortions.grams })
    .from(foodPortions)
    .where(eq(foodPortions.foodId, foodId))
    .orderBy(asc(foodPortions.sortOrder), asc(foodPortions.id));
}

function toDetail(row: FoodRow, portions: FoodPortionView[]): FoodDetail {
  return { ...toSummary(row), fiberG: row.fiberG, sugarsG: row.sugarsG, sodiumMg: row.sodiumMg, portions };
}

/** A food the user may see (any USDA food or their own custom food), or null. */
export async function findVisibleFood(db: Db, userId: string, id: string): Promise<FoodRow | null> {
  const [row] = await db.select().from(foods).where(and(eq(foods.id, id), visibleTo(userId))).limit(1);
  return row ?? null;
}

export async function getFood(db: Db, userId: string, id: string): Promise<FoodDetail | null> {
  const row = await findVisibleFood(db, userId, id);
  return row ? toDetail(row, await portionsOf(db, row.id)) : null;
}

/** The label's per-serving values stored per 100 g, plus the matching search text. */
function customFoodColumns(input: CustomFoodInput) {
  const per100g = per100gFromServing(
    { kcal: input.kcal, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG },
    input.servingGrams,
  );
  return {
    name: input.name,
    searchText: buildSearchText(input.name, null, []),
    kcal: per100g.kcal,
    proteinG: per100g.proteinG,
    carbsG: per100g.carbsG,
    fatG: per100g.fatG,
  };
}

/** Creates a custom food with one portion: the label's serving. */
export async function createCustomFood(db: Db, userId: string, input: CustomFoodInput, now = new Date()): Promise<FoodDetail> {
  const id = crypto.randomUUID();
  const portion = { id: crypto.randomUUID(), foodId: id, label: input.servingLabel, grams: input.servingGrams, sortOrder: 0 };
  const nowIso = now.toISOString();
  await db.batch([
    db.insert(foods).values({
      id,
      source: 'custom',
      ownerUserId: userId,
      ...customFoodColumns(input),
      createdAt: nowIso,
      updatedAt: nowIso,
    }),
    db.insert(foodPortions).values(portion),
  ]);
  const created = await getFood(db, userId, id);
  if (!created) throw new Error('custom food missing right after insert');
  return created;
}

const ownCustomFood = (userId: string, id: string) =>
  and(eq(foods.id, id), eq(foods.source, 'custom'), eq(foods.ownerUserId, userId));

/**
 * Replaces the user's custom food (null when it is not theirs). The serving portion keeps its
 * id, so diary entries logged with it still point at it; their nutrient snapshots stay as logged.
 */
export async function updateCustomFood(
  db: Db,
  userId: string,
  id: string,
  input: CustomFoodInput,
  now = new Date(),
): Promise<FoodDetail | null> {
  // One atomic batch; the portion update repeats the ownership check, so it is a no-op too
  // when the food is not the user's.
  const [updated] = await db.batch([
    db
      .update(foods)
      .set({ ...customFoodColumns(input), updatedAt: now.toISOString() })
      .where(ownCustomFood(userId, id))
      .returning({ id: foods.id }),
    db
      .update(foodPortions)
      .set({ label: input.servingLabel, grams: input.servingGrams })
      .where(and(eq(foodPortions.foodId, id), exists(db.select().from(foods).where(ownCustomFood(userId, id))))),
  ]);
  if (updated.length === 0) return null;
  return getFood(db, userId, id);
}

/** Deletes the user's custom food; diary entries keep their snapshot (food_id becomes NULL). */
export async function deleteCustomFood(db: Db, userId: string, id: string): Promise<boolean> {
  const deleted = await db.delete(foods).where(ownCustomFood(userId, id)).returning({ id: foods.id });
  return deleted.length > 0;
}
