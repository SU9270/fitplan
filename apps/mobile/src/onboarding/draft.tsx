import { createContext, use, useCallback, useMemo, useReducer, type ReactNode } from 'react';
import { authClient } from '../lib/auth-client';
import type { OnboardingDraft, SavedProfile } from './draft-model';
import { initialState, onboardingReducer, type Submission } from './draft-state';

export type { OnboardingDraft } from './draft-model';
export type { Submission } from './draft-state';

interface OnboardingValue {
  draft: OnboardingDraft;
  /** Update the draft from its latest value (use the helpers in `draft-model`). */
  updateDraft: (update: (draft: OnboardingDraft) => OnboardingDraft) => void;
  /** The user this draft belongs to (null while nobody has signed in or after a user-initiated sign-out). */
  ownerId: string | null;
  hydrated: boolean;
  /** Finish the first load for `forUserId`; a profile whose goal was never accepted pre-fills the draft. */
  hydrate: (profile: SavedProfile | null, forUserId: string) => void;
  consentRecorded: boolean;
  setConsentRecorded: (recorded: boolean) => void;
  submission: Submission | null;
  setSubmission: (submission: Submission | null) => void;
  /** Forget everything (user-initiated sign-out). A 401 keeps the draft on purpose. */
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

/**
 * Holds the questionnaire above the route guard and keys it to the signed-in user: a 401 signs
 * the user out but the draft stays, so the same user signing back in resumes; a different user
 * signing in gets a clean draft (and their own saved profile, never the previous user's answers).
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const [state, dispatch] = useReducer(onboardingReducer, undefined, () => initialState());

  // Derived during render, so no child ever sees (or fetches for) a stale owner's state.
  if (userId !== null && state.ownerId !== userId) dispatch({ type: 'user', userId });

  const updateDraft = useCallback((update: (draft: OnboardingDraft) => OnboardingDraft) => dispatch({ type: 'update', update }), []);
  const hydrate = useCallback(
    (profile: SavedProfile | null, forUserId: string) => dispatch({ type: 'hydrate', profile, forUserId }),
    [],
  );
  const setConsentRecorded = useCallback((recorded: boolean) => dispatch({ type: 'consent', recorded }), []);
  const setSubmission = useCallback((submission: Submission | null) => dispatch({ type: 'submission', submission }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  const value = useMemo<OnboardingValue>(
    () => ({
      draft: state.draft,
      updateDraft,
      ownerId: state.ownerId,
      hydrated: state.hydrated,
      hydrate,
      consentRecorded: state.consentRecorded,
      setConsentRecorded,
      submission: state.submission,
      setSubmission,
      reset,
    }),
    [state, updateDraft, hydrate, setConsentRecorded, setSubmission, reset],
  );

  return <OnboardingContext value={value}>{children}</OnboardingContext>;
}

export function useOnboarding(): OnboardingValue {
  const value = use(OnboardingContext);
  if (!value) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return value;
}
