import { MEALS } from '@fitplan/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { AmountForm, type AmountState } from '../../components/amount-form';
import { Card, CardHeader } from '../../components/card';
import { ErrorText, PrimaryButton, TextButton } from '../../components/form';
import { Screen } from '../../components/screen';
import { InfoRow } from '../../components/info-row';
import { ScreenHeader } from '../../components/screen-header';
import { SegmentedControl } from '../../components/segmented-control';
import { amountFromEntry, checkAmount, formatNumber, type Portion } from '../../diary/amount';
import { per100gOf } from '../../diary/display';
import { entryName } from '../../diary/efficiency';
import { rememberedEntry } from '../../diary/entry-store';
import { stringParam } from '../../diary/route-params';
import { useLocale, type MessageKey } from '../../i18n';
import { api } from '../../lib/api';
import { signOutIfUnauthorized } from '../../lib/unauthorized';
import { withJson } from '../../lib/with-json';
import { createInFlightGuard } from '../../onboarding/in-flight';
import { tokens } from '../../theme/tokens';

/**
 * Change an entry's amount or meal, or delete it. The preview uses the entry's own snapshot
 * (what the server scales), not the food's current values; the food is only read for its portions.
 * A quick add shows its numbers and can only move to another meal.
 */
export default function EntryScreen() {
  const { t, locale } = useLocale();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = stringParam(params.id);
  const [entry] = useState(() => (id === null ? undefined : rememberedEntry(id)));
  const [portions, setPortions] = useState<readonly Portion[]>([]);
  const [amount, setAmount] = useState<AmountState | null>(() =>
    entry ? { ...amountFromEntry(entry, []), meal: entry.meal } : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [runExclusive] = useState(createInFlightGuard);

  useEffect(() => {
    const foodId = entry?.foodId;
    if (!entry || !foodId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.api.foods[':id'].$get({ param: { id: foodId } });
        if (!res.ok || cancelled) return;
        const body = await res.json();
        if (cancelled) return;
        setPortions(body.food.portions);
        // Re-select the logged portion now that the food's portions are known.
        setAmount((current) => (current ? { ...amountFromEntry(entry, body.food.portions), meal: current.meal } : current));
      } catch {
        // Without the food the entry can still be edited in grams.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry]);

  if (!entry || amount === null) {
    return (
      <Screen>
        <ScreenHeader title={t('entry.title')} />
        <ErrorText message={t('entry.missing')} />
      </Screen>
    );
  }

  const checked = checkAmount(amount.unit, amount.quantity);
  const meal = amount.meal;

  /** A quick add only changes its meal; a food entry changes meal and amount. */
  const quick = entry.quick;

  function save() {
    if (!entry || (!quick && !checked.ok)) return;
    const entryId = entry.id;
    const body = quick || !checked.ok ? { meal } : { meal, portionId: checked.portionId, quantity: checked.quantity };
    void runExclusive(async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.api.diary.entries[':id'].$patch(withJson({ id: entryId }, body));
        if (await signOutIfUnauthorized(res)) return;
        if (!res.ok) {
          setError(res.status === 404 ? 'entry.missing' : 'food.saveError');
          return;
        }
        router.back();
      } catch {
        setError('food.saveError');
      } finally {
        setBusy(false);
      }
    });
  }

  function valueText(value: number | null, unit: 'kcal' | 'g'): string {
    if (value === null) return t('food.unknown');
    return unit === 'kcal' ? t('report.kcal', { n: Math.round(value) }) : t('common.grams', { n: formatNumber(value) });
  }

  function confirmDelete() {
    Alert.alert(t('entry.delete.title'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void deleteEntry() },
    ]);
  }

  async function deleteEntry() {
    if (!entry) return;
    try {
      const res = await api.api.diary.entries[':id'].$delete({ param: { id: entry.id } });
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

  return (
    <Screen>
      <ScreenHeader title={entryName(entry, locale, t)} subtitle={t('entry.title')} />
      {quick ? (
        <>
          <Card>
            <CardHeader label={t('food.nutrients.title')} />
            <InfoRow label={t('diary.kcalUnit')} value={valueText(entry.nutrients.kcal, 'kcal')} />
            <InfoRow label={t('macro.protein')} value={valueText(entry.nutrients.proteinG, 'g')} />
            <InfoRow label={t('macro.carbs')} value={valueText(entry.nutrients.carbsG, 'g')} />
            <InfoRow label={t('macro.fat')} value={valueText(entry.nutrients.fatG, 'g')} />
          </Card>
          <Card>
            <CardHeader label={t('food.meal.label')} />
            <SegmentedControl
              label={t('food.meal.label')}
              value={meal}
              options={MEALS.map((m) => ({ value: m, label: t(`meal.${m}`) }))}
              onChange={(m) => setAmount({ ...amount, meal: m })}
            />
          </Card>
          <Text style={styles.muted}>{t('quick.editNote')}</Text>
        </>
      ) : (
        <>
          <AmountForm per100g={per100gOf(entry.nutrients, entry.grams)} portions={portions} value={amount} onChange={setAmount} />
          <Text style={styles.muted}>{t('entry.snapshotNote')}</Text>
        </>
      )}
      <ErrorText message={error && t(error)} />
      <PrimaryButton title={t('common.save')} onPress={save} busy={busy} disabled={!quick && !checked.ok} />
      <TextButton title={t('entry.delete')} onPress={confirmDelete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
});
