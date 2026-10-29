import type { Context } from 'hono';
import { DrizzleQueryError } from 'drizzle-orm/errors';

export interface ErrorSummary {
  name: string;
  message: string;
  cause?: { name: string; message: string };
}

/** Drizzle appends the bound values ("\nparams: 72.5,…") to a failed query's message; cut them. */
function withoutParams(message: string): string {
  const at = message.indexOf('\nparams:');
  return at === -1 ? message : message.slice(0, at);
}

function nameAndMessage(err: unknown): { name: string; message: string } {
  if (err instanceof DrizzleQueryError) return { name: 'DrizzleQueryError', message: `Failed query: ${err.query}` };
  if (err instanceof Error) return { name: err.name, message: withoutParams(err.message) };
  return { name: 'NonError', message: typeof err };
}

/**
 * What may go into the logs about an unhandled error: names and messages only. Bound query
 * parameters (health data: weight, height, health flags…), stacks (their first line repeats the
 * message) and nested causes beyond one level are left out.
 */
export function errorSummary(err: unknown): ErrorSummary {
  const summary: ErrorSummary = nameAndMessage(err);
  if (err instanceof Error && err.cause !== undefined) summary.cause = nameAndMessage(err.cause);
  return summary;
}

/** `app.onError`: log a redacted summary; the client only ever sees `internal_error`. */
export function handleError(err: unknown, c: Context) {
  console.error('[api] unhandled error', errorSummary(err));
  return c.json({ code: 'internal_error' as const }, 500);
}
