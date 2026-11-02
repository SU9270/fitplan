import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { AmountForm, type AmountState } from '../../components/amount-form';
import { ErrorText, PrimaryButton, TextButton } from '../../components/form';
import { Screen } from '../../components/screen';
import { ScreenHeader } from '../../components/screen-header';
import { amountFromEntry, checkAmount, type Portion } from '../../diary/amount';
import { displayName, per100gOf } from '../../diary/display';
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

  function save() {
    if (!entry || !checked.ok) return;
    const entryId = entry.id;
    void runExclusive(async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.api.diary.entries[':id'].$patch(
          withJson({ id: entryId }, { meal, portionId: checked.portionId, quantity: checked.quantity }),
        );
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
      <ScreenHeader title={displayName(entry, locale)} subtitle={t('entry.title')} />
      <AmountForm per100g={per100gOf(entry.nutrients, entry.grams)} portions={portions} value={amount} onChange={setAmount} />
      <Text style={styles.muted}>{t('entry.snapshotNote')}</Text>
      <ErrorText message={error && t(error)} />
      <PrimaryButton title={t('common.save')} onPress={save} busy={busy} disabled={!checked.ok} />
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
