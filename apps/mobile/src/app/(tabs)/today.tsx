import type { Meal } from '@fitplan/validators';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { ActivityRings } from '../../components/activity-rings';
import { Card, CardHeader, Tile } from '../../components/card';
import { DateSwitcher } from '../../components/date-switcher';
import { ErrorText, PrimaryButton, SoftButton } from '../../components/form';
import { ListRow } from '../../components/list-row';
import { MACROS, MacroTiles } from '../../components/macro-tiles';
import { Screen } from '../../components/screen';
import { formatNumber } from '../../diary/amount';
import type { DiaryDay, DiaryEntry } from '../../diary/api-types';
import { localDate } from '../../diary/dates';
import { displayName, entryAmount, groupByMeal, progress } from '../../diary/display';
import { rememberEntries } from '../../diary/entry-store';
import { useLocale } from '../../i18n';
import { api } from '../../lib/api';
import { signOutIfUnauthorized } from '../../lib/unauthorized';
import { tokens } from '../../theme/tokens';

type DayState = { state: 'loading' } | { state: 'error' } | { state: 'ready'; day: DiaryDay };

/**
 * Today tab: the food diary for one day (today by default; ‹ › moves between days, never past
 * today), its totals against the latest daily target, and the four meals with their entries.
 * Profile, settings and "Edit my answers" live on the Me tab.
 */
export default function Today() {
  const { t, locale } = useLocale();
  const [today, setToday] = useState(() => localDate(new Date()));
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<DayState>({ state: 'loading' });
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

  // Reload on focus (an entry may have been added or changed) and pick up a new calendar day.
  useFocusEffect(
    useCallback(() => {
      setToday(localDate(new Date()));
      void load(date);
    }, [load, date]),
  );

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
            <ErrorText message={t('today.loadError')} />
          </Tile>
          <PrimaryButton title={t('gate.error.retry')} onPress={() => void load(date)} />
        </Card>
      ) : (
        <>
          <Summary day={day.day} />
          {groupByMeal(day.day.entries).map((group) => (
            <Card key={group.meal}>
              <CardHeader
                strong
                label={t(`meal.${group.meal}`)}
                right={
                  group.entries.length > 0 ? (
                    <Text style={styles.subtotal}>{t('report.kcal', { n: group.subtotal.totals.kcal })}</Text>
                  ) : undefined
                }
              />
              {group.entries.length === 0 ? (
                <Tile>
                  <Text style={styles.muted}>{t('diary.empty')}</Text>
                </Tile>
              ) : null}
              {group.entries.map((entry) => (
                <ListRow
                  key={entry.id}
                  title={displayName(entry, locale)}
                  subtitle={amountText(entry, t)}
                  value={entry.nutrients.kcal === null ? t('food.unknown') : t('report.kcal', { n: Math.round(entry.nutrients.kcal) })}
                  onPress={() => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}
                />
              ))}
              <SoftButton
                title={`+ ${t('diary.add')}`}
                accessibilityLabel={t('diary.addTo', { meal: t(`meal.${group.meal}`) })}
                onPress={() => addTo(group.meal)}
              />
            </Card>
          ))}
        </>
      )}
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
  },
  left: {
    alignSelf: 'flex-start',
    marginHorizontal: tokens.card.headerInset,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: tokens.hairline,
    overflow: 'hidden',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primarySoft,
    color: tokens.color.primary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.medium,
  },
  over: {
    backgroundColor: tokens.color.dangerSoft,
    color: tokens.color.danger,
  },
});
