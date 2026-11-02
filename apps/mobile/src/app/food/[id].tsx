import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { AmountForm, initialAmount, type AmountState } from '../../components/amount-form';
import { Card } from '../../components/card';
import { ErrorText, PrimaryButton, TextButton } from '../../components/form';
import { Screen } from '../../components/screen';
import { ScreenHeader } from '../../components/screen-header';
import { checkAmount, formatNumber } from '../../diary/amount';
import type { FoodDetail } from '../../diary/api-types';
import { localDate } from '../../diary/dates';
import { displayName } from '../../diary/display';
import { dateParam, mealParam, stringParam } from '../../diary/route-params';
import { useLocale, type MessageKey } from '../../i18n';
import { api } from '../../lib/api';
import { signOutIfUnauthorized } from '../../lib/unauthorized';
import { createInFlightGuard } from '../../onboarding/in-flight';
import { tokens } from '../../theme/tokens';

type FoodState = { state: 'loading' } | { state: 'error'; message: MessageKey } | { state: 'ready'; food: FoodDetail };

/** One food: pick an amount and a meal and add it to the diary. Custom foods can be edited or deleted here. */
export default function FoodScreen() {
  const { t, locale } = useLocale();
  const params = useLocalSearchParams<{ id?: string; date?: string; meal?: string }>();
  const id = stringParam(params.id);
  const date = dateParam(params.date, localDate(new Date()));
  const [food, setFood] = useState<FoodState>({ state: 'loading' });
  const [amount, setAmount] = useState<AmountState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [runExclusive] = useState(createInFlightGuard);

  const load = useCallback(async () => {
    if (id === null) {
      setFood({ state: 'error', message: 'food.notFound' });
      return;
    }
    setFood((current) => (current.state === 'ready' ? current : { state: 'loading' }));
    try {
      const res = await api.api.foods[':id'].$get({ param: { id } });
      if (await signOutIfUnauthorized(res)) return;
      if (res.status === 404) {
        setFood({ state: 'error', message: 'food.notFound' });
        return;
      }
      if (!res.ok) throw new Error(`GET /api/foods/${id} → ${res.status}`);
      const body = await res.json();
      setFood({ state: 'ready', food: body.food });
      // Keep what the user already picked when coming back from editing the food.
      setAmount((current) => current ?? initialAmount(body.food.portions, mealParam(params.meal)));
    } catch {
      setFood({ state: 'error', message: 'food.loadError' });
    }
  }, [id, params.meal]);

  // Also on returning from the custom food form, so an edit shows up here.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (food.state === 'loading') {
    return (
      <Screen>
        <ScreenHeader title="" />
        <ActivityIndicator color={tokens.color.primary} accessibilityLabel={t('gate.loading')} />
      </Screen>
    );
  }
  if (food.state === 'error' || amount === null) {
    return (
      <Screen>
        <ScreenHeader title="" />
        <ErrorText message={t(food.state === 'error' ? food.message : 'food.loadError')} />
        {food.state === 'error' && food.message === 'food.loadError' ? (
          <PrimaryButton title={t('gate.error.retry')} onPress={() => void load()} />
        ) : null}
      </Screen>
    );
  }

  const detail = food.food;
  const meal = amount.meal;
  const checked = checkAmount(amount.unit, amount.quantity);

  function add() {
    if (!checked.ok) return;
    void runExclusive(async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.api.diary.entries.$post({
          json: { date, meal, foodId: detail.id, portionId: checked.portionId, quantity: checked.quantity },
        });
        if (await signOutIfUnauthorized(res)) return;
        if (!res.ok) {
          setError(res.status === 404 ? 'food.notFound' : 'food.saveError');
          return;
        }
        // Back to Today (search → food → Today), which reloads the diary on focus.
        router.dismissTo('/today');
      } catch {
        setError('food.saveError');
      } finally {
        setBusy(false);
      }
    });
  }

  function confirmDelete() {
    Alert.alert(t('food.delete.title'), t('food.delete.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void deleteFood() },
    ]);
  }

  async function deleteFood() {
    try {
      const res = await api.api.foods[':id'].$delete({ param: { id: detail.id } });
      if (await signOutIfUnauthorized(res)) return;
      if (!res.ok && res.status !== 404) {
        setError('food.saveError');
        return;
      }
      router.back();
    } catch {
      setError('food.saveError');
    }
  }

  const isCustom = detail.source === 'custom';
  return (
    <Screen>
      <ScreenHeader
        title={displayName(detail, locale)}
        subtitle={locale === 'zh' && detail.nameZh ? detail.name : undefined}
      />
      <Text style={styles.muted}>{t(isCustom ? 'food.source.custom' : 'food.source.usda')}</Text>

      <AmountForm per100g={detail.per100g} portions={detail.portions} value={amount} onChange={setAmount} />

      {!isCustom ? <Per100gExtras food={detail} /> : null}

      <ErrorText message={error && t(error)} />
      <PrimaryButton
        title={t('food.addTo', { meal: t(`meal.${meal}`) })}
        onPress={add}
        busy={busy}
        disabled={!checked.ok}
      />
      {isCustom ? (
        <View style={styles.actions}>
          <TextButton
            title={t('food.edit')}
            onPress={() => router.push({ pathname: '/food/custom', params: { id: detail.id } })}
          />
          <TextButton title={t('food.delete')} onPress={confirmDelete} />
        </View>
      ) : null}
    </Screen>
  );
}

/** Fiber, sugars and sodium per 100 g (USDA foods only; custom foods do not collect them). */
function Per100gExtras({ food }: { food: FoodDetail }) {
  const { t } = useLocale();
  const grams = (v: number | null) => (v === null ? t('food.unknown') : t('common.grams', { n: formatNumber(v) }));
  const rows: [MessageKey, string][] = [
    ['food.fiber', grams(food.fiberG)],
    ['food.sugars', grams(food.sugarsG)],
    ['food.sodium', food.sodiumMg === null ? t('food.unknown') : t('food.mg', { n: Math.round(food.sodiumMg) })],
  ];
  return (
    <Card>
      <Text style={styles.cardTitle}>{t('food.per100g.title')}</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row} accessible accessibilityLabel={`${t(label)} ${value}`}>
          <Text style={styles.rowLabel}>{t(label)}</Text>
          <Text style={styles.rowValue}>{value}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  cardTitle: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.caption,
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
  },
  actions: {
    gap: tokens.space.xs,
  },
});
