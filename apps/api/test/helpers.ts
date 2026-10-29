import { env, exports } from 'cloudflare:workers';

export const BASE_URL = 'http://localhost:8787';

let counter = 0;

/** A unique value per call, so tests never collide on emails or invite codes. */
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${crypto.randomUUID().slice(0, 8)}`;
}

let ipCounter = 0;

/**
 * A fresh client IP (TEST-NET-2, RFC 5737 + a counter). Auth requests send it as
 * `cf-connecting-ip`, so each test gets its own rate-limit bucket instead of all tests
 * sharing one; rate-limit.test.ts relies on that to count attempts from a single IP.
 */
export function uniqueIp(): string {
  ipCounter += 1;
  const n = (Date.now() + ipCounter) % 65536;
  return `198.51.${n >> 8}.${n & 255}`;
}

export async function seedInvite(maxUses: number): Promise<string> {
  const code = unique('INV').toUpperCase();
  await env.DB.prepare('INSERT INTO invite_codes (code, max_uses) VALUES (?, ?)').bind(code, maxUses).run();
  return code;
}

export function signUp(body: { email: string; password: string; name: string; inviteCode?: string }) {
  return exports.default.fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': uniqueIp() },
    body: JSON.stringify(body),
  });
}

/** The app sends name = local part of the email. */
export function newAccount() {
  const email = `${unique('user')}@example.com`;
  return { email, password: 'correct-horse-battery-staple', name: email.split('@')[0] ?? email };
}

/** Sign up a fresh user and return its session cookie, ready for `authed` requests. */
export async function signedInUser(): Promise<{ cookie: string; email: string }> {
  const account = newAccount();
  const res = await signUp({ ...account, inviteCode: await seedInvite(1) });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status}`);
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  return { cookie, email: account.email };
}

export function authed(cookie: string, method: string, path: string, body?: unknown) {
  return exports.default.fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
