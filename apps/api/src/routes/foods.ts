import { customFoodInputSchema, foodSearchQuerySchema } from '@fitplan/validators';
import { Hono } from 'hono';
import { createDb } from '../db/client';
import type { AppEnv } from '../env';
import { createCustomFood, deleteCustomFood, getFood, listOwnFoods, searchFoods, updateCustomFood } from '../foods/food-service';
import { listLibrary } from '../foods/library-service';
import { requireSession } from '../middleware/require-session';
import { parseBody, parseValue } from './parse';

const notFound = { code: 'not_found' } as const;

export const foodRoutes = new Hono<AppEnv>()
  .use(requireSession)
  .get('/', async (c) => {
    const query = parseValue(c.req.query(), foodSearchQuerySchema);
    if (!query.ok) return c.json({ error: 'invalid_input' as const, fields: query.fields }, 400);
    return c.json({ foods: await searchFoods(createDb(c.env.DB), c.var.user.id, query.data) });
  })
  .post('/', async (c) => {
    const body = await parseBody(c.req.raw, customFoodInputSchema);
    if (!body.ok) return c.json({ error: 'invalid_input' as const, fields: body.fields }, 400);
    return c.json({ food: await createCustomFood(createDb(c.env.DB), c.var.user.id, body.data) }, 201);
  })
  // Before '/:id', which would otherwise match "mine" and "library".
  .get('/mine', async (c) => c.json({ foods: await listOwnFoods(createDb(c.env.DB), c.var.user.id) }))
  .get('/library', async (c) => c.json({ foods: await listLibrary(createDb(c.env.DB)) }))
  .get('/:id', async (c) => {
    const food = await getFood(createDb(c.env.DB), c.var.user.id, c.req.param('id'));
    return food ? c.json({ food }) : c.json(notFound, 404);
  })
  .put('/:id', async (c) => {
    const body = await parseBody(c.req.raw, customFoodInputSchema);
    if (!body.ok) return c.json({ error: 'invalid_input' as const, fields: body.fields }, 400);
    const food = await updateCustomFood(createDb(c.env.DB), c.var.user.id, c.req.param('id'), body.data);
    return food ? c.json({ food }) : c.json(notFound, 404);
  })
  .delete('/:id', async (c) => {
    const deleted = await deleteCustomFood(createDb(c.env.DB), c.var.user.id, c.req.param('id'));
    return deleted ? c.body(null, 204) : c.json(notFound, 404);
  });
