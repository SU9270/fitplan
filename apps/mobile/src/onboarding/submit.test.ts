import type { MeClient } from './submit';
import { submitProfile } from './submit';
import { toProfileInput } from './to-profile-input';
import { emptyDraft, setHeightField, setWeightField } from './draft-model';

const input = toProfileInput(
  setWeightField(
    setHeightField({ ...emptyDraft(), age: '20', sex: 'male', activityLevel: 3, trainingDaysPerWeek: 3, trainingExperience: 'beginner' }, 'cm', '175'),
    'kg',
    '70',
  ),
  'en',
);

const result = { status: 'safe', reasons: [], bmi: 22.9, bmrKcal: 1674, tdeeKcal: 2595, targets: null, effectivePace: 'standard' };

function client(profileStatus: number, consentStatus = 201) {
  const calls: string[] = [];
  const reply = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  const fake = {
    consents: {
      $post: async () => {
        calls.push('consent');
        return reply(consentStatus, {});
      },
    },
    profile: {
      $put: async () => {
        calls.push('profile');
        return reply(profileStatus, { profile: {}, result, goalVersionId: null });
      },
    },
  } as unknown as MeClient;
  return { fake, calls };
}

const opts = (recordConsent = true) => ({ recordConsent, onConsentRecorded: jest.fn() });

describe('submitProfile', () => {
  it('records consent first, then saves the profile', async () => {
    const { fake, calls } = client(200);
    const o = opts();
    const outcome = await submitProfile(fake, input, o);
    expect(calls).toEqual(['consent', 'profile']);
    expect(o.onConsentRecorded).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ kind: 'done', submission: { status: 'saved' } });
  });

  it('skips the consent when it is already recorded', async () => {
    const { fake, calls } = client(200);
    await submitProfile(fake, input, opts(false));
    expect(calls).toEqual(['profile']);
  });

  it('maps 409 to confirm and 422 to blocked, keeping the server result', async () => {
    expect(await submitProfile(client(409).fake, input, opts())).toMatchObject({ kind: 'done', submission: { status: 'confirm', result } });
    expect(await submitProfile(client(422).fake, input, opts())).toMatchObject({ kind: 'done', submission: { status: 'blocked', result } });
  });

  it('reports 401 as unauthorized, from either call', async () => {
    expect(await submitProfile(client(401).fake, input, opts())).toEqual({ kind: 'unauthorized' });
    expect(await submitProfile(client(200, 401).fake, input, opts())).toEqual({ kind: 'unauthorized' });
  });

  it('maps other failures to translated messages', async () => {
    expect(await submitProfile(client(403).fake, input, opts())).toEqual({ kind: 'error', message: 'onboarding.error.consent' });
    expect(await submitProfile(client(400).fake, input, opts())).toEqual({ kind: 'error', message: 'onboarding.error.invalid' });
    expect(await submitProfile(client(500).fake, input, opts())).toEqual({ kind: 'error', message: 'auth.error.unknown' });
    expect(await submitProfile(client(200, 500).fake, input, opts())).toEqual({ kind: 'error', message: 'onboarding.error.consent' });
  });

  it('maps a thrown TypeError to the network message', async () => {
    const offline = {
      consents: { $post: async () => { throw new TypeError('Network request failed'); } },
      profile: { $put: async () => { throw new TypeError('Network request failed'); } },
    } as unknown as MeClient;
    expect(await submitProfile(offline, input, opts())).toEqual({ kind: 'error', message: 'auth.error.network' });
  });
});
