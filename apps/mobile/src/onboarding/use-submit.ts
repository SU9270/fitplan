import { useState } from 'react';
import { useLocale, type MessageKey } from '../i18n';
import { api } from '../lib/api';
import { authClient } from '../lib/auth-client';
import { useOnboarding, type Submission } from './draft';
import { submitProfile } from './submit';
import { tryToProfileInput } from './to-profile-input';

/**
 * Submit the questionnaire from the health step (and re-submit with `confirmed` from the report).
 * Resolves to the saved submission, or `null` when it failed (see `error`) or the session expired.
 * On a 401 the user is signed out but the draft is kept, so signing in resumes the questionnaire.
 */
export function useSubmitProfile() {
  const { locale } = useLocale();
  const { draft, consentRecorded, setConsentRecorded, setSubmission } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function submit(options: { confirmed: boolean } = { confirmed: false }): Promise<Submission | null> {
    const input = tryToProfileInput(draft, locale);
    if (input === null) {
      setError('onboarding.error.invalid');
      return null;
    }

    setBusy(true);
    setError(null);
    try {
      const outcome = await submitProfile(
        api.api.me,
        { ...input, confirmed: options.confirmed },
        { recordConsent: !consentRecorded, onConsentRecorded: () => setConsentRecorded(true) },
      );
      if (outcome.kind === 'done') {
        setSubmission(outcome.submission);
        return outcome.submission;
      }
      if (outcome.kind === 'unauthorized') {
        // Same handling as the route guard: drop the local session; (onboarding) unmounts, the draft stays.
        await authClient.signOut();
        return null;
      }
      if (outcome.message === 'onboarding.error.consent') setConsentRecorded(false);
      setError(outcome.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { submit, busy, error, clearError: () => setError(null) };
}
