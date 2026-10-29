import type { TargetResult } from '@fitplan/core';
import { CONSENT_VERSION, type ProfileInput } from '@fitplan/validators';
import type { MessageKey } from '../i18n';
import type { api } from '../lib/api';
import type { Submission } from './draft';

export type MeClient = typeof api.api.me;

export type SubmitOutcome =
  | { kind: 'done'; submission: Submission }
  /** The session is no longer valid (HTTP 401). */
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: MessageKey };

const STATUS_BY_CODE = { 200: 'saved', 409: 'confirm', 422: 'blocked' } as const;

/**
 * Record the health-data consent (unless it already is) and save the profile.
 * 200 → saved, 409 → needs the user's confirmation, 422 → blocked; all three carry the server's result.
 */
export async function submitProfile(
  client: MeClient,
  input: ProfileInput,
  options: { recordConsent: boolean; onConsentRecorded: () => void },
): Promise<SubmitOutcome> {
  try {
    if (options.recordConsent) {
      const res = await client.consents.$post({
        json: { kind: 'health_data', version: CONSENT_VERSION, granted: true },
      });
      // The session middleware answers 401 outside the route's typed responses.
      if ((res.status as number) === 401) return { kind: 'unauthorized' };
      if (!res.ok) return { kind: 'error', message: 'onboarding.error.consent' };
      options.onConsentRecorded();
    }

    const res = await client.profile.$put({ json: input });
    if ((res.status as number) === 401) return { kind: 'unauthorized' };
    if (res.status === 200 || res.status === 409 || res.status === 422) {
      const body: { result: TargetResult } = await res.json();
      return { kind: 'done', submission: { status: STATUS_BY_CODE[res.status], result: body.result } };
    }
    if (res.status === 403) return { kind: 'error', message: 'onboarding.error.consent' };
    if (res.status === 400) return { kind: 'error', message: 'onboarding.error.invalid' };
    return { kind: 'error', message: 'auth.error.unknown' };
  } catch (thrown) {
    // React Native's fetch rejects with a TypeError ("Network request failed") when offline.
    return { kind: 'error', message: thrown instanceof TypeError ? 'auth.error.network' : 'auth.error.unknown' };
  }
}
