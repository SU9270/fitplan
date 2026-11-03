import type { MessageKey, t as translate } from '../i18n';
import { signOutIfUnauthorized } from './unauthorized';

/** Why a request failed, in terms the user can act on. */
export type Problem = 'network' | 'server' | 'outdated' | 'invalid' | 'consent' | 'notFound' | 'unknown';

/** What failed (an action message such as 「没能复制」) and why. */
export interface Failure {
  action: MessageKey;
  problem: Problem;
}

const REASON: Record<Problem, MessageKey> = {
  network: 'error.reason.network',
  server: 'error.reason.server',
  outdated: 'error.reason.outdated',
  invalid: 'error.reason.invalid',
  consent: 'error.reason.consent',
  notFound: 'error.reason.notFound',
  unknown: 'error.reason.unknown',
};

/**
 * The problem behind a non-2xx response. Our API answers errors in JSON; a 404 that is not JSON
 * comes from the router (no such endpoint), i.e. the app is newer than the server it talks to.
 */
export function problemOfStatus(status: number, contentType: string | null): Problem {
  if (status === 404) return contentType?.includes('application/json') ? 'notFound' : 'outdated';
  if (status === 400 || status === 422) return 'invalid';
  if (status === 403) return 'consent';
  if (status >= 500) return 'server';
  return 'unknown';
}

/** React Native's fetch rejects with a TypeError ("Network request failed") when it cannot connect. */
export function problemOfThrown(thrown: unknown): Problem {
  return thrown instanceof TypeError ? 'network' : 'unknown';
}

/** 「没能复制：App 和服务器的版本不一致……」 */
export function failureText(failure: Failure, t: typeof translate): string {
  return t('error.compose', { action: t(failure.action), reason: t(REASON[failure.problem]) });
}

type Response = { ok: boolean; status: number; url: string; headers: { get(name: string): string | null } };

/**
 * The responses that can be ok. Hono types `ok` per status, but a route answering `c.json(body)`
 * without a status gets `ok: boolean`, so exclude the definite failures rather than extract `true`.
 */
type Success<R> = Exclude<R, { ok: false }>;

export type Outcome<R> = { kind: 'ok'; res: R } | { kind: 'failed'; failure: Failure } | { kind: 'signedOut' };

/**
 * Send a request and sort the result: ok (typed as the success responses), failed with a reason
 * for the user, or signed out after a 401 (as everywhere else). Failures are also logged with the
 * status and URL, so the developer's terminal (`pnpm dev`) says exactly what went wrong.
 */
export async function call<R extends Response>(action: MessageKey, send: () => Promise<R>): Promise<Outcome<Success<R>>> {
  let res: R;
  try {
    res = await send();
  } catch (thrown) {
    console.warn(`[fitplan] ${action}: request failed`, thrown);
    return { kind: 'failed', failure: { action, problem: problemOfThrown(thrown) } };
  }
  if (await signOutIfUnauthorized(res)) return { kind: 'signedOut' };
  if (!res.ok) {
    const problem = problemOfStatus(res.status, res.headers.get('content-type'));
    console.warn(`[fitplan] ${action}: HTTP ${res.status} (${problem}) from ${res.url}`);
    return { kind: 'failed', failure: { action, problem } };
  }
  return { kind: 'ok', res: res as Success<R> };
}
