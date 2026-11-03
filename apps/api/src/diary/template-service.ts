import { scaleNutrients, sumNutrients } from '@fitplan/core';
import { isDateWithinLogWindow, type MealTemplateApply, type MealTemplateInput } from '@fitplan/validators';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { diaryEntries, mealTemplateItems, mealTemplates } from '../db/schema';
import { insertSnapshots, snapshotOf, type CopyResult } from './diary-service';

export interface MealTemplateView {
  id: string;
  name: string;
  /** Item names in order (Chinese name when there is one is chosen by the app). */
  items: { name: string; nameZh: string | null; quick: boolean }[];
  /** Rounded total of the items. */
  kcal: number;
  createdAt: string;
}

type ItemRow = typeof mealTemplateItems.$inferSelect;

function toView(template: typeof mealTemplates.$inferSelect, items: readonly ItemRow[]): MealTemplateView {
  const { totals } = sumNutrients(
    items.map((i) => scaleNutrients({ kcal: i.kcal, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG }, i.grams)),
  );
  return {
    id: template.id,
    name: template.name,
    items: items.map((i) => ({ name: i.foodName, nameZh: i.foodNameZh, quick: i.isQuick })),
    kcal: totals.kcal,
    createdAt: template.createdAt,
  };
}

/** The user's saved meals, newest first. */
export async function listTemplates(db: Db, userId: string): Promise<MealTemplateView[]> {
  const templates = await db
    .select()
    .from(mealTemplates)
    .where(eq(mealTemplates.userId, userId))
    .orderBy(desc(mealTemplates.createdAt), desc(sql`rowid`));
  if (templates.length === 0) return [];
  const items = await db
    .select()
    .from(mealTemplateItems)
    .where(
      inArray(
        mealTemplateItems.templateId,
        templates.map((t) => t.id),
      ),
    )
    .orderBy(asc(mealTemplateItems.position));
  return templates.map((t) => toView(t, items.filter((i) => i.templateId === t.id)));
}

/** Save one meal of a day as a template (snapshots). Null when that meal has no entries. */
export async function createTemplate(
  db: Db,
  userId: string,
  input: MealTemplateInput,
  now = new Date(),
): Promise<MealTemplateView | null> {
  const entries = await db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, input.date), eq(diaryEntries.meal, input.meal)))
    .orderBy(asc(diaryEntries.createdAt), asc(sql`rowid`));
  if (entries.length === 0) return null;

  const template = { id: crypto.randomUUID(), userId, name: input.name, createdAt: now.toISOString() };
  const items: ItemRow[] = entries.map((entry, position) => ({
    id: crypto.randomUUID(),
    templateId: template.id,
    position,
    ...snapshotOf(entry),
  }));
  await db.batch([db.insert(mealTemplates).values(template), db.insert(mealTemplateItems).values(items)]);
  return toView(template, items);
}

const ownTemplate = (userId: string, id: string) => and(eq(mealTemplates.id, id), eq(mealTemplates.userId, userId));

/** Add a template's items to a day and meal. `not_found` when the template is not the user's. */
export async function applyTemplate(
  db: Db,
  userId: string,
  id: string,
  input: MealTemplateApply,
  now = new Date(),
): Promise<CopyResult | { kind: 'not_found' }> {
  const [template] = await db.select().from(mealTemplates).where(ownTemplate(userId, id)).limit(1);
  if (!template) return { kind: 'not_found' };
  if (!isDateWithinLogWindow(input.date, now)) return { kind: 'invalid', fields: { date: 'date_in_future' } };
  const items = await db
    .select()
    .from(mealTemplateItems)
    .where(eq(mealTemplateItems.templateId, template.id))
    .orderBy(asc(mealTemplateItems.position));
  const copied = await insertSnapshots(
    db,
    userId,
    input.date,
    items.map((item) => ({ meal: input.meal, snapshot: snapshotOf(item) })),
    now,
  );
  return { kind: 'ok', copied };
}

export async function deleteTemplate(db: Db, userId: string, id: string): Promise<boolean> {
  const deleted = await db.delete(mealTemplates).where(ownTemplate(userId, id)).returning({ id: mealTemplates.id });
  return deleted.length > 0;
}
