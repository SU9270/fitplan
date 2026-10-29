import { and, eq, lt, sql } from 'drizzle-orm';
import type { Db } from './db/client';
import { inviteCodes } from './db/schema';

/** Invite codes are generated upper-case; accept any casing and stray whitespace from users. */
export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Atomically take one use of an invite code.
 *
 * A single conditional UPDATE does the check and the increment, so concurrent
 * sign-ups cannot both claim the last use. Returns `true` when exactly one row
 * was updated; unknown and used-up codes both return `false`.
 *
 * The reservation is NOT refunded if the sign-up fails afterwards (e.g. the
 * email is already registered or the password is too short). D1 offers no
 * transaction spanning our hook and Better Auth's user insert, and a lost use
 * is cheaper than a race that admits extra users. Admins can mint a new code.
 */
export async function reserveInvite(db: Db, code: string): Promise<boolean> {
  const result = await db
    .update(inviteCodes)
    .set({ usedCount: sql`${inviteCodes.usedCount} + 1` })
    .where(and(eq(inviteCodes.code, normalizeInviteCode(code)), lt(inviteCodes.usedCount, inviteCodes.maxUses)))
    .run();
  return result.meta.changes === 1;
}
