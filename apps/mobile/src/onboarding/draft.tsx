import type { TargetResult } from '@fitplan/core';
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { draftFromProfile, emptyDraft, type OnboardingDraft, type SavedProfile } from './draft-model';

export type { OnboardingDraft } from './draft-model';

/** What the server answered to `PUT /api/me/profile`, as far as the report screen needs it. */
export interface Submission {
  /** `saved` = 200, `confirm` = 409 (needs the user's OK), `blocked` = 422. */
  status: 'saved' | 'confirm' | 'blocked';
  result: TargetResult;
}

interface OnboardingValue {
  draft: OnboardingDraft;
  /** Update the draft from its latest value (use the helpers in `draft-model`). */
  updateDraft: (update: (draft: OnboardingDraft) => OnboardingDraft) => void;
  /** False until the first load decided whether to start from a saved profile (controller ruling 9). */
  hydrated: boolean;
  /** Finish the first load; a profile whose goal was never accepted pre-fills the draft. Later calls are ignored. */
  hydrate: (profile: SavedProfile | null) => void;
  /** The health-data consent is already on the server, so submitting needn't post it again. */
  consentRecorded: boolean;
  setConsentRecorded: (recorded: boolean) => void;
  submission: Submission | null;
  setSubmission: (submission: Submission | null) => void;
  /** Forget everything (user-initiated sign-out). A 401 keeps the draft on purpose. */
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

/**
 * Holds the questionnaire above the route guard: when a 401 signs the user out, the
 * `(onboarding)` screens unmount but this provider — and the draft — stays, so signing back in
 * resumes the questionnaire.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [consentRecorded, setConsentRecorded] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);

  const hydratedRef = useRef(false);

  const hydrate = useCallback((profile: SavedProfile | null) => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (profile) {
      setDraft(draftFromProfile(profile));
      setConsentRecorded(true);
    }
    setHydrated(true);
  }, []);

  const reset = useCallback(() => {
    hydratedRef.current = false;
    setDraft(emptyDraft());
    setHydrated(false);
    setConsentRecorded(false);
    setSubmission(null);
  }, []);

  const value = useMemo<OnboardingValue>(
    () => ({
      draft,
      updateDraft: (update) => setDraft(update),
      hydrated,
      hydrate,
      consentRecorded,
      setConsentRecorded,
      submission,
      setSubmission,
      reset,
    }),
    [draft, hydrated, hydrate, consentRecorded, submission, reset],
  );

  return <OnboardingContext value={value}>{children}</OnboardingContext>;
}

export function useOnboarding(): OnboardingValue {
  const value = use(OnboardingContext);
  if (!value) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return value;
}
