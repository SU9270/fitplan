import type { InferResponseType } from 'hono/client';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/card';
import { ErrorText, PrimaryButton, TextButton, TextField } from '../../components/form';
import { ListRow } from '../../components/list-row';
import { MacroTiles } from '../../components/macro-tiles';
import { Screen } from '../../components/screen';
import { SegmentedControl } from '../../components/segmented-control';
import { localDate } from '../../diary/dates';
import { useLocale, type Locale, type MessageKey } from '../../i18n';
import { api } from '../../lib/api';
import { authClient } from '../../lib/auth-client';
import { useGate } from '../../lib/gate';
import { signOutIfUnauthorized } from '../../lib/unauthorized';
import { useSignOut } from '../../lib/use-sign-out';
import { useOnboarding } from '../../onboarding/draft';
import { checkNickname, formatHeight, formatWeight, initial, type UnitSystem } from '../../profile/format';
import { tokens } from '../../theme/tokens';

type ProfileBody = InferResponseType<typeof api.api.me.profile.$get, 200>;
type Stats = InferResponseType<typeof api.api.diary.stats.$get, 200>;
type OwnFoods = InferResponseType<typeof api.api.foods.mine.$get, 200>['foods'];

type Loaded<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: T };

const LOCALES = ['zh', 'en'] as const satisfies readonly Locale[];
const UNITS = ['metric', 'imperial'] as const satisfies readonly UnitSystem[];

// Loaders: null after a 401 (already signed out), throw on other failures.
async function fetchProfile(): Promise<ProfileBody | null> {
  const res = await api.api.me.profile.$get();
  if (await signOutIfUnauthorized(res)) return null;
  if (!res.ok) throw new Error(`GET /api/me/profile → ${res.status}`);
  return res.json();
}

async function fetchStats(): Promise<Stats | null> {
  const res = await api.api.diary.stats.$get({ query: { today: localDate(new Date()) } });
  if (await signOutIfUnauthorized(res)) return null;
  if (!res.ok) throw new Error(`GET /api/diary/stats → ${res.status}`);
  return res.json();
}

async function fetchOwnFoods(): Promise<OwnFoods | null> {
  const res = await api.api.foods.mine.$get();
  if (await signOutIfUnauthorized(res)) return null;
  if (!res.ok) throw new Error(`GET /api/foods/mine → ${res.status}`);
  return (await res.json()).foods;
}

/**
 * Me tab: account (name, email), body profile and daily targets with "Edit my answers",
 * logging stats, the user's custom foods, and settings (language, units, sign out).
 */
export default function Me() {
  const { t, locale, setLocale } = useLocale();
  const signOut = useSignOut();
  const { editing, startEditing, stopEditing } = useGate();
  const { ownerId, editFrom } = useOnboarding();
  const [profile, setProfile] = useState<Loaded<ProfileBody>>({ state: 'loading' });
  const [stats, setStats] = useState<Loaded<Stats>>({ state: 'loading' });
  const [foods, setFoods] = useState<Loaded<OwnFoods>>({ state: 'loading' });
  const [settingsError, setSettingsError] = useState(false);
  const [openWizard, setOpenWizard] = useState(false);

  const load = useCallback(() => {
    const settle = <T,>(set: (v: Loaded<T>) => void, request: Promise<T | null>) =>
      request.then(
        (data) => {
          if (data !== null) set({ state: 'ready', data });
        },
        () => set({ state: 'error' }),
      );
    void settle(setProfile, fetchProfile());
    void settle(setStats, fetchStats());
    void settle(setFoods, fetchOwnFoods());
  }, []);

  // Back on Me: close the questionnaire if it was left without saving, and refresh everything
  // (a custom food or an entry may have changed elsewhere).
  useFocusEffect(
    useCallback(() => {
      stopEditing();
      load();
    }, [stopEditing, load]),
  );

  // The guard opens (onboarding) only after `editing` has rendered, so navigate from here
  // rather than in the press handler (a push before that would be refused).
  useEffect(() => {
    if (!openWizard || !editing) return;
    setOpenWizard(false);
    router.push('/goal');
  }, [openWizard, editing]);

  const saved = profile.state === 'ready' ? profile.data.profile : null;

  function editAnswers() {
    if (ownerId === null || saved === null) return;
    editFrom(saved, ownerId);
    startEditing();
    setOpenWizard(true);
  }

  async function saveSettings(patch: { locale?: Locale; unitSystem?: UnitSystem }) {
    setSettingsError(false);
    if (patch.locale) setLocale(patch.locale);
    if (saved === null) return;
    try {
      const res = await api.api.me.settings.$patch({ json: patch });
      if (await signOutIfUnauthorized(res)) return;
      if (!res.ok) throw new Error(`PATCH /api/me/settings → ${res.status}`);
      const { settings } = await res.json();
      setProfile((current) =>
        current.state === 'ready' && current.data.profile
          ? { state: 'ready', data: { ...current.data, profile: { ...current.data.profile, ...settings } } }
          : current,
      );
    } catch {
      setSettingsError(true);
    }
  }

  return (
    <Screen inTabs>
      <Text accessibilityRole="header" style={styles.title}>
        {t('profile.title')}
      </Text>

      <AccountCard />

      <Card>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {t('profile.body.title')}
        </Text>
        {profile.state === 'loading' ? (
          <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
        ) : profile.state === 'error' ? (
          <>
            <ErrorText message={t('profile.loadError')} />
            <PrimaryButton title={t('gate.error.retry')} onPress={load} />
          </>
        ) : profile.data.profile === null ? (
          <Text style={styles.muted}>{t('profile.noProfile')}</Text>
        ) : (
          <BodySummary body={profile.data} onEdit={editAnswers} />
        )}
      </Card>

      <Card>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {t('profile.stats.title')}
        </Text>
        {stats.state === 'ready' ? (
          <View style={styles.statRow}>
            <Stat value={t('profile.stats.daysValue', { n: stats.data.loggedDays })} label={t('profile.stats.days')} />
            <Stat value={t('profile.stats.daysValue', { n: stats.data.currentStreak })} label={t('profile.stats.streak')} />
            <Stat value={String(stats.data.totalEntries)} label={t('profile.stats.entries')} />
          </View>
        ) : stats.state === 'error' ? (
          <ErrorText message={t('profile.loadError')} />
        ) : (
          <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
        )}
      </Card>

      <Card>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {t('profile.foods.title')}
        </Text>
        {foods.state === 'ready' ? (
          foods.data.length === 0 ? (
            <Text style={styles.muted}>{t('profile.foods.empty')}</Text>
          ) : (
            foods.data.map((food) => (
              <ListRow
                key={food.id}
                title={food.name}
                value={
                  food.per100g.kcal === null
                    ? t('food.per100g.unknown')
                    : t('food.per100g', { n: Math.round(food.per100g.kcal) })
                }
                onPress={() => router.push({ pathname: '/food/[id]', params: { id: food.id } })}
              />
            ))
          )
        ) : foods.state === 'error' ? (
          <ErrorText message={t('profile.loadError')} />
        ) : (
          <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
        )}
        <TextButton title={`+ ${t('profile.foods.add')}`} onPress={() => router.push('/food/custom')} />
      </Card>

      <Card>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {t('profile.settings.title')}
        </Text>
        <Text style={styles.label}>{t('lang.label')}</Text>
        <SegmentedControl
          label={t('lang.label')}
          value={locale}
          options={LOCALES.map((l) => ({ value: l, label: t(`lang.${l}`) }))}
          onChange={(l) => void saveSettings({ locale: l })}
        />
        {saved ? (
          <>
            <Text style={styles.label}>{t('profile.units')}</Text>
            <SegmentedControl
              label={t('profile.units')}
              value={saved.unitSystem}
              options={UNITS.map((u) => ({ value: u, label: t(`profile.units.${u}`) }))}
              onChange={(u) => void saveSettings({ unitSystem: u })}
            />
          </>
        ) : null}
        <ErrorText message={settingsError ? t('profile.settings.error') : null} />
        <TextButton title={t('auth.signOut')} onPress={() => void signOut()} />
      </Card>
    </Screen>
  );
}

/** Avatar letter, name (editable) and email from the Better Auth session. */
function AccountCard() {
  const { t } = useLocale();
  const { data: session } = authClient.useSession();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const name = session?.user.name ?? '';

  async function save() {
    if (draft === null) return;
    const nickname = checkNickname(draft);
    if (nickname === null) {
      setError('profile.nickname.invalid');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: failed } = await authClient.updateUser({ name: nickname });
      if (failed) throw new Error(failed.message);
      setDraft(null);
    } catch {
      setError('profile.nickname.error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={styles.account}>
        <View style={styles.avatar} accessible={false}>
          <Text style={styles.avatarText}>{initial(name)}</Text>
        </View>
        <View style={styles.accountTexts}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {session?.user.email ?? ''}
          </Text>
        </View>
      </View>
      {draft === null ? (
        <TextButton title={t('profile.editName')} onPress={() => setDraft(name)} />
      ) : (
        <>
          <TextField label={t('profile.nickname')} value={draft} onChangeText={setDraft} autoFocus maxLength={60} />
          <ErrorText message={error && t(error)} />
          <PrimaryButton title={t('common.save')} onPress={() => void save()} busy={busy} />
          <TextButton
            title={t('common.cancel')}
            onPress={() => {
              setDraft(null);
              setError(null);
            }}
          />
        </>
      )}
    </Card>
  );
}

function BodySummary({ body, onEdit }: { body: ProfileBody; onEdit: () => void }) {
  const { t } = useLocale();
  const p = body.profile;
  if (!p) return null;
  const rows: [MessageKey, string][] = [
    ['profile.age', t('profile.ageValue', { n: p.age })],
    ['profile.sex', t(`onboarding.sex.${p.sex}`)],
    ['profile.height', formatHeight(p.heightCm, p.unitSystem)],
    ['profile.weight', formatWeight(p.weightKg, p.unitSystem)],
    ['profile.goal', `${t(`onboarding.goal.${p.goal}.title`)} · ${t(`onboarding.pace.${p.pace}`)}`],
  ];
  if (body.latestGoal) rows.push(['profile.bmi', String(body.latestGoal.bmi)]);

  return (
    <>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row} accessible accessibilityLabel={`${t(label)} ${value}`}>
          <Text style={styles.rowLabel}>{t(label)}</Text>
          <Text style={styles.rowValue}>{value}</Text>
        </View>
      ))}
      {body.latestGoal ? (
        <>
          <Text style={styles.label}>{t('profile.target')}</Text>
          <Text style={styles.kcal}>{t('report.kcal', { n: body.latestGoal.targets.kcal })}</Text>
          <MacroTiles targets={body.latestGoal.targets} />
        </>
      ) : null}
      <TextButton title={t('today.editAnswers')} onPress={onEdit} />
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const AVATAR = 56;

const styles = StyleSheet.create({
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.bold,
  },
  cardTitle: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.semibold,
  },
  label: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
  muted: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primarySoft,
  },
  avatarText: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.bold,
  },
  accountTexts: {
    flex: 1,
    gap: tokens.space.xs,
  },
  name: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.semibold,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowLabel: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
  rowValue: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.medium,
  },
  kcal: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.bold,
  },
  statRow: {
    flexDirection: 'row',
    gap: tokens.space.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.space.xs,
    padding: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.background,
  },
  statValue: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.bold,
  },
});
