import type { MacroTargets } from '@fitplan/core';
import type { Meal } from '@fitplan/validators';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/card';
import { DateSwitcher } from '../components/date-switcher';
import { ErrorText, PrimaryButton, TextButton } from '../components/form';
import { ListRow } from '../components/list-row';
import { ProgressBar } from '../components/progress-bar';
import { Screen } from '../components/screen';
import { SegmentedControl } from '../components/segmented-control';
import { formatNumber } from '../diary/amount';
import type { DiaryDay, DiaryEntry } from '../diary/api-types';
import { localDate } from '../diary/dates';
import { displayName, entryAmount, groupByMeal, progress } from '../diary/display';
import { rememberEntries } from '../diary/entry-store';
import { useLocale, type Locale, type MessageKey } from '../i18n';
import { api } from '../lib/api';
import { useGate } from '../lib/gate';
import { signOutIfUnauthorized } from '../lib/unauthorized';
import { useSignOut } from '../lib/use-sign-out';
import type { SavedProfile } from '../onboarding/draft-model';
import { useOnboarding } from '../onboarding/draft';
import { tokens } from '../theme/tokens';

type DayState = { state: 'loading' } | { state: 'error' } | { state: 'ready'; day: DiaryDay };

const LOCALES = ['zh', 'en'] as const satisfies readonly Locale[];

const MACROS = [
  { key: 'proteinG', label: 'macro.protein', color: tokens.color.protein },
  { key: 'carbsG', label: 'macro.carbs', color: tokens.color.carbs },
  { key: 'fatG', label: 'macro.fat', color: tokens.color.fat },
] as const satisfies readonly { key: keyof MacroTargets; label: MessageKey; color: string }[];

/**
 * Today: the food diary for one day (today by default; ‹ › moves between days, never past
 * today), its totals against the latest daily target, and the four meals with their entries.
 * "Edit my answers" re-opens the questionnaire pre-filled from the saved profile.
 */
export default function Today() {
  const { t, locale, setLocale } = useLocale();
  const signOut = useSignOut();
  const { editing, startEditing, stopEditing } = useGate();
  const { ownerId, editFrom } = useOnboarding();
  const [today, setToday] = useState(() => localDate(new Date()));
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<DayState>({ state: 'loading' });
  const [profile, setProfile] = useState<SavedProfile | null>(null);
  const [openWizard, setOpenWizard] = useState(false);
  /** Only the latest request may update the screen (switching days quickly). */
  const latestRequest = useRef(0);

  const load = useCallback(async (forDate: string) => {
    const request = ++latestRequest.current;
    setDay((current) => (current.state === 'ready' && current.day.date === forDate ? current : { state: 'loading' }));
    try {
      const res = await api.api.diary.$get({ query: { date: forDate } });
      if (await signOutIfUnauthorized(res)) return;
      if (!res.ok) throw new Error(`GET /api/diary → ${res.status}`);
      const body = await res.json();
      if (request !== latestRequest.current) return;
      rememberEntries(body.entries);
      setDay({ state: 'ready', day: body });
    } catch {
      if (request === latestRequest.current) setDay({ state: 'error' });
    }
  }, []);

  // Back on Today: close the questionnaire if it was open (back button / swipe from the first
  // step), pick up a new calendar day, and reload the diary (an entry may have been added).
  useFocusEffect(
    useCallback(() => {
      stopEditing();
      setToday(localDate(new Date()));
      void load(date);
    }, [stopEditing, load, date]),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.api.me.profile.$get();
        if (await signOutIfUnauthorized(res)) return;
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setProfile(body.profile);
      } catch {
        // Without the profile only "Edit my answers" is hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The guard opens (onboarding) only after `editing` has rendered, so navigate from here
  // rather than in the press handler (a push before that would be refused).
  useEffect(() => {
    if (!openWizard || !editing) return;
    setOpenWizard(false);
    router.push('/goal');
  }, [openWizard, editing]);

  function editAnswers(saved: SavedProfile) {
    if (ownerId === null) return;
    editFrom(saved, ownerId);
    startEditing();
    setOpenWizard(true);
  }

  function addTo(meal: Meal) {
    router.push({ pathname: '/food/search', params: { date, meal } });
  }

  return (
    <Screen>
      <DateSwitcher date={date} today={today} onChange={setDate} />

      {day.state === 'loading' ? (
        <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
      ) : day.state === 'error' ? (
        <Card>
          <ErrorText message={t('today.loadError')} />
          <PrimaryButton title={t('gate.error.retry')} onPress={() => void load(date)} />
        </Card>
      ) : (
        <>
          <Summary day={day.day} />
          {groupByMeal(day.day.entries).map((group) => (
            <Card key={group.meal}>
              <View style={styles.mealHeader}>
                <Text accessibilityRole="header" style={styles.cardTitle}>
                  {t(`meal.${group.meal}`)}
                </Text>
                {group.entries.length > 0 ? (
                  <Text style={styles.mealKcal}>{t('report.kcal', { n: group.subtotal.totals.kcal })}</Text>
                ) : null}
              </View>
              {group.entries.length === 0 ? <Text style={styles.muted}>{t('diary.empty')}</Text> : null}
              {group.entries.map((entry) => (
                <ListRow
                  key={entry.id}
                  title={displayName(entry, locale)}
                  subtitle={amountText(entry, t)}
                  value={entry.nutrients.kcal === null ? t('food.unknown') : t('report.kcal', { n: Math.round(entry.nutrients.kcal) })}
                  onPress={() => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}
                />
              ))}
              <TextButton
                title={`+ ${t('diary.add')}`}
                accessibilityLabel={t('diary.addTo', { meal: t(`meal.${group.meal}`) })}
                onPress={() => addTo(group.meal)}
              />
            </Card>
          ))}
        </>
      )}

      <View style={styles.settings}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {t('today.settings')}
        </Text>
        {profile ? <TextButton title={t('today.editAnswers')} onPress={() => editAnswers(profile)} /> : null}
        <SegmentedControl
          label={t('lang.label')}
          value={locale}
          options={LOCALES.map((l) => ({ value: l, label: t(`lang.${l}`) }))}
          onChange={setLocale}
        />
        <TextButton title={t('auth.signOut')} onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

type T = ReturnType<typeof useLocale>['t'];

function amountText(entry: DiaryEntry, t: T): string {
  const amount = entryAmount(entry);
  if (amount.kind === 'grams') return t('common.grams', { n: formatNumber(amount.grams) });
  const n = formatNumber(amount.quantity, 2);
  return amount.label === null ? t('food.servings', { n }) : t('diary.portionAmount', { n, label: amount.label });
}

/** Eaten vs target: kcal, what is left (or over), and a bar per macro. */
function Summary({ day }: { day: DiaryDay }) {
  const { t } = useLocale();
  const { totals, target } = day;
  const left = target ? target.kcal - totals.kcal : null;

  return (
    <Card>
      <Text style={styles.muted}>{t('diary.eaten')}</Text>
      <View style={styles.kcalRow}>
        <Text style={styles.kcal}>{totals.kcal}</Text>
        <Text style={styles.kcalTarget}>{target ? t('diary.ofTarget', { n: target.kcal }) : t('diary.kcalUnit')}</Text>
      </View>
      {target && left !== null ? (
        <>
          <Text style={[styles.left, left < 0 && styles.over]}>
            {left >= 0 ? t('diary.remaining', { n: left }) : t('diary.over', { n: -left })}
          </Text>
          <ProgressBar value={progress(totals.kcal, target.kcal)} color={tokens.color.primary} label={t('diary.eaten')} />
          {MACROS.map(({ key, label, color }) => {
            const amount = t('diary.macroAmount', { eaten: totals[key], target: target[key] });
            return (
              <View key={key} style={styles.macro}>
                <View style={styles.macroRow}>
                  <Text style={styles.macroLabel}>{t(label)}</Text>
                  <Text style={styles.macroValue}>{amount}</Text>
                </View>
                <ProgressBar value={progress(totals[key], target[key])} color={color} label={`${t(label)} ${amount}`} />
              </View>
            );
          })}
        </>
      ) : (
        <Text style={styles.muted}>{t('diary.noTarget')}</Text>
      )}
      {day.unknown.length > 0 ? <Text style={styles.muted}>{t('diary.unknown')}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.semibold,
  },
  muted: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  kcalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: tokens.space.sm,
  },
  kcal: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.display,
    fontWeight: tokens.fontWeight.bold,
  },
  kcalTarget: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
  left: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.medium,
  },
  over: {
    color: tokens.color.danger,
  },
  macro: {
    gap: tokens.space.xs,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLabel: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
  macroValue: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  mealKcal: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
  settings: {
    gap: tokens.space.sm,
    marginTop: tokens.space.xl,
  },
});
