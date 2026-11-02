import { Hono } from 'hono';
import { hc } from 'hono/client';
import { withJson } from './with-json';

// A route shaped like PUT /api/foods/:id (body parsed by the handler, no validator middleware).
const app = new Hono().put('/foods/:id', async (c) => c.json({ id: c.req.param('id'), body: await c.req.json() }));

describe('withJson', () => {
  it('sends the param in the path and the value as a JSON body', async () => {
    const client = hc<typeof app>('http://test', { fetch: (input: RequestInfo | URL, init?: RequestInit) => app.request(input, init) });
    const res = await client.foods[':id'].$put(withJson({ id: 'abc' }, { name: 'Bar', kcal: 210 }));
    expect(await res.json()).toEqual({ id: 'abc', body: { name: 'Bar', kcal: 210 } });
  });
});
