import { DrizzleQueryError } from 'drizzle-orm/errors';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorSummary, handleError } from '../src/errors';

const SECRET_WEIGHT = 'weight-72.5-kg';

function queryError() {
  const cause = new Error('D1_ERROR: CHECK constraint failed: profiles_activity_level_check');
  return new DrizzleQueryError('insert into "profiles" ("weight_kg") values (?)', [SECRET_WEIGHT], cause);
}

describe('error logging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('summarises a query error without its bound parameters', () => {
    const summary = errorSummary(queryError());
    expect(JSON.stringify(summary)).not.toContain(SECRET_WEIGHT);
    expect(summary).toEqual({
      name: 'DrizzleQueryError',
      message: 'Failed query: insert into "profiles" ("weight_kg") values (?)',
      cause: { name: 'Error', message: 'D1_ERROR: CHECK constraint failed: profiles_activity_level_check' },
    });
  });

  it('summarises plain errors and non-errors by name and message only', () => {
    expect(errorSummary(new TypeError('boom'))).toEqual({ name: 'TypeError', message: 'boom' });
    expect(errorSummary('a string')).toEqual({ name: 'NonError', message: 'string' });
  });

  it('the app error handler logs only the summary and answers internal_error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = new Hono()
      .get('/boom', () => {
        throw queryError();
      })
      .onError(handleError);

    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ code: 'internal_error' });
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET_WEIGHT);
  });
});
