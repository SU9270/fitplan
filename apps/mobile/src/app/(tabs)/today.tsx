import { shiftDate } from '@fitplan/core';
import type { Meal } from '@fitplan/validators';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { ActivityRings } from '../../components/activity-rings';
import { Card, CardHeader, Tile } from '../../components/card';
import { DateSwitcher } from '../../components/date-switcher';
import { ErrorText, PrimaryButton, SoftButton, TextButton } from '../../components/form';
import { MealPlate } from '../../components/meal-plate';
import { MACROS, MacroTiles } from '../../components/macro-tiles';
import { Screen } from '../../components/screen';
import type { DiaryDay } from '../../diary/api-types';
import { localDate } from '../../diary/dates';
import { progress } from '../../diary/display';
import { rememberEntries } from '../../diary/entry-store';
import type { SuggestionView } from '../../diary/plate-view';
import { useLocale } from '../../i18n';
import { api } from '../../lib/api';
import { call, failureText, type Failure } from '../../lib/request';
import { withJson } from '../../lib/with-json';
import { createInFlightGuard } from '../../onboarding/in-flight';
import { tokens } from '../../theme/tokens';

type DayState = { state: 'loading' } | { state: 'error'; failure: Failure } | { state: 'ready'; day: DiaryDay };

/**
 * Today tab: the food diary for one day (today by default; ‹ › moves between days, never past
 * today), its totals against the latest daily target, and each meal as a four-cell plate with
 * the meal's gap feedback and one-tap adjustments. Profile and settings live on the Me tab.
 */
export default function Today() {
  const { t, locale } = useLocale();
  const [today, setToday] = useState(() => localDate(new Date()));
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<DayState>({ state: 'loading' });
  const [applying, setApplying] = useState(false);
  /** The meal whose suggestion could not be applied. */
  const [applyError, setApplyError] = useState<{ meal: Meal; failure: Failure } | null>(null);
  const [runExclusive] = useState(createInFlightGuard);
  /** After a copy: nothing to copy, or it failed — for a meal or the whole day. */
  const [copyNote, setCopyNote] = useState<{ target: Meal | 'day'; failure: Failure | null } | null>(null);
  /** Only the latest request may update the screen (switching days quickly). */
  const latestRequest = useRef(0);

  const load = useCallback(async (forDate: string) => {
    const request = ++latestRequest.current;
    setDay((current) => (current.state === 'ready' && current.day.date === forDate ? current : { state: 'loading' }));
    const out = await call('today.loadError', () => api.api.diary.$get({ query: { date: forDate } }));
    if (out.kind === 'signedOut' || request !== latestRequest.current) return;
    if (out.kind === 'failed') {
      setDay({ state: 'error', failure: out.failure });
      return;
    }
    const body = await out.res.json();
    if (request !== latestRequest.current) return;
    rememberEntries(body.entries);
    setDay({ state: 'ready', day: body });
  }, []);

  // Reload on focus (an entry may have been added or changed) and pick up a new calendar day.
  useFocusEffect(
    useCallback(() => {
      setToday(localDate(new Date()));
      setCopyNote(null);
      void load(date);
    }, [load, date]),
  );

  /** Apply a suggestion: add the suggested food, or set the entry to the suggested amount. */
  function apply(meal: Meal, suggestion: SuggestionView) {
    void runExclusive(async () => {
      setApplying(true);
      setApplyError(null);
      const out = await call('suggest.error', () =>
        suggestion.kind === 'add'
          ? api.api.diary.entries.$post({
              json: { date, meal, foodId: suggestion.foodId, portionId: suggestion.portionId, quantity: suggestion.quantity },
            })
          : api.api.diary.entries[':id'].$patch(
              withJson({ id: suggestion.entryId }, { portionId: suggestion.portionId, quantity: suggestion.quantity }),
            ),
      );
      if (out.kind === 'failed') setApplyError({ meal, failure: out.failure });
      if (out.kind === 'ok') await load(date);
      setApplying(false);
    });
  }

  /** Copy yesterday's meal (or whole day when `meal` is null) into the shown day. */
  function copyYesterday(meal: Meal | null) {
    void runExclusive(async () => {
      setApplying(true);
      setApplyError(null);
      setCopyNote(null);
      const out = await call('copy.error', () =>
        api.api.diary.copy.$post({ json: { fromDate: shiftDate(date, -1), toDate: date, ...(meal ? { meal } : {}) } }),
      );
      if (out.kind === 'failed') setCopyNote({ target: meal ?? 'day', failure: out.failure });
      if (out.kind === 'ok') {
        const { copied } = await out.res.json();
        if (copied === 0) setCopyNote({ target: meal ?? 'day', failure: null });
        else await load(date);
      }
      setApplying(false);
    });
  }

  function addTo(meal: Meal) {
    router.push({ pathname: '/food/search', params: { date, meal } });
  }

  return (
    <Screen inTabs>
      <DateSwitcher date={date} today={today} onChange={setDate} />

      {day.state === 'loading' ? (
        <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
      ) : day.state === 'error' ? (
        <Card>
          <Tile>
            <ErrorText message={failureText(day.failure, t)} />
          </Tile>
          <PrimaryButton title={t('gate.error.retry')} onPress={() => void load(date)} />
        </Card>
      ) : (
        <>
          <Summary day={day.day} />
          {day.day.entries.length === 0 ? (
            <>
              <SoftButton title={t('copy.day')} onPress={() => copyYesterday(null)} disabled={applying} />
              {copyNote?.target === 'day' ? (
                <Text style={styles.copyNote}>{copyNote.failure ? failureText(copyNote.failure, t) : t('copy.emptyDay')}</Text>
              ) : null}
            </>
          ) : null}
          {day.day.meals.map((view) => {
            const inMeal = day.day.entries.filter((e) => e.meal === view.meal);
            return (
            <Card key={view.meal}>
              <CardHeader
                strong
                label={t(`meal.${view.meal}`)}
                right={
                  <Text style={styles.subtotal}>
                    {view.target
                      ? t('plate.mealKcal', { eaten: view.totals.kcal, target: view.target.kcal })
                      : t('report.kcal', { n: view.totals.kcal })}
                  </Text>
                }
              />
              <MealPlate
                view={view}
                entries={inMeal}
                onOpenEntry={(entry) => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}
                onApply={(suggestion) => apply(view.meal, suggestion)}
                applying={applying}
              />
              {applyError?.meal === view.meal ? <ErrorText message={failureText(applyError.failure, t)} /> : null}
              {copyNote?.target === view.meal ? (
                <Text style={styles.copyNote}>
                  {copyNote.failure ? failureText(copyNote.failure, t) : t('copy.emptyMeal', { meal: t(`meal.${view.meal}`) })}
                </Text>
              ) : null}
              <SoftButton
                title={`+ ${t('diary.add')}`}
                accessibilityLabel={t('diary.addTo', { meal: t(`meal.${view.meal}`) })}
                onPress={() => addTo(view.meal)}
              />
              {inMeal.length === 0 ? (
                <TextButton
                  title={t('copy.meal', { meal: t(`meal.${view.meal}`) })}
                  onPress={() => copyYesterday(view.meal)}
                  disabled={applying}
                />
              ) : (
                <TextButton
                  title={t('templates.save')}
                  onPress={() => router.push({ pathname: '/food/save-meal', params: { date, meal: view.meal } })}
                />
              )}
            </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

/** Eaten vs target: kcal and what is left (or over), concentric rings, and a tile per macro. */
function Summary({ day }: { day: DiaryDay }) {
  const { t } = useLocale();
  const { totals, target } = day;
  const left = target ? target.kcal - totals.kcal : null;
  const unit = target ? t('diary.ofTarget', { n: target.kcal }) : t('diary.kcalUnit');

  return (
    <Card>
      {/* The teal square matches the outer (kcal) ring, as the macro tiles' squares match theirs. */}
      <CardHeader
        label={t('diary.eaten')}
        title={String(totals.kcal)}
        unit={unit}
        swatch={target ? tokens.color.kcal : undefined}
      />
      {target && left !== null ? (
        <>
          <Text style={[styles.left, left < 0 && styles.over]}>
            {left >= 0 ? t('diary.remaining', { n: left }) : t('diary.over', { n: -left })}
          </Text>
          <ActivityRings
            accessibilityLabel={`${t('diary.eaten')} ${totals.kcal} ${unit}`}
            rings={[
              { progress: progress(totals.kcal, target.kcal), color: tokens.color.kcal, track: tokens.color.kcalTrack },
              ...MACROS.map(({ field, color, track }) => ({ progress: progress(totals[field], target[field]), color, track })),
            ]}
          />
          <MacroTiles targets={target} eaten={totals} />
        </>
      ) : (
        <Tile>
          <Text style={styles.muted}>{t('diary.noTarget')}</Text>
        </Tile>
      )}
      {day.unknown.length > 0 ? <Text style={[styles.muted, styles.note]}>{t('diary.unknown')}</Text> : null}
    </Card>
  );
}

/** Digits of equal width, so numbers do not shift as they change. */
const TABULAR = ['tabular-nums'] as const;

const styles = StyleSheet.create({
  muted: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
  },
  note: {
    paddingHorizontal: tokens.card.headerInset,
  },
  subtotal: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
    fontVariant: TABULAR,
  },
  left: {
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.space.sm,
    paddingVertical: tokens.hairline,
    overflow: 'hidden',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primarySoft,
    color: tokens.color.primary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.medium,
  },
  // Neutral, not a red warning (requirements §3.3).
  copyNote: {
    paddingHorizontal: tokens.card.headerInset,
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
  },
  over: {
    backgroundColor: tokens.color.border,
    color: tokens.color.textSecondary,
  },
});
