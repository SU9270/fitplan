import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { api } from '../../lib/api';
import { useOnboarding } from '../../onboarding/draft';
import { tokens } from '../../theme/tokens';

/**
 * Starts the questionnaire from the saved profile when there is one without an accepted goal
 * (an earlier 409 / 422; controller ruling 9). Does nothing once the draft is hydrated, so a
 * draft kept across a 401 sign-in is never overwritten.
 */
export default function OnboardingLayout() {
  const { hydrated, hydrate } = useOnboarding();

  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.api.me.profile.$get();
        const body = res.ok ? await res.json() : null;
        if (!cancelled) hydrate(body?.profile ?? null);
      } catch {
        // Offline or a server error: start with an empty questionnaire; saving will surface real problems.
        if (!cancelled) hydrate(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, hydrate]);

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.color.background } }} />;
}
