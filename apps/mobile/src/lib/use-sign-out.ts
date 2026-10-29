import { useOnboarding } from '../onboarding/draft';
import { authClient } from './auth-client';

/**
 * User-initiated sign-out: ends the session first (so nothing re-fetches the profile for the
 * outgoing user), then forgets the questionnaire. A 401 does not go through here, on purpose:
 * the same user signing back in resumes their draft.
 */
export function useSignOut(): () => Promise<void> {
  const { reset } = useOnboarding();
  return async () => {
    await authClient.signOut();
    reset();
  };
}
