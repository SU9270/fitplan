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
