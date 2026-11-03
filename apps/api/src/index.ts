import { Hono } from 'hono';
import { createAuth } from './auth';
import type { AppEnv } from './env';
import { handleError } from './errors';
import { diaryRoutes } from './routes/diary';
import { foodRoutes } from './routes/foods';
import { meRoutes } from './routes/me';
import { templateRoutes } from './routes/templates';

const app = new Hono<AppEnv>()
  .get('/health', (c) => c.json({ ok: true }))
  .on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw))
  .route('/api/me', meRoutes)
  .route('/api/foods', foodRoutes)
  .route('/api/diary', diaryRoutes)
  .route('/api/meal-templates', templateRoutes);

app.onError(handleError);

/** Route types for the Expo app's Hono RPC client. */
export type AppType = typeof app;

export default app;
