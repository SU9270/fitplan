import { setLocale, t } from '../i18n';
import { failureText, problemOfStatus, problemOfThrown } from './request';

jest.mock('./unauthorized', () => ({ signOutIfUnauthorized: jest.fn(async (res: { status: number }) => res.status === 401) }));

afterEach(() => setLocale('en'));

describe('problemOfStatus', () => {
  it('tells a missing endpoint (non-JSON 404) from a missing item (JSON 404)', () => {
    expect(problemOfStatus(404, 'text/plain; charset=UTF-8')).toBe('outdated');
    expect(problemOfStatus(404, null)).toBe('outdated');
    expect(problemOfStatus(404, 'application/json')).toBe('notFound');
  });

  it('maps the other statuses', () => {
    expect(problemOfStatus(400, 'application/json')).toBe('invalid');
    expect(problemOfStatus(422, 'application/json')).toBe('invalid');
    expect(problemOfStatus(403, 'application/json')).toBe('consent');
    expect(problemOfStatus(500, 'application/json')).toBe('server');
    expect(problemOfStatus(503, null)).toBe('server');
    expect(problemOfStatus(418, null)).toBe('unknown');
  });
});

describe('problemOfThrown', () => {
  it('treats fetch TypeErrors as network problems', () => {
    expect(problemOfThrown(new TypeError('Network request failed'))).toBe('network');
    expect(problemOfThrown(new Error('boom'))).toBe('unknown');
  });
});

describe('failureText', () => {
  it('says what failed and why', () => {
    setLocale('zh');
    expect(failureText({ action: 'copy.error', problem: 'outdated' }, t)).toBe(
      '没能复制：App 和服务器的版本不一致，请更新 App（开发时请重启 pnpm dev）',
    );
    expect(failureText({ action: 'copy.error', problem: 'network' }, t)).toBe('没能复制：连不上服务器，请检查网络后重试');
  });
});

describe('call', () => {
  const { call } = jest.requireActual('./request') as typeof import('./request');
  const response = (status: number, contentType = 'application/json') => ({
    ok: status >= 200 && status < 300,
    status,
    url: 'http://localhost:8787/api/x',
    headers: { get: () => contentType },
  });

  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('passes successes through and sorts failures', async () => {
    expect(await call('copy.error', async () => response(201))).toMatchObject({ kind: 'ok' });
    expect(await call('copy.error', async () => response(404, 'text/plain'))).toEqual({
      kind: 'failed',
      failure: { action: 'copy.error', problem: 'outdated' },
    });
    expect(await call('copy.error', async () => response(401))).toEqual({ kind: 'signedOut' });
    expect(
      await call('copy.error', async () => {
        throw new TypeError('Network request failed');
      }),
    ).toEqual({ kind: 'failed', failure: { action: 'copy.error', problem: 'network' } });
  });
});
