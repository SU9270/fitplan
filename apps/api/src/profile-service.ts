import { computeTargets } from '@fitplan/core';
import type { GuardrailReason, MacroTargets, TargetInput, TargetResult, TargetStatus } from '@fitplan/core';
import { toTargetInput } from '@fitplan/validators';
import type { ConsentInput, ProfileInput } from '@fitplan/validators';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from './db/client';
import { consents, goalVersions, profiles } from './db/schema';

/** The profile as the app sees it: `ProfileInput` minus `confirmed`, with `age` derived from `birth_year`. */
export type ProfileView = Omit<ProfileInput, 'confirmed'>;

export interface GoalVersionView {
  id: string;
  effectiveAt: string;
  status: TargetStatus;
  reasons: GuardrailReason[];
  bmi: number;
  bmrKcal: number;
  tdeeKcal: number;
  targets: MacroTargets;
}

export interface SaveProfileOutcome {
  /** 200 saved, 409 needs `confirmed`, 422 blocked. */
  status: 200 | 409 | 422;
  body: { profile: ProfileView; result: TargetResult; goalVersionId: string | null };
}

const utcYear = (now: Date) => now.getUTCFullYear();

/**
 * Deterministic JSON of the target-relevant input. Key order is fixed here (not inherited
 * from the caller's object), so equal inputs always serialize to the same string.
 */
export function serializeTargetInput(i: TargetInput): string {
  return JSON.stringify({
    age: i.age,
    sex: i.sex,
    heightCm: i.heightCm,
    weightKg: i.weightKg,
    activityLevel: i.activityLevel,
    goal: i.goal,
    pace: i.pace,
    healthFlags: {
      pregnantOrNursing: i.healthFlags.pregnantOrNursing,
      eatingDisorderHistory: i.healthFlags.eatingDisorderHistory,
      medicalDiet: i.healthFlags.medicalDiet,
    },
  });
}

type ProfileRow = typeof profiles.$inferSelect;
type GoalRow = typeof goalVersions.$inferSelect;

function toProfileView(row: ProfileRow, now: Date): ProfileView {
  return {
    age: utcYear(now) - row.birthYear,
    sex: row.sex,
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    // Narrowed by the table's CHECK (1..5) and the Zod literal union on the way in.
    activityLevel: row.activityLevel as ProfileView['activityLevel'],
    trainingDaysPerWeek: row.trainingDaysPerWeek,
    trainingExperience: row.trainingExperience,
    goal: row.goal,
    pace: row.pace,
    healthFlags: JSON.parse(row.healthFlags) as ProfileView['healthFlags'],
    unitSystem: row.unitSystem,
    locale: row.locale,
  };
}

function toGoalVersionView(row: GoalRow): GoalVersionView {
  return {
    id: row.id,
    effectiveAt: row.effectiveAt,
    status: row.status,
    reasons: JSON.parse(row.reasons) as GuardrailReason[],
    bmi: row.bmi,
    bmrKcal: row.bmrKcal,
    tdeeKcal: row.tdeeKcal,
    targets: { kcal: row.kcal, proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG },
  };
}

async function latestGoalRow(db: Db, userId: string): Promise<GoalRow | undefined> {
  const [row] = await db
    .select()
    .from(goalVersions)
    .where(eq(goalVersions.userId, userId))
    .orderBy(desc(goalVersions.effectiveAt), desc(sql`rowid`))
    .limit(1);
  return row;
}

/** Records a consent decision (append-only). Returns the new row id. */
export async function recordConsent(db: Db, userId: string, input: ConsentInput): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(consents).values({
    id,
    userId,
    kind: input.kind,
    version: input.version,
    granted: input.granted,
    createdAt: new Date().toISOString(),
  });
  return id;
}

/** True when the user's LATEST health_data consent (any version) is granted. */
export async function hasHealthDataConsent(db: Db, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ granted: consents.granted })
    .from(consents)
    .where(and(eq(consents.userId, userId), eq(consents.kind, 'health_data')))
    .orderBy(desc(consents.createdAt), desc(sql`rowid`))
    .limit(1);
  return row?.granted === true;
}

export async function getProfile(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<{ profile: ProfileView | null; latestGoal: GoalVersionView | null }> {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const goal = await latestGoalRow(db, userId);
  return {
    profile: row ? toProfileView(row, now) : null,
    latestGoal: goal ? toGoalVersionView(goal) : null,
  };
}

/**
 * Steps 3-6 of PUT /api/me/profile (validation and the consent check happen in the route).
 * The target calculation is pure, so it runs first and the profile upsert and the
 * (conditional) goal version insert go out as one atomic batch.
 */
export async function saveProfile(
  db: Db,
  userId: string,
  input: ProfileInput,
  now = new Date(),
): Promise<SaveProfileOutcome> {
  const targetInput = toTargetInput(input);
  const result = computeTargets(targetInput);

  const nowIso = now.toISOString();
  const row = {
    userId,
    birthYear: utcYear(now) - input.age,
    sex: input.sex,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    activityLevel: input.activityLevel,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    trainingExperience: input.trainingExperience,
    goal: input.goal,
    pace: input.pace,
    healthFlags: JSON.stringify({
      pregnantOrNursing: input.healthFlags.pregnantOrNursing,
      eatingDisorderHistory: input.healthFlags.eatingDisorderHistory,
      medicalDiet: input.healthFlags.medicalDiet,
    }),
    unitSystem: input.unitSystem,
    locale: input.locale,
    updatedAt: nowIso,
  };
  const { userId: _omit, ...updatable } = row;
  const upsertProfile = db
    .insert(profiles)
    .values(row)
    .onConflictDoUpdate({ target: profiles.userId, set: updatable });
  const profile = toProfileView(row, now);

  const respond = (status: SaveProfileOutcome['status'], goalVersionId: string | null): SaveProfileOutcome => ({
    status,
    body: { profile, result, goalVersionId },
  });

  const targets = result.targets;
  if (result.status === 'blocked' || targets === null) {
    await upsertProfile;
    return respond(422, null);
  }
  if (result.status === 'confirm' && input.confirmed !== true) {
    await upsertProfile;
    return respond(409, null);
  }

  const snapshot = serializeTargetInput(targetInput);
  const id = crypto.randomUUID();
  // Dedupe and insert in ONE statement: the row is added only when the latest version's
  // snapshot differs (`IS NOT` is also true when there is no version yet). A read-then-insert
  // would let concurrent identical saves all see "changed" and each append a version; D1 runs
  // each batch as a transaction, so here the second save sees the first one's row.
  const latestSnapshot = db
    .select({ snapshot: goalVersions.inputSnapshot })
    .from(goalVersions)
    .where(eq(goalVersions.userId, userId))
    .orderBy(desc(goalVersions.effectiveAt), desc(sql`rowid`))
    .limit(1);
  // INSERT … SELECT <values> WHERE (latest snapshot) IS NOT <snapshot>. Drizzle checks at
  // runtime that the selected keys match the table's columns and their order.
  const insertIfChanged = db.insert(goalVersions).select((qb) =>
    qb
      .select({
        id: sql<string>`${id}`.as('id'),
        userId: sql<string>`${userId}`.as('user_id'),
        effectiveAt: sql<string>`${nowIso}`.as('effective_at'),
        inputSnapshot: sql<string>`${snapshot}`.as('input_snapshot'),
        status: sql<'safe' | 'confirm'>`${result.status}`.as('status'),
        reasons: sql<string>`${JSON.stringify(result.reasons)}`.as('reasons'),
        bmi: sql<number>`${result.bmi}`.as('bmi'),
        bmrKcal: sql<number>`${result.bmrKcal}`.as('bmr_kcal'),
        tdeeKcal: sql<number>`${result.tdeeKcal}`.as('tdee_kcal'),
        kcal: sql<number>`${targets.kcal}`.as('kcal'),
        proteinG: sql<number>`${targets.proteinG}`.as('protein_g'),
        carbsG: sql<number>`${targets.carbsG}`.as('carbs_g'),
        fatG: sql<number>`${targets.fatG}`.as('fat_g'),
      })
      .from(sql`(SELECT 1)`)
      .where(sql`(${latestSnapshot}) IS NOT ${snapshot}`),
  );
  const [, inserted] = await db.batch([upsertProfile, insertIfChanged]);
  if (inserted.meta.changes === 1) return respond(200, id);

  // Unchanged input: answer with the version that is already there.
  const latest = await latestGoalRow(db, userId);
  if (!latest) throw new Error('goal version insert was skipped but no version exists');
  return respond(200, latest.id);
}
