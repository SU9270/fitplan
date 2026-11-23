import { shiftDate } from '@fitplan/core';
import type { Meal } from '@fitplan/validators';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActivityRings } from '../../components/activity-rings';
import { Card, CardHeader, Tile } from '../../components/card';
import { DateSwitcher } from '../../components/date-switcher';
import { DayFeedback } from '../../components/day-feedback';
import { Kicker, Title, type } from '../../components/display';
import { ErrorText, PrimaryButton, SoftButton, TextButton } from '../../components/form';
import { MealPlate } from '../../components/meal-plate';
import { MACROS, MacroTiles } from '../../components/macro-tiles';
import { Screen } from '../../components/screen';
import { Perforation } from '../../components/ticket';
import type { DiaryDay } from '../../diary/api-types';
import { localDate } from '../../diary/dates';
import { progress } from '../../diary/display';
import { rememberEntries } from '../../diary/entry-store';
import { feedbackSummary, type SuggestionView } from '../../diary/plate-view';
import { kicker, useLocale } from '../../i18n';
import { api } from '../../lib/api';
import { call, failureText, type Failure } from '../../lib/request';
import { withJson } from '../../lib/with-json';
import { mealAt } from '../../library/library-view';
import { createInFlightGuard } from '../../onboarding/in-flight';
import { tokens } from '../../theme/tokens';

type DayState = { state: 'loading' } | { state: 'error'; failure: Failure } | { state: 'ready'; day: DiaryDay };

/**
 * Today tab: the food diary for one day (today by default; ‹ › moves between days, never past
 * today), its totals against the latest daily target, each meal as a short card of its foods, and
 * at the end one line of feedback for the whole day (once dinner has something logged), with the
 * details and one-tap adjustments a tap away. Profile and settings live on the Me tab.
 */
export default function Today() {
  const { t, locale } = useLocale();
  const [today, setToday] = useState(() => localDate(new Date()));
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<DayState>({ state: 'loading' });
  const [applying, setApplying] = useState(false);
  /** Why a suggestion could not be applied. */
  const [applyError, setApplyError] = useState<Failure | null>(null);
  const [runExclusive] = useState(createInFlightGuard);
  /** After a copy: nothing to copy, or it failed — for a meal or the whole day. */
  const [copyNote, setCopyNote] = useState<{ target: Meal | 'day'; failure: Failure | null } | null>(null);
  /** Copy buttons copy from the day before the shown one: "yesterday" only when the shown day is today. */
  const copyKeys =
    date === today
      ? ({ day: 'copy.day', meal: 'copy.meal', emptyDay: 'copy.emptyDay', emptyMeal: 'copy.emptyMeal' } as const)
      : ({ day: 'copy.dayPrev', meal: 'copy.mealPrev', emptyDay: 'copy.emptyDayPrev', emptyMeal: 'copy.emptyMealPrev' } as const);
  /** Only the latest request may update the screen (switching days quickly). */
  const latestRequest = useRef(0);

  const load = useCallback(async (forDate: string) => {
    const request = ++latestRequest.current;
    setDay((current) => (current.state === 'ready' && current.day.date === forDate ? current : { state: 'loading' }));
    // Suggestions go to the meal of the current time; for another day the server picks dinner.
    const now = new Date();
    const query = forDate === localDate(now) ? { date: forDate, meal: mealAt(now) } : { date: forDate };
    const out = await call('today.loadError', () => api.api.diary.$get({ query }));
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

  /** Apply a suggestion: add the suggested food to `meal`, or set the entry to the suggested amount. */
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
      if (out.kind === 'failed') setApplyError(out.failure);
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

  // Only a day with something still short gets the feedback card (2026-11-22).
  const dayFeedback = day.state === 'ready' ? day.day.feedback : null;
  const feedback = dayFeedback && feedbackSummary(dayFeedback, t) !== null ? dayFeedback : null;

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
              <SoftButton title={t(copyKeys.day)} onPress={() => copyYesterday(null)} disabled={applying} />
              {copyNote?.target === 'day' ? (
                <Text style={styles.copyNote}>{copyNote.failure ? failureText(copyNote.failure, t) : t(copyKeys.emptyDay)}</Text>
              ) : null}
            </>
          ) : null}
          {day.day.meals.map((view) => {
            const inMeal = day.day.entries.filter((e) => e.meal === view.meal);
            const mealName = t(`meal.${view.meal}`);
            // Nothing logged yet: the meal is one row (name, copy, add), so the page stays short.
            if (inMeal.length === 0) {
              return (
                <Card key={view.meal}>
                  <View style={styles.emptyMeal}>
                    <View style={styles.mealName}>
                      <Title size="subtitle" numberOfLines={1}>
                        {mealName}
                      </Title>
                      <Kicker color={tokens.color.textTertiary}>{kicker(`meal.${view.meal}`)}</Kicker>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: applying }}
                      disabled={applying}
                      hitSlop={tokens.space.sm}
                      onPress={() => copyYesterday(view.meal)}
                      style={({ pressed }) => [styles.copyMeal, (pressed || applying) && styles.pressed]}
                    >
                      <Text style={styles.copyMealText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {t(copyKeys.meal, { meal: mealName })}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('diary.addTo', { meal: mealName })}
                      onPress={() => addTo(view.meal)}
                      style={({ pressed }) => [styles.addRound, pressed && styles.addRoundPressed]}
                    >
                      <Ionicons name="add" size={tokens.fontSize.title + tokens.hairline} color={tokens.color.onPrimary} />
                    </Pressable>
                  </View>
                  {copyNote?.target === view.meal ? (
                    <Text style={styles.copyNote}>
                      {copyNote.failure ? failureText(copyNote.failure, t) : t(copyKeys.emptyMeal, { meal: mealName })}
                    </Text>
                  ) : null}
                </Card>
              );
            }
            return (
            <Card key={view.meal}>
              <CardHeader
                strong
                label={mealName}
                kicker={kicker(`meal.${view.meal}`)}
                right={<Text style={[type.num, styles.subtotal]}>{t('report.kcal', { n: view.totals.kcal })}</Text>}
              />
              <MealPlate
                entries={inMeal}
                onOpenEntry={(entry) => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}
              />
              {/* One row: adding is the main action, "save as my meal" stays small beside it. */}
              <View style={styles.mealActions}>
                <View style={styles.mealAdd}>
                  <SoftButton
                    dashed
                    title={`+ ${t('diary.add')}`}
                    accessibilityLabel={t('diary.addTo', { meal: mealName })}
                    onPress={() => addTo(view.meal)}
                  />
                </View>
                <TextButton
                  tone="quiet"
                  title={t('templates.save')}
                  accessibilityLabel={t('templates.saveLabel', { meal: mealName })}
                  onPress={() => router.push({ pathname: '/food/save-meal', params: { date, meal: view.meal } })}
                />
              </View>
            </Card>
            );
          })}
          {/* The whole day at once, at the end: meals are not compared one by one. */}
          {feedback ? (
            <Card>
              <DayFeedback
                feedback={feedback}
                onApply={(suggestion) => apply(feedback.meal, suggestion)}
                applying={applying}
              />
              {applyError ? <ErrorText message={failureText(applyError, t)} /> : null}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/**
 * Eaten vs target, read top to bottom: the kcal in the middle of the rings, then, under a tear
 * line, a tile per macro.
 */
function Summary({ day }: { day: DiaryDay }) {
  const { t } = useLocale();
  const { totals, target } = day;
  const unit = target ? t('diary.ofTarget', { n: target.kcal }) : t('diary.kcalUnit');

  return (
    <Card>
      {target ? (
        <>
          <View style={styles.summaryHead}>
            <Text style={styles.eatenChip}>{t('diary.eaten')}</Text>
          </View>
          <ActivityRings
            accessibilityLabel={`${t('diary.eaten')} ${totals.kcal} ${unit}`}
            rings={[
              { progress: progress(totals.kcal, target.kcal), color: tokens.color.kcal, track: tokens.color.kcalTrack },
              ...MACROS.map(({ field, color, track }) => ({ progress: progress(totals[field], target[field]), color, track })),
            ]}
          >
            <Text style={[type.num, styles.ringValue]} numberOfLines={1} adjustsFontSizeToFit>
              {totals.kcal}
            </Text>
            <Text style={[type.num, styles.ringUnit]} numberOfLines={1} adjustsFontSizeToFit>
              {unit}
            </Text>
          </ActivityRings>
          {/* Out to the card's edges, so the notches cut into them. */}
          <View style={styles.tear}>
            <Perforation color={tokens.color.borderStrong} notch={tokens.color.background} />
          </View>
          <MacroTiles targets={target} eaten={totals} />
        </>
      ) : (
        <>
          <CardHeader label={t('diary.eaten')} title={String(totals.kcal)} unit={unit} />
          <Tile>
            <Text style={styles.muted}>{t('diary.noTarget')}</Text>
          </Tile>
        </>
      )}
      {day.unknown.length > 0 ? <Text style={[styles.muted, styles.note]}>{t('diary.unknown')}</Text> : null}
    </Card>
  );
}

/** Width of the free middle of the rings (see `ActivityRings`: 248 wide, four rings of 14 + 4). */
const RING_CENTER = 100;

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
    fontSize: tokens.fontSize.caption,
    fontVariant: TABULAR,
  },
  summaryHead: {
    flexDirection: 'row',
    paddingHorizontal: tokens.card.headerInset,
    paddingTop: tokens.space.sm,
  },
  eatenChip: {
    paddingHorizontal: tokens.space.sm + tokens.hairline,
    paddingVertical: tokens.space.xs,
    overflow: 'hidden',
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.primary,
    color: tokens.color.onPrimary,
    fontSize: tokens.fontSize.caption - 1,
    fontWeight: tokens.fontWeight.heavy,
  },
  // Both lines stay inside the innermost ring.
  ringValue: {
    width: RING_CENTER,
    textAlign: 'center',
    color: tokens.color.text,
    fontSize: tokens.fontSize.display + tokens.space.xs,
  },
  ringUnit: {
    width: RING_CENTER,
    textAlign: 'center',
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption - 1,
  },
  tear: {
    marginHorizontal: -tokens.card.padding,
    marginBottom: tokens.space.md - tokens.card.gap,
  },
  emptyMeal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingLeft: tokens.card.headerInset,
    paddingVertical: tokens.space.xs,
  },
  mealActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  mealAdd: {
    flex: 1,
  },
  mealName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  copyMeal: {
    flexShrink: 1,
    minHeight: tokens.touchTarget,
    justifyContent: 'center',
  },
  // White, not yellow: the round "+" beside it is this row's main action.
  copyMealText: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
  addRound: {
    width: tokens.touchTarget,
    height: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.touchTarget / 2,
    backgroundColor: tokens.color.primary,
  },
  addRoundPressed: {
    backgroundColor: tokens.color.primaryPressed,
  },
  pressed: {
    opacity: 0.6,
  },
  // Neutral, not a red warning (requirements §3.3).
  copyNote: {
    paddingHorizontal: tokens.card.headerInset,
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
  },
});
