import type { SessionData, SessionUser } from './auth';

/** Bindings available to the Worker (see wrangler.jsonc and .dev.vars.example). */
export interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  /** Anything other than "development" is treated as production (wrangler.jsonc defaults to "production"). */
  ENVIRONMENT?: 'development' | 'production';
}

/** Hono environment. `user` / `session` are set by the `requireSession` middleware. */
export interface AppEnv {
  Bindings: Env;
  Variables: { user: SessionUser; session: SessionData };
}
