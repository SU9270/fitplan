import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AmountForm, initialAmount, type AmountState } from '../../components/amount-form';
import { Card, CardHeader } from '../../components/card';
import { ErrorText, PrimaryButton, TextButton } from '../../components/form';
import { InfoRow } from '../../components/info-row';
import { SLOT_COLORS } from '../../components/meal-plate';
import { Screen } from '../../components/screen';
import { ScreenHeader } from '../../components/screen-header';
import { checkAmount, formatNumber } from '../../diary/amount';
import type { FoodDetail } from '../../diary/api-types';
import { localDate } from '../../diary/dates';
import { displayName } from '../../diary/display';
import { dateParam, mealParam, stringParam } from '../../diary/route-params';
import { useLocale, type MessageKey } from '../../i18n';
import { LIBRARY_IMAGES } from '../../library/images';
import { api } from '../../lib/api';
import { call, failureText, type Failure } from '../../lib/request';
import { createInFlightGuard } from '../../onboarding/in-flight';
import { tokens } from '../../theme/tokens';

type FoodState = { state: 'loading' } | { state: 'error'; failure: Failure | null } | { state: 'ready'; food: FoodDetail };

/**
 * One food: pick an amount and a meal and add it to the diary, or star it for the food library's
 * "我的" group. Custom foods can be edited or deleted here.
 */
export default function FoodScreen() {
  const { t, locale } = useLocale();
  const params = useLocalSearchParams<{ id?: string; date?: string; meal?: string }>();
  const id = stringParam(params.id);
  const date = dateParam(params.date, localDate(new Date()));
  const [food, setFood] = useState<FoodState>({ state: 'loading' });
  const [amount, setAmount] = useState<AmountState | null>(null);
  const [favorite, setFavorite] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [runExclusive] = useState(createInFlightGuard);

  const load = useCallback(async () => {
    if (id === null) {
      setFood({ state: 'error', failure: null });
      return;
    }
    setFood((current) => (current.state === 'ready' ? current : { state: 'loading' }));
    const out = await call('food.loadError', () => api.api.foods[':id'].$get({ param: { id } }));
    if (out.kind === 'signedOut') return;
    if (out.kind === 'failed') {
      setFood({ state: 'error', failure: out.failure });
      return;
    }
    const body = await out.res.json();
    setFood({ state: 'ready', food: body.food });
    // Keep what the user already picked when coming back from editing the food.
    setAmount((current) => current ?? initialAmount(body.food.portions, mealParam(params.meal)));
    setFavorite((current) => current ?? body.food.favorite);
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
    const failure = food.state === 'error' ? food.failure : null;
    const gone = failure === null || failure.problem === 'notFound';
    return (
      <Screen>
        <ScreenHeader title="" />
        <ErrorText message={gone ? t('food.notFound') : failureText(failure, t)} />
        {!gone ? (
          <PrimaryButton title={t('gate.error.retry')} onPress={() => void load()} />
        ) : null}
      </Screen>
    );
  }

  const detail = food.food;
  const starred = favorite ?? detail.favorite;
  const meal = amount.meal;
  const checked = checkAmount(amount.unit, amount.quantity);

  function add() {
    if (!checked.ok) return;
    void runExclusive(async () => {
      setBusy(true);
      setError(null);
      const out = await call('food.saveError', () =>
        api.api.diary.entries.$post({
          json: { date, meal, foodId: detail.id, portionId: checked.portionId, quantity: checked.quantity },
        }),
      );
      setBusy(false);
      if (out.kind === 'failed') setError(out.failure);
      // Back to Today (search → food → Today), which reloads the diary on focus.
      if (out.kind === 'ok') router.dismissTo('/today');
    });
  }

  function toggleFavorite() {
    const next = !starred;
    void runExclusive(async () => {
      // Flip at once; the server call only confirms it.
      setFavorite(next);
      setError(null);
      const out = await call('favorite.error', () =>
        next
          ? api.api.foods[':id'].favorite.$put({ param: { id: detail.id } })
          : api.api.foods[':id'].favorite.$delete({ param: { id: detail.id } }),
      );
      if (out.kind === 'failed') {
        setFavorite(!next);
        setError(out.failure);
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
    const out = await call('common.deleteError', () => api.api.foods[':id'].$delete({ param: { id: detail.id } }));
    if (out.kind === 'signedOut') return;
    // Already gone counts as deleted.
    if (out.kind === 'failed' && out.failure.problem !== 'notFound') {
      setError(out.failure);
      return;
    }
    router.back();
  }

  const isCustom = detail.source === 'custom';
  const image = detail.libraryKey === null ? undefined : LIBRARY_IMAGES[detail.libraryKey];
  return (
    <Screen>
      <ScreenHeader
        title={displayName(detail, locale)}
        subtitle={locale === 'zh' && detail.nameZh ? detail.name : undefined}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: starred }}
            onPress={toggleFavorite}
            style={({ pressed }) => [styles.favorite, starred && styles.favoriteOn, pressed && styles.pressed]}
          >
            <Ionicons
              name={starred ? 'star' : 'star-outline'}
              size={tokens.fontSize.body}
              color={starred ? tokens.color.onPrimary : tokens.color.text}
            />
            <Text style={[styles.favoriteText, starred && styles.favoriteTextOn]}>{t(starred ? 'favorite.remove' : 'favorite.add')}</Text>
          </Pressable>
        }
        hero={
          image ? (
            // Yellow banner: the picture on a white plate and the plate cell it counts as.
            <View style={styles.hero}>
              <View style={styles.plate}>
                <Image source={image} style={styles.image} resizeMode="contain" accessible={false} />
              </View>
              <Text style={styles.slotChip}>{t('plate.slotOf', { slot: t(`plate.slot.${detail.slot}`) })}</Text>
            </View>
          ) : undefined
        }
      />
      {image ? null : (
        <View style={styles.slot}>
          <View style={[styles.swatch, { backgroundColor: SLOT_COLORS[detail.slot] }]} />
          <Text style={styles.muted}>{t('plate.slotOf', { slot: t(`plate.slot.${detail.slot}`) })}</Text>
        </View>
      )}

      <AmountForm per100g={detail.per100g} portions={detail.portions} value={amount} onChange={setAmount} />

      {!isCustom ? <Per100gExtras food={detail} /> : null}
      <Text style={styles.muted}>{t(`food.source.${detail.source}`)}</Text>

      <ErrorText message={error && failureText(error, t)} />
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
          <TextButton tone="quiet" title={t('food.delete')} onPress={confirmDelete} />
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
      <CardHeader label={t('food.per100g.title')} />
      {rows.map(([label, value]) => (
        <InfoRow key={label} label={t(label)} value={value} />
      ))}
    </Card>
  );
}

/** Same as the plate cells' squares. */
const SWATCH = 8;

/** The banner, and the round white plate with the food library picture on it. */
const HERO_HEIGHT = 220;
const PLATE_SIZE = 176;

const styles = StyleSheet.create({
  hero: {
    height: HERO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.primary,
  },
  plate: {
    width: PLATE_SIZE,
    height: PLATE_SIZE,
    overflow: 'hidden',
    borderRadius: PLATE_SIZE / 2,
    backgroundColor: tokens.color.paperTile,
  },
  image: {
    width: PLATE_SIZE,
    height: PLATE_SIZE,
  },
  // Same inset from the banner's top and left edges as a card's text.
  slotChip: {
    position: 'absolute',
    top: tokens.space.lg,
    left: tokens.space.lg,
    paddingHorizontal: tokens.space.sm + tokens.hairline,
    paddingVertical: tokens.space.xs,
    overflow: 'hidden',
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.onPrimary,
    color: tokens.color.primary,
    fontSize: tokens.fontSize.caption - 1,
    fontWeight: tokens.fontWeight.heavy,
  },
  muted: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  actions: {
    gap: tokens.space.xs,
  },
  favorite: {
    minHeight: tokens.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs + tokens.hairline,
    paddingHorizontal: tokens.space.lg,
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
  },
  favoriteOn: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primary,
  },
  favoriteText: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.bold,
  },
  favoriteTextOn: {
    color: tokens.color.onPrimary,
  },
  pressed: {
    opacity: 0.6,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: tokens.hairline,
  },
});
