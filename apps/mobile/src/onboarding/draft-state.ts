import { draftFromProfile, emptyDraft, type OnboardingDraft, type SavedProfile } from './draft-model';
import type { TargetResult } from '@fitplan/core';

/** What the server answered to `PUT /api/me/profile`, as far as the report screen needs it. */
export interface Submission {
  /** `saved` = 200, `confirm` = 409 (needs the user's OK), `blocked` = 422. */
  status: 'saved' | 'confirm' | 'blocked';
  result: TargetResult;
}

/**
 * Everything the questionnaire remembers, owned by one user. `ownerId` is the last signed-in
 * user: a 401 signs the user out but keeps it, so the same user signing back in resumes, while
 * a different user always starts clean.
 */
export interface OnboardingState {
  ownerId: string | null;
  draft: OnboardingDraft;
  /** False until the first load decided whether to start from a saved profile (controller ruling 9). */
  hydrated: boolean;
  /** The health-data consent is already on the server, so submitting needn't post it again. */
  consentRecorded: boolean;
  submission: Submission | null;
}

export type OnboardingAction =
  /** The signed-in user (never `null`: signing out by itself must not wipe a draft kept across a 401). */
  | { type: 'user'; userId: string }
  | { type: 'update'; update: (draft: OnboardingDraft) => OnboardingDraft }
  /** Finish the first load for `forUserId`; ignored if already hydrated or the owner changed meanwhile. */
  | { type: 'hydrate'; profile: SavedProfile | null; forUserId: string }
  /** Re-open the questionnaire from the saved profile ("Edit my answers" on Today). */
  | { type: 'edit'; profile: SavedProfile; forUserId: string }
  | { type: 'consent'; recorded: boolean }
  | { type: 'submission'; submission: Submission | null }
  /** User-initiated sign-out: forget everything, including the owner. */
  | { type: 'reset' };

export function initialState(ownerId: string | null = null): OnboardingState {
  return { ownerId, draft: emptyDraft(), hydrated: false, consentRecorded: false, submission: null };
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'user':
      if (state.ownerId === action.userId) return state;
      // Nobody owned it yet (fresh start or after a user-initiated sign-out, both empty): claim it.
      return state.ownerId === null ? { ...state, ownerId: action.userId } : initialState(action.userId);
    case 'update':
      return { ...state, draft: action.update(state.draft) };
    case 'hydrate': {
      if (state.hydrated || state.ownerId !== action.forUserId) return state;
      return action.profile
        ? { ...state, hydrated: true, draft: draftFromProfile(action.profile), consentRecorded: true }
        : { ...state, hydrated: true };
    }
    case 'edit':
      if (state.ownerId !== action.forUserId) return state;
      return {
        ...state,
        hydrated: true,
        draft: draftFromProfile(action.profile),
        consentRecorded: true,
        submission: null,
      };
    case 'consent':
      return { ...state, consentRecorded: action.recorded };
    case 'submission':
      return { ...state, submission: action.submission };
    case 'reset':
      return initialState();
  }
}
