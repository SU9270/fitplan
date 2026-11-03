import { mealTemplateApplySchema, mealTemplateInputSchema } from '@fitplan/validators';
import { Hono } from 'hono';
import { createDb } from '../db/client';
import { applyTemplate, createTemplate, deleteTemplate, listTemplates } from '../diary/template-service';
import type { AppEnv } from '../env';
import { requireSession } from '../middleware/require-session';
import { hasHealthDataConsent } from '../profile-service';
import { parseBody } from './parse';

const notFound = { code: 'not_found' } as const;

/** "我的餐": saved meals that add their entries in one tap. */
export const templateRoutes = new Hono<AppEnv>()
  .use(requireSession)
  .get('/', async (c) => c.json({ templates: await listTemplates(createDb(c.env.DB), c.var.user.id) }))
  .post('/', async (c) => {
    const body = await parseBody(c.req.raw, mealTemplateInputSchema);
    if (!body.ok) return c.json({ error: 'invalid_input' as const, fields: body.fields }, 400);
    const template = await createTemplate(createDb(c.env.DB), c.var.user.id, body.data);
    if (!template) return c.json({ error: 'invalid_input' as const, fields: { meal: 'empty_meal' } }, 400);
    return c.json({ template }, 201);
  })
  .post('/:id/apply', async (c) => {
    const body = await parseBody(c.req.raw, mealTemplateApplySchema);
    if (!body.ok) return c.json({ error: 'invalid_input' as const, fields: body.fields }, 400);
    const db = createDb(c.env.DB);
    // Adds diary entries: the same consent as logging.
    if (!(await hasHealthDataConsent(db, c.var.user.id))) return c.json({ code: 'consent_required' as const }, 403);
    const result = await applyTemplate(db, c.var.user.id, c.req.param('id'), body.data);
    if (result.kind === 'not_found') return c.json(notFound, 404);
    if (result.kind === 'invalid') return c.json({ error: 'invalid_input' as const, fields: result.fields }, 400);
    return c.json({ copied: result.copied }, 201);
  })
  .delete('/:id', async (c) => {
    const deleted = await deleteTemplate(createDb(c.env.DB), c.var.user.id, c.req.param('id'));
    return deleted ? c.body(null, 204) : c.json(notFound, 404);
  });
