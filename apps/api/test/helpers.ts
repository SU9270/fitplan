import { env, exports } from 'cloudflare:workers';

export const BASE_URL = 'http://localhost:8787';

let counter = 0;

/** A unique value per call, so tests never collide on emails or invite codes. */
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function seedInvite(maxUses: number): Promise<string> {
  const code = unique('INV').toUpperCase();
  await env.DB.prepare('INSERT INTO invite_codes (code, max_uses) VALUES (?, ?)').bind(code, maxUses).run();
  return code;
}

export function signUp(body: { email: string; password: string; name: string; inviteCode?: string }) {
  return exports.default.fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** The app sends name = local part of the email. */
export function newAccount() {
  const email = `${unique('user')}@example.com`;
  return { email, password: 'correct-horse-battery-staple', name: email.split('@')[0] ?? email };
}
