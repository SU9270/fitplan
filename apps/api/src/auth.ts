import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { createDb } from './db/client';
import * as schema from './db/schema';
import type { Env } from './env';
import { reserveInvite } from './invites';

/**
 * Create a Better Auth instance. Cloudflare bindings are only available per
 * request, so call this once per request (pattern from alwaysnomads/better-hono).
 */
export function createAuth(env: Env) {
  const db = createDb(env.DB);
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    emailAndPassword: { enabled: true },
    plugins: [expo()],
    trustedOrigins: ['fitplan://', 'exp://'],
    hooks: {
      // Sign-up is invite-only: the client sends `inviteCode` in the sign-up body.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-up/email') return;
        const body: unknown = ctx.body;
        const inviteCode =
          typeof body === 'object' && body !== null && 'inviteCode' in body ? body.inviteCode : undefined;
        if (typeof inviteCode !== 'string' || inviteCode.trim() === '') {
          throw new APIError('FORBIDDEN', { code: 'invite_required', message: 'An invite code is required.' });
        }
        if (!(await reserveInvite(db, inviteCode))) {
          throw new APIError('FORBIDDEN', {
            code: 'invite_exhausted',
            message: 'This invite code is invalid or has no uses left.',
          });
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth['$Infer']['Session']['user'];
export type SessionData = Auth['$Infer']['Session']['session'];
