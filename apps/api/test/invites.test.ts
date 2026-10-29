import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { newAccount, seedInvite, signUp } from './helpers';

describe('invite codes', () => {
  it('invite with one use admits only one sign-up', async () => {
    const inviteCode = await seedInvite(1);

    const responses = await Promise.all([
      signUp({ ...newAccount(), inviteCode }),
      signUp({ ...newAccount(), inviteCode }),
    ]);

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 403]);
    const rejected = responses.find((r) => r.status === 403);
    expect(await rejected?.json()).toMatchObject({ code: 'invite_exhausted' });

    const row = await env.DB.prepare('SELECT used_count FROM invite_codes WHERE code = ?')
      .bind(inviteCode)
      .first<{ used_count: number }>();
    expect(row?.used_count).toBe(1);
  });
});
