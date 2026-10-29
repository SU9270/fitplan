import type { GateStatus } from './gate';

/** Which route groups the root `Stack.Protected` guards open. `index` is always reachable. */
export interface RouteAccess {
  auth: boolean;
  /** The questionnaire `(onboarding)` and the `report` screen. */
  onboarding: boolean;
  today: boolean;
}

/**
 * The route guard's decision. A user with a goal reaches the questionnaire only while editing
 * their answers (started from Today); Today stays open meanwhile so backing out returns to it.
 * `index` redirects by status alone (ready → today), so editing never creates a redirect loop.
 */
export function routeAccess(status: GateStatus, editing: boolean): RouteAccess {
  return {
    auth: status === 'signedOut',
    onboarding: status === 'needsGoal' || (status === 'ready' && editing),
    today: status === 'ready',
  };
}

/**
 * Editing applies to the user who started it and only while their goal is loaded: a reload
 * (after the edited answers were saved) or a sign-out ends it.
 */
export function isEditing(s: { status: GateStatus; userId: string | null; editingUserId: string | null }): boolean {
  return s.status === 'ready' && s.userId !== null && s.editingUserId === s.userId;
}
