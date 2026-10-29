import type { AppType } from '@fitplan/api';
import { hc } from 'hono/client';
import { authClient } from './auth-client';
import { getBaseUrl } from './base-url';

/**
 * Typed Hono RPC client for the FitPlan API, e.g. `api.api.me.profile.$get()`.
 * Each request carries the Better Auth session cookie read from SecureStore. React
 * Native's fetch has no cookie jar we control, so `credentials: 'omit'` keeps it from
 * interfering with the header we set (per the Better Auth Expo docs).
 */
export const api = hc<AppType>(getBaseUrl(), {
  headers: async (): Promise<Record<string, string>> => {
    const cookie = await authClient.getCookie();
    return cookie ? { Cookie: cookie } : {};
  },
  init: { credentials: 'omit' },
});
