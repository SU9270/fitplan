import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createAuth, trustedOriginsFor } from '../src/auth';
import { BASE_URL, newAccount } from './helpers';

/** A sign-in whose redirect target is an Expo Go URL on an arbitrary host. */
function signInWithExpCallback(environment: 'development' | 'production') {
  const { email, password } = newAccount();
  return createAuth({ ...env, ENVIRONMENT: environment }).handler(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, callbackURL: 'exp://attacker.example.com/--/callback' }),
    }),
  );
}

describe('trusted origins', () => {
  it('trusts exp:// only in development; fitplan:// always', () => {
    expect(trustedOriginsFor({ ENVIRONMENT: 'development' })).toEqual(['fitplan://', 'exp://']);
    expect(trustedOriginsFor({ ENVIRONMENT: 'production' })).toEqual(['fitplan://']);
    expect(trustedOriginsFor({})).toEqual(['fitplan://']);
  });

  it('rejects an exp:// callbackURL in production but not in development', async () => {
    const prod = await signInWithExpCallback('production');
    expect(prod.status).toBe(403);
    expect(await prod.json()).toMatchObject({ code: 'INVALID_CALLBACK_URL' });

    // In development the origin check passes; the unknown account then fails sign-in.
    const dev = await signInWithExpCallback('development');
    expect(dev.status).toBe(401);
  });
});
