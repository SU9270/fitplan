import { scaleNutrients } from '@fitplan/core';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { diaryEntries, favoriteFoods, foodPortions, foods } from '../db/schema';
import { findVisibleFood, toSummary, visibleTo, type FoodSummary } from './food-service';

// See docs/superpowers/specs/2026-11-22-my-food-library-design.md.

export interface FavoriteFood extends FoodSummary {
  /** Image key in the food library tab; null = no picture. */
  libraryKey: string | null;
  /** The amount a one-tap add logs: a portion, or grams when `portionId` is null. */
  portionId: string | null;
  portionLabel: string | null;
  quantity: number;
  grams: number;
  /** kcal of that amount with the food's current values; null = unknown. */
  kcal: number | null;
}

type Amount = Pick<FavoriteFood, 'portionId' | 'portionLabel' | 'quantity' | 'grams'>;

/** The food page's default when a food has no portions. */
const DEFAULT_GRAMS = 100;

/** Star a food. False when the user cannot see it (not found, or someone else's custom food). */
export async function addFavorite(db: Db, userId: string, foodId: string, now = new Date()): Promise<boolean> {
  const food = await findVisibleFood(db, userId, foodId);
  if (!food) return false;
  await db.insert(favoriteFoods).values({ userId, foodId: food.id, createdAt: now.toISOString() }).onConflictDoNothing();
  return true;
}

/** Unstar a food; a food that was not starred is left as it is. */
export async function removeFavorite(db: Db, userId: string, foodId: string): Promise<void> {
  await db.delete(favoriteFoods).where(and(eq(favoriteFoods.userId, userId), eq(favoriteFoods.foodId, foodId)));
}

/**
 * The user's starred foods, newest first, each with the amount a one-tap add logs: the amount of
 * the newest diary entry (the rule of `getRecentFoods`), else the first portion × 1, else 100 g.
 */
export async function listFavorites(db: Db, userId: string): Promise<FavoriteFood[]> {
  // A subquery, not a list of ids: D1 allows 100 bound parameters per query.
  const starred = db.select({ id: favoriteFoods.foodId }).from(favoriteFoods).where(eq(favoriteFoods.userId, userId));
  const [rows, entries, portions] = await Promise.all([
    db
      .select({ food: foods })
      .from(favoriteFoods)
      .innerJoin(foods, eq(foods.id, favoriteFoods.foodId))
      .where(and(eq(favoriteFoods.userId, userId), visibleTo(userId)))
      .orderBy(desc(favoriteFoods.createdAt), desc(sql`${favoriteFoods}.rowid`)),
    db
      .select({
        foodId: diaryEntries.foodId,
        portionId: diaryEntries.portionId,
        portionLabel: diaryEntries.portionLabel,
        quantity: diaryEntries.quantity,
        grams: diaryEntries.grams,
      })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, userId), inArray(diaryEntries.foodId, starred)))
      .orderBy(desc(diaryEntries.createdAt), desc(sql`${diaryEntries}.rowid`)),
    db
      .select({ id: foodPortions.id, foodId: foodPortions.foodId, label: foodPortions.label, grams: foodPortions.grams })
      .from(foodPortions)
      .where(inArray(foodPortions.foodId, starred))
      .orderBy(asc(foodPortions.sortOrder), asc(foodPortions.id)),
  ]);

  const portionById = new Map(portions.map((portion) => [portion.id, portion]));
  const lastLogged = new Map<string, Amount>();
  for (const entry of entries) {
    if (entry.foodId === null || lastLogged.has(entry.foodId)) continue;
    // A deleted portion leaves its label behind on the entry: log grams instead.
    const portion = entry.portionId === null ? undefined : portionById.get(entry.portionId);
    lastLogged.set(
      entry.foodId,
      portion
        ? // The add resolves the portion as it is now (a re-import or an edit may have changed its
          // weight), so show that weight, not the one the old entry was logged with.
          { portionId: portion.id, portionLabel: portion.label, quantity: entry.quantity, grams: portion.grams * entry.quantity }
        : { portionId: null, portionLabel: null, quantity: entry.grams, grams: entry.grams },
    );
  }
  const firstPortion = new Map<string, Amount>();
  for (const portion of portions) {
    if (firstPortion.has(portion.foodId)) continue;
    firstPortion.set(portion.foodId, { portionId: portion.id, portionLabel: portion.label, quantity: 1, grams: portion.grams });
  }
  const inGrams: Amount = { portionId: null, portionLabel: null, quantity: DEFAULT_GRAMS, grams: DEFAULT_GRAMS };

  return rows.map(({ food }) => {
    const summary = toSummary(food);
    const amount = lastLogged.get(food.id) ?? firstPortion.get(food.id) ?? inGrams;
    return { ...summary, libraryKey: food.libraryKey, ...amount, kcal: scaleNutrients(summary.per100g, amount.grams).kcal };
  });
}
