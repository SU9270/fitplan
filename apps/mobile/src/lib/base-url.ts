const DEFAULT_API_URL = 'http://localhost:8787';

/**
 * Base URL of the FitPlan API (Cloudflare Worker).
 *
 * Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (see `.env.example`). Expo inlines
 * `EXPO_PUBLIC_*` at bundle time, so the variable must be read with this exact
 * `process.env.EXPO_PUBLIC_API_URL` expression. The default suits the iOS simulator
 * against `wrangler dev`; the Android emulator needs http://10.0.2.2:8787 and a
 * physical device needs your computer's LAN IP.
 */
export function getBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  return (configured || DEFAULT_API_URL).replace(/\/+$/, '');
}
