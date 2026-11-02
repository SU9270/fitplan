import { scaleNutrients, sumNutrients, type MacroTargets, type NutrientKey, type Nutrients } from '@fitplan/core';
import {
  MAX_ENTRY_GRAMS,
  isDateWithinLogWindow,
  type DiaryEntryInput,
  type DiaryEntryPatch,
  type Meal,
} from '@fitplan/validators';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { diaryEntries, foodPortions } from '../db/schema';
import { findVisibleFood } from '../foods/food-service';
import { getLatestTargets } from '../profile-service';

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
}

export interface DiaryDay {
  date: string;
  entries: DiaryEntryView[];
  /** Rounded day totals; unknown values count as 0 and are listed in `unknown`. */
  totals: MacroTargets;
  unknown: NutrientKey[];
  /** The latest goal's daily targets (not necessarily the one in effect on `date`). */
  target: MacroTargets | null;
}

/** Field-level problems the schema cannot see (they need the clock or the database). */
export type EntryProblem =
  | { kind: 'not_found' }
  | { kind: 'invalid'; fields: Record<string, string> };

export type EntryResult = { kind: 'ok'; entry: DiaryEntryView } | EntryProblem;

type EntryRow = typeof diaryEntries.$inferSelect;

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
    nutrients: scaleNutrients({ kcal: row.kcal, proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG }, row.grams),
  };
}

export async function getDiaryDay(db: Db, userId: string, date: string): Promise<DiaryDay> {
  const rows = await db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, date)))
    .orderBy(asc(diaryEntries.createdAt), asc(sql`rowid`));
  const entries = rows.map(toView);
  const { totals, unknown } = sumNutrients(entries.map((e) => e.nutrients));
  return { date, entries, totals, unknown, target: await getLatestTargets(db, userId) };
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
