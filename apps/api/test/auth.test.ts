import { Hono } from 'hono';
import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../src/env';
import { requireSession } from '../src/middleware/require-session';
import { BASE_URL, newAccount, seedInvite, signUp } from './helpers';

describe('api', () => {
  it('GET /health returns ok', async () => {
    const res = await exports.default.fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('sign-up without invite is rejected', async () => {
    const res = await signUp(newAccount());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'invite_required' });
  });

  it('sign-up with a valid invite succeeds and session is readable', async () => {
    const account = newAccount();
    const inviteCode = await seedInvite(5);

    const res = await signUp({ ...account, inviteCode });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('better-auth.session_token=');
    const cookie = (setCookie ?? '').split(';')[0] ?? '';

    const sessionRes = await exports.default.fetch(`${BASE_URL}/api/auth/get-session`, {
      headers: { cookie },
    });
    expect(sessionRes.status).toBe(200);
    const session = (await sessionRes.json()) as { user: { email: string } } | null;
    expect(session?.user.email).toBe(account.email);
  });

  it('protected route returns 401 without session', async () => {
    // Test-only route: the shipped app has no route that merely echoes the session.
    const app = new Hono<AppEnv>().get('/protected', requireSession, (c) => c.json({ id: c.var.user.id }));
    const res = await app.request(`${BASE_URL}/protected`, {}, env);
    expect(res.status).toBe(401);
  });
});
