import { diaryDayQuerySchema, diaryEntryInputSchema, diaryEntryPatchSchema, diaryStatsQuerySchema } from '@fitplan/validators';
import { Hono } from 'hono';
import { createDb } from '../db/client';
import {
  addDiaryEntry,
  deleteDiaryEntry,
  getDiaryDay,
  getDiaryStats,
  updateDiaryEntry,
  type EntryResult,
} from '../diary/diary-service';
import type { AppEnv } from '../env';
import { requireSession } from '../middleware/require-session';
import { hasHealthDataConsent } from '../profile-service';
import { parseBody, parseValue } from './parse';

const notFound = { code: 'not_found' } as const;
const consentRequired = { code: 'consent_required' } as const;

export const diaryRoutes = new Hono<AppEnv>()
  .use(requireSession)
  .get('/', async (c) => {
    const query = parseValue(c.req.query(), diaryDayQuerySchema);
    if (!query.ok) return c.json({ error: 'invalid_input' as const, fields: query.fields }, 400);
    return c.json(await getDiaryDay(createDb(c.env.DB), c.var.user.id, query.data.date));
  })
  .get('/stats', async (c) => {
    const query = parseValue(c.req.query(), diaryStatsQuerySchema);
    if (!query.ok) return c.json({ error: 'invalid_input' as const, fields: query.fields }, 400);
    return c.json(await getDiaryStats(createDb(c.env.DB), c.var.user.id, query.data.today));
  })
  .post('/entries', async (c) => {
    const body = await parseBody(c.req.raw, diaryEntryInputSchema);
    if (!body.ok) return c.json({ error: 'invalid_input' as const, fields: body.fields }, 400);
    const db = createDb(c.env.DB);
    // Diary entries are health data, like the profile: logging needs the same consent.
    if (!(await hasHealthDataConsent(db, c.var.user.id))) return c.json(consentRequired, 403);
    const result: EntryResult = await addDiaryEntry(db, c.var.user.id, body.data);
    if (result.kind === 'not_found') return c.json(notFound, 404);
    if (result.kind === 'invalid') return c.json({ error: 'invalid_input' as const, fields: result.fields }, 400);
    return c.json({ entry: result.entry }, 201);
  })
  .patch('/entries/:id', async (c) => {
    const body = await parseBody(c.req.raw, diaryEntryPatchSchema);
    if (!body.ok) return c.json({ error: 'invalid_input' as const, fields: body.fields }, 400);
    const db = createDb(c.env.DB);
    if (!(await hasHealthDataConsent(db, c.var.user.id))) return c.json(consentRequired, 403);
    const result = await updateDiaryEntry(db, c.var.user.id, c.req.param('id'), body.data);
    if (result.kind === 'not_found') return c.json(notFound, 404);
    if (result.kind === 'invalid') return c.json({ error: 'invalid_input' as const, fields: result.fields }, 400);
    return c.json({ entry: result.entry });
  })
  .delete('/entries/:id', async (c) => {
    const deleted = await deleteDiaryEntry(createDb(c.env.DB), c.var.user.id, c.req.param('id'));
    return deleted ? c.body(null, 204) : c.json(notFound, 404);
  });
