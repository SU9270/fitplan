import { authClient } from './auth-client';
import { useOnboarding } from '../onboarding/draft';

/** User-initiated sign-out: also forgets the questionnaire so the next account starts fresh. */
export function useSignOut(): () => void {
  const { reset } = useOnboarding();
  return () => {
    reset();
    void authClient.signOut();
  };
}
