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

let fdcCounter = 0;

export interface SeedFood {
  name: string;
  nameZh?: string | null;
  aliases?: string[];
  kcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  portions?: { label: string; grams: number }[];
  /** USDA category, e.g. "Vegetables and Vegetable Products". */
  category?: string | null;
  /** Index into `portions` of the portion suggestions use; omitted = not a suggestion candidate. */
  suggestPortion?: number;
}

/**
 * Insert a USDA-like food (and its portions) directly, the way the import would, with a fresh
 * fdc_id. Values are test numbers, not USDA data. Returns the food and portion ids.
 */
export async function seedUsdaFood(food: SeedFood): Promise<{ id: string; portionIds: string[] }> {
  fdcCounter += 1;
  const fdcId = 1_000_000_000 + (Date.now() % 1_000_000) * 100 + fdcCounter;
  const id = `usda-${fdcId}`;
  const nameZh = food.nameZh ?? null;
  const aliases = food.aliases ?? [];
  const searchText = [food.name, nameZh, ...aliases].filter((p): p is string => !!p).map((p) => p.toLowerCase()).join('\n');
  await env.DB.prepare(
    `INSERT INTO foods (id, source, fdc_id, name, name_zh, aliases, search_text, category, suggest_portion_id, kcal, protein_g, carbs_g, fat_g)
     VALUES (?, 'usda_sr_legacy', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      fdcId,
      food.name,
      nameZh,
      aliases.length > 0 ? aliases.join('|') : null,
      searchText,
      food.category ?? null,
      food.suggestPortion === undefined ? null : `${id}-p${food.suggestPortion}`,
      food.kcal === undefined ? 100 : food.kcal,
      food.proteinG === undefined ? 10 : food.proteinG,
      food.carbsG === undefined ? 10 : food.carbsG,
      food.fatG === undefined ? 1 : food.fatG,
    )
    .run();
  const portionIds: string[] = [];
  for (const [index, portion] of (food.portions ?? []).entries()) {
    const portionId = `${id}-p${index}`;
    await env.DB.prepare('INSERT INTO food_portions (id, food_id, label, grams, sort_order) VALUES (?, ?, ?, ?, ?)')
      .bind(portionId, id, portion.label, portion.grams, index)
      .run();
    portionIds.push(portionId);
  }
  return { id, portionIds };
}
