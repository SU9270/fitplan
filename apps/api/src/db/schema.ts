// Better Auth tables (user, session, account, verification) were generated with
// the official CLI (`pnpm dlx auth@1.7.14 generate`, drizzle adapter, sqlite) and
// are kept as generated: Better Auth reads/writes these columns itself, so they use
// its integer millisecond timestamps rather than our ISO-text convention.
// App-owned tables follow the spec convention (ISO-8601 UTC text, CHECK constraints).
import { relations, sql } from 'drizzle-orm';
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .default(false)
    .notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

/**
 * Better Auth rate-limit counters (`rateLimit.storage: 'database'`). Fields follow Better
 * Auth 1.7.14's `rateLimit` model (key unique, count, lastRequest in epoch ms); the `id` is
 * required by the drizzle adapter's atomic increment.
 */
export const rateLimit = sqliteTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: integer('last_request').notNull(),
});

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

export const inviteCodes = sqliteTable(
  'invite_codes',
  {
    code: text('code').primaryKey(),
    maxUses: integer('max_uses').notNull(),
    usedCount: integer('used_count').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [
    check('invite_codes_max_uses_positive', sql`${table.maxUses} > 0`),
    check('invite_codes_used_count_range', sql`${table.usedCount} >= 0 AND ${table.usedCount} <= ${table.maxUses}`),
  ],
);

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** One row per user: the latest questionnaire answers (metric units). Overwritten on every save. */
export const profiles = sqliteTable(
  'profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    birthYear: integer('birth_year').notNull(),
    sex: text('sex', { enum: ['male', 'female', 'unspecified'] }).notNull(),
    heightCm: real('height_cm').notNull(),
    weightKg: real('weight_kg').notNull(),
    activityLevel: integer('activity_level').notNull(),
    trainingDaysPerWeek: integer('training_days_per_week').notNull(),
    trainingExperience: text('training_experience', { enum: ['beginner', 'intermediate', 'advanced'] }).notNull(),
    goal: text('goal', { enum: ['lose', 'gain'] }).notNull(),
    pace: text('pace', { enum: ['conservative', 'standard', 'aggressive'] }).notNull(),
    /** JSON `HealthFlags`. */
    healthFlags: text('health_flags').notNull(),
    unitSystem: text('unit_system', { enum: ['metric', 'imperial'] }).notNull(),
    locale: text('locale', { enum: ['zh', 'en'] }).notNull(),
    // Meal shares of the daily targets in percent (phase 3). Range and total (100) are checked by
    // mealSharesSchema: adding CHECKs to an existing SQLite table would mean rebuilding it.
    mealShareBreakfast: integer('meal_share_breakfast').notNull().default(25),
    mealShareLunch: integer('meal_share_lunch').notNull().default(30),
    mealShareDinner: integer('meal_share_dinner').notNull().default(30),
    mealShareSnack: integer('meal_share_snack').notNull().default(15),
    updatedAt: text('updated_at').notNull().default(nowIso),
  },
  (table) => [
    check('profiles_sex_check', sql`${table.sex} IN ('male', 'female', 'unspecified')`),
    check('profiles_activity_level_check', sql`${table.activityLevel} BETWEEN 1 AND 5`),
    check('profiles_training_days_check', sql`${table.trainingDaysPerWeek} BETWEEN 0 AND 7`),
    check(
      'profiles_training_experience_check',
      sql`${table.trainingExperience} IN ('beginner', 'intermediate', 'advanced')`,
    ),
    check('profiles_goal_check', sql`${table.goal} IN ('lose', 'gain')`),
    check('profiles_pace_check', sql`${table.pace} IN ('conservative', 'standard', 'aggressive')`),
    check('profiles_unit_system_check', sql`${table.unitSystem} IN ('metric', 'imperial')`),
    check('profiles_locale_check', sql`${table.locale} IN ('zh', 'en')`),
  ],
);

/**
 * Append-only history of computed targets. Only `safe` / `confirm` results are stored
 * (a `blocked` result has no targets), so the macro columns are never NULL.
 */
export const goalVersions = sqliteTable(
  'goal_versions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    effectiveAt: text('effective_at').notNull(),
    /** JSON of the target-relevant input (`toTargetInput`), serialized with a fixed key order. */
    inputSnapshot: text('input_snapshot').notNull(),
    status: text('status', { enum: ['safe', 'confirm'] }).notNull(),
    /** JSON `GuardrailReason[]`. */
    reasons: text('reasons').notNull(),
    bmi: real('bmi').notNull(),
    bmrKcal: integer('bmr_kcal').notNull(),
    tdeeKcal: integer('tdee_kcal').notNull(),
    kcal: integer('kcal').notNull(),
    proteinG: integer('protein_g').notNull(),
    carbsG: integer('carbs_g').notNull(),
    fatG: integer('fat_g').notNull(),
  },
  (table) => [
    index('goal_versions_user_effective_idx').on(table.userId, table.effectiveAt),
    check('goal_versions_status_check', sql`${table.status} IN ('safe', 'confirm')`),
  ],
);

/** Append-only consent log; the latest row per (user, kind) is the current state. */
export const consents = sqliteTable(
  'consents',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['health_data'] }).notNull(),
    version: text('version').notNull(),
    granted: integer('granted', { mode: 'boolean' }).notNull(),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (table) => [
    index('consents_user_created_idx').on(table.userId, table.createdAt),
    check('consents_kind_check', sql`${table.kind} IN ('health_data')`),
    check('consents_granted_check', sql`${table.granted} IN (0, 1)`),
  ],
);

// ---------------------------------------------------------------------------
// Food library (phase 2). Nutrient columns are per 100 g; NULL means unknown.
// ---------------------------------------------------------------------------

/** USDA SR Legacy foods (`usda-<fdc_id>`, imported by scripts/import-usda.ts) and users' custom foods. */
export const foods = sqliteTable(
  'foods',
  {
    id: text('id').primaryKey(),
    source: text('source', { enum: ['usda_sr_legacy', 'custom'] }).notNull(),
    fdcId: integer('fdc_id').unique(),
    ownerUserId: text('owner_user_id').references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameZh: text('name_zh'),
    /** `|`-separated extra search terms (Chinese and English). */
    aliases: text('aliases'),
    /** Lowercased name + name_zh + aliases, matched with LIKE by the search. */
    searchText: text('search_text').notNull(),
    /** USDA food category (e.g. "Vegetables and Vegetable Products"); NULL for custom foods. */
    category: text('category'),
    /**
     * The portion suggestions are counted in (data/usda-zh.csv `suggest_portion`); NULL = never
     * suggested. Not a foreign key: the import writes foods before their portions.
     */
    suggestPortionId: text('suggest_portion_id'),
    kcal: real('kcal'),
    proteinG: real('protein_g'),
    carbsG: real('carbs_g'),
    fatG: real('fat_g'),
    fiberG: real('fiber_g'),
    sugarsG: real('sugars_g'),
    sodiumMg: real('sodium_mg'),
    /** Alpha-linolenic acid, g per 100 g (for the library's omega-3 group). */
    omega3AlaG: real('omega3_ala_g'),
    /** EPA + DHA combined, g per 100 g. */
    omega3EpaDhaG: real('omega3_epa_dha_g'),
    /**
     * Shown in the food library tab under this image key (data/usda-zh.csv `library`); NULL =
     * not in the library. `library_rank` is the order of the csv rows.
     */
    libraryKey: text('library_key').unique(),
    libraryRank: integer('library_rank'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
  },
  (table) => [
    index('foods_owner_idx').on(table.ownerUserId),
    check('foods_source_check', sql`${table.source} IN ('usda_sr_legacy', 'custom')`),
    check(
      'foods_source_owner_check',
      sql`(${table.source} = 'custom' AND ${table.ownerUserId} IS NOT NULL AND ${table.fdcId} IS NULL) OR (${table.source} = 'usda_sr_legacy' AND ${table.ownerUserId} IS NULL AND ${table.fdcId} IS NOT NULL)`,
    ),
  ],
);

/** Household measures ("1 cup, chopped" = 91 g). Custom foods have exactly one: their serving. */
export const foodPortions = sqliteTable(
  'food_portions',
  {
    id: text('id').primaryKey(),
    foodId: text('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    /** Null only for a custom food's serving without a name (the app shows "1 serving"). */
    label: text('label'),
    grams: real('grams').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    index('food_portions_food_idx').on(table.foodId, table.sortOrder),
    check('food_portions_grams_check', sql`${table.grams} > 0`),
  ],
);

/**
 * What a user ate. The food's name and per-100 g nutrients are copied at logging time, so later
 * edits or deletions of the food (or a re-import) never change history.
 */
export const diaryEntries = sqliteTable(
  'diary_entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The user's local date, YYYY-MM-DD. */
    date: text('date').notNull(),
    meal: text('meal', { enum: ['breakfast', 'lunch', 'dinner', 'snack'] }).notNull(),
    foodId: text('food_id').references(() => foods.id, { onDelete: 'set null' }),
    foodName: text('food_name').notNull(),
    foodNameZh: text('food_name_zh'),
    /** Snapshot of the food's category, for the plate cell (like the nutrient snapshot). */
    foodCategory: text('food_category'),
    /** A nutrient-only "快速添加" entry: no food, grams fixed at 100, the amount cannot change. */
    isQuick: integer('is_quick', { mode: 'boolean' }).notNull().default(false),
    portionId: text('portion_id').references(() => foodPortions.id, { onDelete: 'set null' }),
    /** Snapshot of the portion's label; NULL when the amount was entered in grams. */
    portionLabel: text('portion_label'),
    /** Portions (or grams when no portion) as entered. */
    quantity: real('quantity').notNull(),
    grams: real('grams').notNull(),
    kcal: real('kcal'),
    proteinG: real('protein_g'),
    carbsG: real('carbs_g'),
    fatG: real('fat_g'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
  },
  (table) => [
    index('diary_entries_user_date_idx').on(table.userId, table.date),
    check('diary_entries_meal_check', sql`${table.meal} IN ('breakfast', 'lunch', 'dinner', 'snack')`),
    check('diary_entries_grams_check', sql`${table.grams} > 0`),
    check('diary_entries_quantity_check', sql`${table.quantity} > 0`),
  ],
);

/** "我的餐": a saved set of entries (snapshots, like diary entries) that can be added in one tap. */
export const mealTemplates = sqliteTable(
  'meal_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (table) => [index('meal_templates_user_idx').on(table.userId, table.createdAt)],
);

export const mealTemplateItems = sqliteTable(
  'meal_template_items',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id')
      .notNull()
      .references(() => mealTemplates.id, { onDelete: 'cascade' }),
    /** Order within the template (the source meal's logging order). */
    position: integer('position').notNull(),
    foodId: text('food_id').references(() => foods.id, { onDelete: 'set null' }),
    foodName: text('food_name').notNull(),
    foodNameZh: text('food_name_zh'),
    foodCategory: text('food_category'),
    isQuick: integer('is_quick', { mode: 'boolean' }).notNull().default(false),
    portionId: text('portion_id').references(() => foodPortions.id, { onDelete: 'set null' }),
    portionLabel: text('portion_label'),
    quantity: real('quantity').notNull(),
    grams: real('grams').notNull(),
    kcal: real('kcal'),
    proteinG: real('protein_g'),
    carbsG: real('carbs_g'),
    fatG: real('fat_g'),
  },
  (table) => [
    index('meal_template_items_template_idx').on(table.templateId, table.position),
    check('meal_template_items_grams_check', sql`${table.grams} > 0`),
    check('meal_template_items_quantity_check', sql`${table.quantity} > 0`),
  ],
);
