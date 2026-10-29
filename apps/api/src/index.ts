import { Hono } from 'hono';
import { createAuth } from './auth';
import type { AppEnv } from './env';

const app = new Hono<AppEnv>()
  .get('/health', (c) => c.json({ ok: true }))
  .on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

app.onError((err, c) => {
  console.error(err);
  return c.json({ code: 'internal_error' }, 500);
});

/** Route types for the Expo app's Hono RPC client. */
export type AppType = typeof app;

export default app;
