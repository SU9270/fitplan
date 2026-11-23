import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { unique } from './helpers';

// Migration 0008 rebuilds `foods` to allow the `cn_fct` source. D1 runs a migration inside a
// transaction, where `PRAGMA foreign_keys=OFF` does nothing, so dropping the old table fires the
// ON DELETE actions of every table pointing at it. The migration has to put those rows back.
const MIGRATION = '0008_food_source_cn.sql';

async function rerunMigration() {
  const migration = env.TEST_MIGRATIONS.find((m) => m.name === MIGRATION);
  if (!migration) throw new Error(`${MIGRATION} not found`);
  await env.DB.batch(migration.queries.map((q) => env.DB.prepare(q)));
}

async function seed() {
  const userId = unique('user');
  const foodId = unique('usda');
  const portionId = unique('portion');
  const entryId = unique('entry');
  const templateId = unique('template');
  const itemId = unique('item');
  const fdcId = Math.floor(Math.random() * 1e9) + 1e9;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO user (id, name, email) VALUES (?, ?, ?)').bind(userId, 'Test', `${userId}@example.com`),
    env.DB.prepare(
      "INSERT INTO foods (id, source, fdc_id, name, search_text, kcal, library_key, library_rank) VALUES (?, 'usda_sr_legacy', ?, 'Bread', 'bread', 266, ?, 7)",
    ).bind(foodId, fdcId, unique('key').replaceAll('-', '_').toLowerCase()),
    env.DB.prepare("INSERT INTO food_portions (id, food_id, label, grams, sort_order) VALUES (?, ?, '1 slice', 29, 1)").bind(portionId, foodId),
    env.DB.prepare('INSERT INTO favorite_foods (user_id, food_id) VALUES (?, ?)').bind(userId, foodId),
    env.DB.prepare(
      "INSERT INTO diary_entries (id, user_id, date, meal, food_id, food_name, portion_id, portion_label, quantity, grams) VALUES (?, ?, '2026-11-22', 'lunch', ?, 'Bread', ?, '1 slice', 1, 29)",
    ).bind(entryId, userId, foodId, portionId),
    env.DB.prepare("INSERT INTO meal_templates (id, user_id, name) VALUES (?, ?, 'Lunch')").bind(templateId, userId),
    env.DB.prepare(
      "INSERT INTO meal_template_items (id, template_id, position, food_id, food_name, portion_id, portion_label, quantity, grams) VALUES (?, ?, 0, ?, 'Bread', ?, '1 slice', 1, 29)",
    ).bind(itemId, templateId, foodId, portionId),
  ]);
  return { userId, foodId, portionId, entryId, itemId };
}

describe('migration 0008 (food source cn_fct)', () => {
  it('keeps portions, favorites and the food links of diary entries and saved meals', async () => {
    const s = await seed();
    await rerunMigration();

    const food = await env.DB.prepare('SELECT kcal, library_rank FROM foods WHERE id = ?').bind(s.foodId).first();
    expect(food).toEqual({ kcal: 266, library_rank: 7 });
    const portion = await env.DB.prepare('SELECT food_id, grams FROM food_portions WHERE id = ?').bind(s.portionId).first();
    expect(portion).toEqual({ food_id: s.foodId, grams: 29 });
    const favorite = await env.DB.prepare('SELECT food_id FROM favorite_foods WHERE user_id = ?').bind(s.userId).first();
    expect(favorite).toEqual({ food_id: s.foodId });
    const entry = await env.DB.prepare('SELECT food_id, portion_id FROM diary_entries WHERE id = ?').bind(s.entryId).first();
    expect(entry).toEqual({ food_id: s.foodId, portion_id: s.portionId });
    const item = await env.DB.prepare('SELECT food_id, portion_id FROM meal_template_items WHERE id = ?').bind(s.itemId).first();
    expect(item).toEqual({ food_id: s.foodId, portion_id: s.portionId });
  });

  it('accepts China Food Composition Table foods without an owner or FDC id, and nothing else new', async () => {
    const id = unique('cn');
    await env.DB.prepare("INSERT INTO foods (id, source, name, search_text) VALUES (?, 'cn_fct', 'Steamed bun', 'steamed bun')").bind(id).run();
    expect(await env.DB.prepare('SELECT source FROM foods WHERE id = ?').bind(id).first()).toEqual({ source: 'cn_fct' });

    await expect(
      env.DB.prepare("INSERT INTO foods (id, source, fdc_id, name, search_text) VALUES (?, 'cn_fct', 1, 'x', 'x')").bind(unique('cn')).run(),
    ).rejects.toThrow(/CHECK/);
    await expect(
      env.DB.prepare("INSERT INTO foods (id, source, name, search_text) VALUES (?, 'other', 'x', 'x')").bind(unique('x')).run(),
    ).rejects.toThrow(/CHECK/);
  });

  it('keeps the unique library key index', async () => {
    const key = 'dup_key_test';
    await env.DB.prepare("INSERT INTO foods (id, source, name, search_text, library_key) VALUES (?, 'cn_fct', 'a', 'a', ?)").bind(unique('cn'), key).run();
    await expect(
      env.DB.prepare("INSERT INTO foods (id, source, name, search_text, library_key) VALUES (?, 'cn_fct', 'b', 'b', ?)").bind(unique('cn'), key).run(),
    ).rejects.toThrow(/UNIQUE/);
  });
});
