import { consentInputSchema, profileInputSchema } from '@fitplan/validators';
import { Hono } from 'hono';
import { createDb } from '../db/client';
import type { AppEnv } from '../env';
import { requireSession } from '../middleware/require-session';
import { getProfile, hasHealthDataConsent, recordConsent, saveProfile } from '../profile-service';

type Issue = { path: readonly PropertyKey[]; code: string };

/** The slice of a Zod schema used here (keeps zod itself out of this package's dependencies). */
interface Parser<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues: readonly Issue[] } };
}

/** `{ 'healthFlags.medicalDiet': 'invalid_type' }`; the first issue per field wins. */
function fieldErrors(issues: readonly Issue[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_root';
    fields[key] ??= issue.code;
  }
  return fields;
}

async function parseBody<T>(
  req: Request,
  schema: Parser<T>,
): Promise<{ ok: true; data: T } | { ok: false; fields: Record<string, string> }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, fields: { _root: 'invalid_json' } };
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, fields: fieldErrors(parsed.error.issues) };
}

export const meRoutes = new Hono<AppEnv>()
  .use(requireSession)
  .post('/consents', async (c) => {
    const body = await parseBody(c.req.raw, consentInputSchema);
    if (!body.ok) return c.json({ error: 'invalid_input' as const, fields: body.fields }, 400);
    const id = await recordConsent(createDb(c.env.DB), c.var.user.id, body.data);
    return c.json({ id }, 201);
  })
  .get('/profile', async (c) => c.json(await getProfile(createDb(c.env.DB), c.var.user.id)))
  .put('/profile', async (c) => {
    const body = await parseBody(c.req.raw, profileInputSchema);
    if (!body.ok) return c.json({ error: 'invalid_input' as const, fields: body.fields }, 400);

    const db = createDb(c.env.DB);
    const userId = c.var.user.id;
    if (!(await hasHealthDataConsent(db, userId))) {
      return c.json({ code: 'consent_required' as const }, 403);
    }
    const outcome = await saveProfile(db, userId, body.data);
    return c.json(outcome.body, outcome.status);
  });
