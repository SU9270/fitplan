import { authClient } from './auth-client';

/**
 * Same handling as the route guard: a 401 means the cached session is gone on the server, so
 * drop it locally (the guard then shows sign-in). Returns true when the caller should stop.
 */
export async function signOutIfUnauthorized(res: { status: number }): Promise<boolean> {
  if (res.status !== 401) return false;
  await authClient.signOut();
  return true;
}
