import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createAuth, RATE_LIMIT_RULES } from '../src/auth';
import { BASE_URL, newAccount, uniqueIp } from './helpers';

/** A wrong-password sign-in from `ip`, against a Better Auth instance configured as in production. */
function productionSignIn(ip: string, email: string) {
  return createAuth({ ...env, ENVIRONMENT: 'production' }).handler(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify({ email, password: 'wrong-password-123' }),
    }),
  );
}

describe('rate limiting (production config)', () => {
  it('answers 429 once one IP exceeds the sign-in limit, and only for that IP', async () => {
    const { max } = RATE_LIMIT_RULES['/sign-in/email'];
    const ip = uniqueIp();
    const { email } = newAccount();

    for (let i = 0; i < max; i += 1) {
      const res = await productionSignIn(ip, email);
      expect(res.status).toBe(401);
    }
    const limited = await productionSignIn(ip, email);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('X-Retry-After'))).toBeGreaterThan(0);

    // The bucket is keyed to cf-connecting-ip: another client is unaffected.
    const other = await productionSignIn(uniqueIp(), email);
    expect(other.status).toBe(401);
  });

  it('keeps sign-in and sign-up limits tight', () => {
    expect(RATE_LIMIT_RULES['/sign-in/email'].max).toBeLessThanOrEqual(10);
    expect(RATE_LIMIT_RULES['/sign-up/email'].max).toBeLessThanOrEqual(10);
  });
});
