import { libraryGroups, type LibraryGroup } from '@fitplan/core';
import { asc, isNotNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { foods } from '../db/schema';
import { toSummary, type FoodSummary } from './food-service';

export interface LibraryFood extends FoodSummary {
  /** Image key (apps/mobile/assets/library/<key>.png). */
  key: string;
  /** The library groups the food appears in, in display order. */
  groups: LibraryGroup[];
  /** Per 100 g; null = unknown. */
  fiberG: number | null;
  omega3AlaG: number | null;
  omega3EpaDhaG: number | null;
}

/** The food library tab: the curated foods (data/usda-zh.csv `library`) in the csv's order. */
export async function listLibrary(db: Db): Promise<LibraryFood[]> {
  const rows = await db
    .select()
    .from(foods)
    .where(isNotNull(foods.libraryKey))
    .orderBy(asc(foods.libraryRank), asc(foods.id));
  const library: LibraryFood[] = [];
  for (const row of rows) {
    if (row.libraryKey === null) continue;
    const summary = toSummary(row);
    const extras = { fiberG: row.fiberG, omega3AlaG: row.omega3AlaG, omega3EpaDhaG: row.omega3EpaDhaG };
    const groups = libraryGroups({ category: row.category, per100g: summary.per100g, ...extras });
    library.push({ ...summary, key: row.libraryKey, groups, ...extras });
  }
  return library;
}
