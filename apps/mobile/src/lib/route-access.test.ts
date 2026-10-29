import type { GateStatus } from './gate';
import { isEditing, routeAccess } from './route-access';

const STATUSES: GateStatus[] = ['loading', 'signedOut', 'needsGoal', 'ready', 'error'];

describe('routeAccess', () => {
  it('signed out: only (auth)', () => {
    expect(routeAccess('signedOut', false)).toEqual({ auth: true, onboarding: false, today: false });
  });

  it('needs a goal: the questionnaire and report, never today (editing or not)', () => {
    expect(routeAccess('needsGoal', false)).toEqual({ auth: false, onboarding: true, today: false });
    expect(routeAccess('needsGoal', true)).toEqual({ auth: false, onboarding: true, today: false });
  });

  it('ready: today; the questionnaire only while the user is editing their answers', () => {
    expect(routeAccess('ready', false)).toEqual({ auth: false, onboarding: false, today: true });
    // Today stays reachable, so backing out of the wizard returns to it.
    expect(routeAccess('ready', true)).toEqual({ auth: false, onboarding: true, today: true });
  });

  it('loading and error: nothing but index (which shows the spinner / retry)', () => {
    for (const status of ['loading', 'error'] as const) {
      expect(routeAccess(status, true)).toEqual({ auth: false, onboarding: false, today: false });
    }
  });

  it('every status opens at most one of (auth) and today', () => {
    for (const status of STATUSES) {
      for (const editing of [false, true]) {
        const access = routeAccess(status, editing);
        expect(access.auth && (access.onboarding || access.today)).toBe(false);
      }
    }
  });
});

describe('isEditing', () => {
  it('is true only for the signed-in user who started editing, while ready', () => {
    expect(isEditing({ status: 'ready', userId: 'A', editingUserId: 'A' })).toBe(true);
    expect(isEditing({ status: 'ready', userId: 'A', editingUserId: null })).toBe(false);
    expect(isEditing({ status: 'ready', userId: 'B', editingUserId: 'A' })).toBe(false);
    expect(isEditing({ status: 'ready', userId: null, editingUserId: 'A' })).toBe(false);
  });

  it('is false while the profile reloads (the save just finished) or failed', () => {
    for (const status of ['loading', 'error', 'needsGoal', 'signedOut'] as const) {
      expect(isEditing({ status, userId: 'A', editingUserId: 'A' })).toBe(false);
    }
  });
});
