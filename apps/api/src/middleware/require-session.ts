import { createMiddleware } from 'hono/factory';
import { createAuth } from '../auth';
import type { AppEnv } from '../env';

/** Reject requests without a valid Better Auth session (401); otherwise expose `c.var.user` / `c.var.session`. */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const result = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!result) {
    return c.json({ code: 'unauthorized' }, 401);
  }
  c.set('user', result.user);
  c.set('session', result.session);
  await next();
});
