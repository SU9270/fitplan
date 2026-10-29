import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { createDb } from './db/client';
import * as schema from './db/schema';
import type { Env } from './env';
import { reserveInvite } from './invites';

/**
 * Origins Better Auth trusts (request Origin and callbackURL/redirectTo checks).
 * `exp://` (Expo Go / dev client) is trusted only in development: in production an
 * `exp://<any-host>` redirect could receive auth tokens. This mirrors upstream
 * @better-auth/expo, which keys on NODE_ENV — not set on Workers, hence ENVIRONMENT.
 */
export function trustedOriginsFor(env: Pick<Env, 'ENVIRONMENT'>): string[] {
  return env.ENVIRONMENT === 'development' ? ['fitplan://', 'exp://'] : ['fitplan://'];
}

/**
 * Per-IP limits for the credential endpoints: `max` requests per `window` seconds, counted in
 * D1 (the `rate_limit` table). Sign-in allows a few password typos; sign-up is invite-gated and a
 * real person rarely needs more than one or two tries. Exceeding a limit answers 429, which the
 * app shows as `auth.error.tooManyRequests`.
 */
export const RATE_LIMIT_RULES = {
  '/sign-in/email': { window: 60, max: 5 },
  '/sign-up/email': { window: 60, max: 3 },
} as const;

/**
 * Better Auth rate limiting, on in every environment (also `wrangler dev` and tests, which
 * send a unique `cf-connecting-ip` per request). Better Auth only enables it by itself when
 * NODE_ENV === 'production', which Workers never set, so `enabled` is explicit.
 *
 * - `storage: 'database'`: Worker isolates do not share memory, so the default in-memory
 *   counter would not limit anything across isolates. D1 is consistent and Better Auth's
 *   database store does an atomic conditional increment (and prunes expired rows itself).
 * - Every other auth path: Better Auth's defaults (100 per 60 s per IP and path; its own
 *   tighter built-ins for e.g. /change-password).
 * - `/get-session` is skipped: the app calls it on every launch, a session token cannot be
 *   guessed, and counting it would cost a D1 write per call.
 */
const rateLimit = {
  enabled: true,
  storage: 'database',
  window: 60,
  max: 100,
  customRules: { ...RATE_LIMIT_RULES, '/get-session': false },
} as const;

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
    // The expo plugin's OAuth helper redirects to any `authorizationURL` (an open redirect).
    // FitPlan has no social login, so nothing needs it.
    disabledPaths: ['/expo-authorization-proxy'],
    trustedOrigins: trustedOriginsFor(env),
    rateLimit,
    advanced: {
      // Cloudflare sets cf-connecting-ip to the real client address on every request (and
      // overwrites any client-sent value). x-forwarded-for, the default, is client-controlled.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
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
