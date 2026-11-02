import { consentInputSchema, profileInputSchema } from '@fitplan/validators';
import { Hono } from 'hono';
import { createDb } from '../db/client';
import type { AppEnv } from '../env';
import { requireSession } from '../middleware/require-session';
import { getProfile, hasHealthDataConsent, recordConsent, saveProfile } from '../profile-service';
import { parseBody } from './parse';

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
