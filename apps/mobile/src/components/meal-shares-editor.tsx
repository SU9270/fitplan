import { MEALS, MEAL_SHARES_TOTAL, type MealShares } from '@fitplan/core';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shareTotal, stepShare } from '../diary/plate-view';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';
import { ErrorText, SoftButton } from './form';

type Props = {
  value: MealShares;
  /** Resolves to true when saved. */
  onSave: (shares: MealShares) => Promise<boolean>;
};

/** Me → Settings: how the daily targets are split over the meals, ±5 % per tap, total 100 %. */
export function MealSharesEditor({ value, onSave }: Props) {
  const { t } = useLocale();
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(value), [value]);

  const total = shareTotal(draft);
  const changed = MEALS.some((m) => draft[m] !== value[m]);

  async function save() {
    setBusy(true);
    setSaved(await onSave(draft));
    setBusy(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('profile.mealShares')}</Text>
      <Text style={styles.hint}>{t('profile.mealShares.hint')}</Text>
      {MEALS.map((meal) => (
        <View key={meal} style={styles.row}>
          <Text style={styles.meal}>{t(`meal.${meal}`)}</Text>
          <Step
            symbol="−"
            label={t('profile.mealShares.decrease', { meal: t(`meal.${meal}`) })}
            onPress={() => {
              setSaved(false);
              setDraft(stepShare(draft, meal, -1));
            }}
          />
          <Text style={styles.value}>{draft[meal]}%</Text>
          <Step
            symbol="+"
            label={t('profile.mealShares.increase', { meal: t(`meal.${meal}`) })}
            onPress={() => {
              setSaved(false);
              setDraft(stepShare(draft, meal, 1));
            }}
          />
        </View>
      ))}
      <Text style={[styles.total, total !== MEAL_SHARES_TOTAL && styles.totalOff]}>
        {t('profile.mealShares.total', { n: total })}
      </Text>
      {total !== MEAL_SHARES_TOTAL ? <ErrorText message={t('profile.mealShares.mustTotal')} /> : null}
      {changed ? (
        <SoftButton title={t('common.save')} onPress={() => void save()} disabled={busy || total !== MEAL_SHARES_TOTAL} />
      ) : saved ? (
        <Text style={styles.hint}>{t('profile.mealShares.saved')}</Text>
      ) : null}
    </View>
  );
}

function Step({ symbol, label, onPress }: { symbol: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed]}
    >
      <Text style={styles.stepText}>{symbol}</Text>
    </Pressable>
  );
}

const STEP = 36;

const styles = StyleSheet.create({
  container: {
    gap: tokens.space.sm,
  },
  label: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
  },
  hint: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  meal: {
    flex: 1,
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
  },
  value: {
    minWidth: tokens.touchTarget,
    textAlign: 'center',
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.semibold,
  },
  step: {
    width: STEP,
    height: STEP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  stepPressed: {
    backgroundColor: tokens.color.card,
  },
  stepText: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
  },
  total: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
    textAlign: 'right',
  },
  totalOff: {
    color: tokens.color.text,
    fontWeight: tokens.fontWeight.semibold,
  },
});
