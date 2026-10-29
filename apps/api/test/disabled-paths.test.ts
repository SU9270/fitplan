import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createAuth } from '../src/auth';
import { BASE_URL, uniqueIp } from './helpers';

describe('disabled auth endpoints', () => {
  it('the expo authorization proxy (unused: no social login; an open redirect) is 404', async () => {
    const target = encodeURIComponent('https://attacker.example.com/');
    const res = await createAuth({ ...env, ENVIRONMENT: 'production' }).handler(
      new Request(`${BASE_URL}/api/auth/expo-authorization-proxy?authorizationURL=${target}`, {
        headers: { 'cf-connecting-ip': uniqueIp() },
        redirect: 'manual',
      }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('location')).toBeNull();
  });
});
