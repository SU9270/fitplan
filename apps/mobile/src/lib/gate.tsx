import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { authClient } from './auth-client';
import { isEditing } from './route-access';

/**
 * Where the app should send the user (controller ruling 9):
 * - `signedOut` → (auth)/sign-in
 * - `needsGoal` → signed in, `GET /api/me/profile` has `latestGoal === null` → (onboarding)/goal
 * - `ready`     → signed in with a goal → today
 * - `loading` while the session or profile is being read; `error` if the profile request failed.
 *
 * `editing`: a `ready` user chose "Edit my answers" on Today, which also opens the questionnaire
 * (see `routeAccess`). Saving the edited answers calls `refreshProfile`, which ends it.
 */
export type GateStatus = 'loading' | 'signedOut' | 'needsGoal' | 'ready' | 'error';

type GateValue = {
  status: GateStatus;
  /** Re-read the profile (after an error, or once onboarding has saved a goal). Ends editing. */
  refreshProfile: () => void;
  editing: boolean;
  /** Open the questionnaire for a user who already has a goal. */
  startEditing: () => void;
  /** Close it again without saving (the user is back on Today). */
  stopEditing: () => void;
};

type ProfileState = { userId: string; result: 'needsGoal' | 'ready' | 'error' };

const GateContext = createContext<GateValue | null>(null);

export function GateProvider({ children }: { children: ReactNode }) {
  // expoClient restores the cached session from SecureStore, so a relaunch knows the user
  // before the network replies; Better Auth refetches it in the background.
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id ?? null;

  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Signing out ends editing (derived during render, like the onboarding draft's owner).
  if (userId === null && editingUserId !== null) setEditingUserId(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      let result: ProfileState['result'];
      try {
        const res = await api.api.me.profile.$get();
        if (res.status === 401) {
          // The cached session is no longer valid on the server: drop it locally.
          await authClient.signOut();
          return;
        }
        if (!res.ok) throw new Error(`GET /api/me/profile → ${res.status}`);
        const body = await res.json();
        result = body.latestGoal === null ? 'needsGoal' : 'ready';
      } catch {
        result = 'error';
      }
      if (!cancelled) setProfile({ userId, result });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  const refreshProfile = useCallback(() => {
    setEditingUserId(null);
    setProfile(null);
    setReloadToken((n) => n + 1);
  }, []);
  const startEditing = useCallback(() => setEditingUserId(userId), [userId]);
  const stopEditing = useCallback(() => setEditingUserId(null), []);

  let status: GateStatus;
  if (!userId) status = isPending ? 'loading' : 'signedOut';
  else if (profile?.userId !== userId) status = 'loading';
  else status = profile.result;

  const editing = isEditing({ status, userId, editingUserId });
  const value = useMemo(
    () => ({ status, refreshProfile, editing, startEditing, stopEditing }),
    [status, refreshProfile, editing, startEditing, stopEditing],
  );
  return <GateContext value={value}>{children}</GateContext>;
}

export function useGate(): GateValue {
  const value = use(GateContext);
  if (!value) throw new Error('useGate must be used inside <GateProvider>');
  return value;
}
