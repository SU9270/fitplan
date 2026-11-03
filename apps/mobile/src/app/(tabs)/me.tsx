import type { MealShares } from '@fitplan/core';
import type { InferResponseType } from 'hono/client';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Card, CardHeader, Tile } from '../../components/card';
import { ErrorText, PrimaryButton, SoftButton, TextButton, TextField } from '../../components/form';
import { InfoRow } from '../../components/info-row';
import { ListRow } from '../../components/list-row';
import { MacroTiles } from '../../components/macro-tiles';
import { MealSharesEditor } from '../../components/meal-shares-editor';
import { Screen } from '../../components/screen';
import { SegmentedControl } from '../../components/segmented-control';
import type { MealTemplate } from '../../diary/api-types';
import { localDate } from '../../diary/dates';
import { useLocale, type Locale, type MessageKey } from '../../i18n';
import { api } from '../../lib/api';
import { authClient } from '../../lib/auth-client';
import { useGate } from '../../lib/gate';
import { call, failureText, problemOfStatus, problemOfThrown, type Failure, type Outcome } from '../../lib/request';
import { useSignOut } from '../../lib/use-sign-out';
import { useOnboarding } from '../../onboarding/draft';
import { checkNickname, formatHeight, formatWeight, initial, type UnitSystem } from '../../profile/format';
import { tokens } from '../../theme/tokens';

type ProfileBody = InferResponseType<typeof api.api.me.profile.$get, 200>;
type Stats = InferResponseType<typeof api.api.diary.stats.$get, 200>;
type OwnFoods = InferResponseType<typeof api.api.foods.mine.$get, 200>['foods'];

type Loaded<T> = { state: 'loading' } | { state: 'error'; failure: Failure } | { state: 'ready'; data: T };
/** A loader's result: the data, or why there is none. */
type Fetched<T> = { kind: 'ok'; data: T } | Exclude<Outcome<never>, { kind: 'ok' }>;

const LOCALES = ['zh', 'en'] as const satisfies readonly Locale[];
const UNITS = ['metric', 'imperial'] as const satisfies readonly UnitSystem[];

async function fetchProfile(): Promise<Fetched<ProfileBody>> {
  const out = await call('profile.loadError', () => api.api.me.profile.$get());
  return out.kind === 'ok' ? { kind: 'ok', data: await out.res.json() } : out;
}

async function fetchStats(): Promise<Fetched<Stats>> {
  const out = await call('profile.loadError', () => api.api.diary.stats.$get({ query: { today: localDate(new Date()) } }));
  return out.kind === 'ok' ? { kind: 'ok', data: await out.res.json() } : out;
}

async function fetchTemplates(): Promise<Fetched<MealTemplate[]>> {
  const out = await call('profile.loadError', () => api.api['meal-templates'].$get());
  return out.kind === 'ok' ? { kind: 'ok', data: (await out.res.json()).templates } : out;
}

async function fetchOwnFoods(): Promise<Fetched<OwnFoods>> {
  const out = await call('profile.loadError', () => api.api.foods.mine.$get());
  return out.kind === 'ok' ? { kind: 'ok', data: (await out.res.json()).foods } : out;
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
  const [templates, setTemplates] = useState<Loaded<MealTemplate[]>>({ state: 'loading' });
  const [settingsError, setSettingsError] = useState<Failure | null>(null);
  const [openWizard, setOpenWizard] = useState(false);

  const load = useCallback(() => {
    const settle = <T,>(set: (v: Loaded<T>) => void, request: Promise<Fetched<T>>) =>
      request.then(
        (out) => {
          if (out.kind === 'ok') set({ state: 'ready', data: out.data });
          if (out.kind === 'failed') set({ state: 'error', failure: out.failure });
        },
        // An unreadable response body.
        () => set({ state: 'error', failure: { action: 'profile.loadError', problem: 'unknown' } }),
      );
    void settle(setProfile, fetchProfile());
    void settle(setStats, fetchStats());
    void settle(setFoods, fetchOwnFoods());
    void settle(setTemplates, fetchTemplates());
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

  function confirmDeleteTemplate(template: MealTemplate) {
    Alert.alert(t('templates.delete.title', { name: template.name }), t('templates.delete.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          void (async () => {
            setSettingsError(null);
            const out = await call('common.deleteError', () =>
              api.api['meal-templates'][':id'].$delete({ param: { id: template.id } }),
            );
            if (out.kind === 'signedOut') return;
            // Already gone counts as deleted.
            if (out.kind === 'failed' && out.failure.problem !== 'notFound') {
              setSettingsError(out.failure);
              return;
            }
            setTemplates((current) =>
              current.state === 'ready' ? { state: 'ready', data: current.data.filter((x) => x.id !== template.id) } : current,
            );
          })(),
      },
    ]);
  }

  async function saveMealShares(mealShares: MealShares): Promise<boolean> {
    setSettingsError(null);
    const out = await call('profile.settings.error', () => api.api.me.settings.$patch({ json: { mealShares } }));
    if (out.kind === 'failed') setSettingsError(out.failure);
    if (out.kind !== 'ok') return false;
    const { settings } = await out.res.json();
    setProfile((current) =>
      current.state === 'ready' ? { state: 'ready', data: { ...current.data, mealShares: settings.mealShares } } : current,
    );
    return true;
  }

  async function saveSettings(patch: { locale?: Locale; unitSystem?: UnitSystem }) {
    setSettingsError(null);
    if (patch.locale) setLocale(patch.locale);
    if (saved === null) return;
    const out = await call('profile.settings.error', () => api.api.me.settings.$patch({ json: patch }));
    if (out.kind === 'failed') setSettingsError(out.failure);
    if (out.kind !== 'ok') return;
    const { settings } = await out.res.json();
    setProfile((current) =>
      current.state === 'ready' && current.data.profile
        ? {
            state: 'ready',
            data: {
              ...current.data,
              profile: { ...current.data.profile, unitSystem: settings.unitSystem, locale: settings.locale },
            },
          }
        : current,
    );
  }

  return (
    <Screen inTabs>
      <Text accessibilityRole="header" style={styles.title}>
        {t('profile.title')}
      </Text>

      <AccountCard />

      <Card>
        <CardHeader label={t('profile.body.title')} />
        {profile.state === 'loading' ? (
          <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
        ) : profile.state === 'error' ? (
          <>
            <Tile>
              <ErrorText message={failureText(profile.failure, t)} />
            </Tile>
            <PrimaryButton title={t('gate.error.retry')} onPress={load} />
          </>
        ) : profile.data.profile === null ? (
          <Tile>
            <Text style={styles.muted}>{t('profile.noProfile')}</Text>
          </Tile>
        ) : (
          <BodySummary body={profile.data} onEdit={editAnswers} />
        )}
      </Card>

      <Card>
        <CardHeader label={t('profile.stats.title')} />
        {stats.state === 'ready' ? (
          <View style={styles.statRow}>
            <Stat value={t('profile.stats.daysValue', { n: stats.data.loggedDays })} label={t('profile.stats.days')} />
            <Stat value={t('profile.stats.daysValue', { n: stats.data.currentStreak })} label={t('profile.stats.streak')} />
            <Stat value={String(stats.data.totalEntries)} label={t('profile.stats.entries')} />
          </View>
        ) : stats.state === 'error' ? (
          <Tile>
            <ErrorText message={failureText(stats.failure, t)} />
          </Tile>
        ) : (
          <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
        )}
      </Card>

      <Card>
        <CardHeader label={t('profile.foods.title')} />
        {foods.state === 'ready' ? (
          foods.data.length === 0 ? (
            <Tile>
              <Text style={styles.muted}>{t('profile.foods.empty')}</Text>
            </Tile>
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
          <Tile>
            <ErrorText message={failureText(foods.failure, t)} />
          </Tile>
        ) : (
          <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
        )}
        <SoftButton title={`+ ${t('profile.foods.add')}`} onPress={() => router.push('/food/custom')} />
      </Card>

      <Card>
        <CardHeader label={t('templates.title')} />
        {templates.state === 'ready' ? (
          templates.data.length === 0 ? (
            <Tile>
              <Text style={styles.muted}>{t('templates.empty')}</Text>
            </Tile>
          ) : (
            templates.data.map((template) => (
              <ListRow
                key={template.id}
                title={template.name}
                subtitle={t('templates.items', { n: template.items.length })}
                value={t('report.kcal', { n: template.kcal })}
                accessibilityLabel={`${template.name}. ${t('templates.delete')}`}
                onPress={() => confirmDeleteTemplate(template)}
              />
            ))
          )
        ) : templates.state === 'error' ? (
          <Tile>
            <ErrorText message={failureText(templates.failure, t)} />
          </Tile>
        ) : (
          <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
        )}
      </Card>

      <Card>
        <CardHeader label={t('profile.settings.title')} />
        <Tile>
          <Text style={styles.label}>{t('lang.label')}</Text>
          <SegmentedControl
            label={t('lang.label')}
            value={locale}
            options={LOCALES.map((l) => ({ value: l, label: t(`lang.${l}`) }))}
            onChange={(l) => void saveSettings({ locale: l })}
          />
        </Tile>
        {profile.state === 'ready' && saved ? (
          <Tile>
            <MealSharesEditor value={profile.data.mealShares} onSave={saveMealShares} />
          </Tile>
        ) : null}
        {saved ? (
          <Tile>
            <Text style={styles.label}>{t('profile.units')}</Text>
            <SegmentedControl
              label={t('profile.units')}
              value={saved.unitSystem}
              options={UNITS.map((u) => ({ value: u, label: t(`profile.units.${u}`) }))}
              onChange={(u) => void saveSettings({ unitSystem: u })}
            />
          </Tile>
        ) : null}
        <ErrorText message={settingsError && failureText(settingsError, t)} />
        <TextButton title={t('auth.signOut')} onPress={() => void signOut()} />
      </Card>
    </Screen>
  );
}

/** Avatar letter, name (editable) and email from the Better Auth session, as in BoardUI's profile card. */
function AccountCard() {
  const { t } = useLocale();
  const { data: session } = authClient.useSession();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | Failure | null>(null);
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
      if (failed) {
        console.warn(`[fitplan] profile.nickname.error: HTTP ${failed.status}`, failed.message);
        // Better Auth reports a request that never reached the server as status 0.
        const problem = failed.status ? problemOfStatus(failed.status, 'application/json') : 'network';
        setError({ action: 'profile.nickname.error', problem });
      } else {
        setDraft(null);
      }
    } catch (thrown) {
      console.warn('[fitplan] profile.nickname.error: request failed', thrown);
      setError({ action: 'profile.nickname.error', problem: problemOfThrown(thrown) });
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
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <InfoRow label={t('auth.email.label')} value={session?.user.email ?? ''} />
      {draft === null ? (
        <TextButton title={t('profile.editName')} onPress={() => setDraft(name)} />
      ) : (
        <Tile>
          <TextField label={t('profile.nickname')} value={draft} onChangeText={setDraft} autoFocus maxLength={60} />
          <ErrorText message={error && (typeof error === 'string' ? t(error) : failureText(error, t))} />
          <PrimaryButton title={t('common.save')} onPress={() => void save()} busy={busy} />
          <TextButton
            title={t('common.cancel')}
            onPress={() => {
              setDraft(null);
              setError(null);
            }}
          />
        </Tile>
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
        <InfoRow key={label} label={t(label)} value={value} />
      ))}
      {body.latestGoal ? (
        <>
          <CardHeader label={t('profile.target')} title={String(body.latestGoal.targets.kcal)} unit={t('diary.kcalUnit')} />
          <MacroTiles targets={body.latestGoal.targets} />
        </>
      ) : null}
      <SoftButton title={t('today.editAnswers')} onPress={onEdit} />
    </>
  );
}

/** BoardUI stat tile: gray label, value under it. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const AVATAR = 64;

const styles = StyleSheet.create({
  title: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.semibold,
  },
  label: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
  },
  muted: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
  },
  account: {
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingTop: tokens.space.md,
    paddingBottom: tokens.space.xs,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.borderStrong,
  },
  avatarText: {
    color: tokens.color.onPrimary,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.semibold,
  },
  name: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.medium,
  },
  statRow: {
    flexDirection: 'row',
    gap: tokens.card.gap,
  },
  stat: {
    flex: 1,
    gap: tokens.hairline,
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.card.tilePaddingY,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  statValue: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.semibold,
  },
});
