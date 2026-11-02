import { scaleNutrients, type Nutrients } from '@fitplan/core';
import { MAX_ENTRY_GRAMS, MEALS, type Meal } from '@fitplan/validators';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { checkAmount, defaultQuantity, formatNumber, type AmountUnit, type Portion } from '../diary/amount';
import { useLocale, type MessageKey } from '../i18n';
import { tokens } from '../theme/tokens';
import { ErrorText, TextField } from './form';
import { SegmentedControl } from './segmented-control';

export interface AmountState {
  unit: AmountUnit;
  quantity: string;
  meal: Meal;
}

/** Starting state: the first portion when the food has one (that is how people think), else 100 g. */
export function initialAmount(portions: readonly Portion[], meal: Meal): AmountState {
  const first = portions[0];
  const unit: AmountUnit = first ? { kind: 'portion', portion: first } : { kind: 'grams' };
  return { unit, quantity: defaultQuantity(unit), meal };
}

const MACROS = [
  { key: 'proteinG', label: 'macro.protein', color: tokens.color.protein },
  { key: 'carbsG', label: 'macro.carbs', color: tokens.color.carbs },
  { key: 'fatG', label: 'macro.fat', color: tokens.color.fat },
] as const satisfies readonly { key: keyof Nutrients; label: MessageKey; color: string }[];

type Props = {
  per100g: Nutrients;
  portions: readonly Portion[];
  value: AmountState;
  onChange: (value: AmountState) => void;
};

/** Portion chips, quantity, live nutrition for the amount, and the meal. Shared by "add" and "edit entry". */
export function AmountForm({ per100g, portions, value, onChange }: Props) {
  const { t } = useLocale();
  const check = checkAmount(value.unit, value.quantity);
  const eaten = check.ok ? scaleNutrients(per100g, check.grams) : null;
  const portionText = (p: Portion) => t('food.portionWithGrams', { label: p.label ?? t('food.serving'), grams: formatNumber(p.grams) });

  function pickUnit(unit: AmountUnit) {
    onChange({ ...value, unit, quantity: defaultQuantity(unit) });
  }

  return (
    <View style={styles.container}>
      <View style={styles.group}>
        <Text style={styles.label}>{t('food.unit.label')}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('food.unit.label')} style={styles.chips}>
          <Chip
            label={t('food.unit.grams')}
            selected={value.unit.kind === 'grams'}
            onPress={() => pickUnit({ kind: 'grams' })}
          />
          {portions.map((portion) => (
            <Chip
              key={portion.id}
              label={portionText(portion)}
              selected={value.unit.kind === 'portion' && value.unit.portion.id === portion.id}
              onPress={() => pickUnit({ kind: 'portion', portion })}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <TextField
          label={t(value.unit.kind === 'grams' ? 'food.quantity.grams' : 'food.quantity.portions')}
          value={value.quantity}
          onChangeText={(quantity) => onChange({ ...value, quantity })}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        {check.ok ? (
          value.unit.kind === 'portion' ? (
            <Text style={styles.hint}>{t('food.amountGrams', { n: formatNumber(check.grams) })}</Text>
          ) : null
        ) : (
          <ErrorText
            message={check.error === 'tooBig' ? t('food.quantity.tooBig', { max: MAX_ENTRY_GRAMS }) : t('food.quantity.invalid')}
          />
        )}
      </View>

      <View style={styles.nutrients} accessible accessibilityLabel={eaten ? nutrientsLabel(eaten, t) : undefined}>
        <Text style={styles.label}>{t('food.nutrients.title')}</Text>
        <Text style={styles.kcal}>
          {eaten?.kcal != null ? t('report.kcal', { n: Math.round(eaten.kcal) }) : t('food.unknown')}
        </Text>
        <View style={styles.macros}>
          {MACROS.map(({ key, label, color }) => (
            <View key={key} style={styles.macro}>
              <View style={[styles.swatch, { backgroundColor: color }]} />
              <Text style={styles.macroValue}>{gramsText(eaten?.[key] ?? null, t)}</Text>
              <Text style={styles.macroLabel}>{t(label)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{t('food.meal.label')}</Text>
        <SegmentedControl
          label={t('food.meal.label')}
          value={value.meal}
          options={MEALS.map((meal) => ({ value: meal, label: t(`meal.${meal}`) }))}
          onChange={(meal) => onChange({ ...value, meal })}
        />
      </View>
    </View>
  );
}

type T = ReturnType<typeof useLocale>['t'];

function gramsText(value: number | null, t: T): string {
  return value === null ? t('food.unknown') : t('common.grams', { n: formatNumber(value) });
}

function nutrientsLabel(n: Nutrients, t: T): string {
  const kcal = n.kcal === null ? t('food.unknown') : t('report.kcal', { n: Math.round(n.kcal) });
  return [kcal, ...MACROS.map(({ key, label }) => `${t(label)} ${gramsText(n[key], t)}`)].join(', ');
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.space.lg,
  },
  group: {
    gap: tokens.space.sm,
  },
  label: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.semibold,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
  },
  chip: {
    minHeight: tokens.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  chipSelected: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primarySoft,
  },
  chipText: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
  chipTextSelected: {
    color: tokens.color.primary,
    fontWeight: tokens.fontWeight.semibold,
  },
  hint: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  nutrients: {
    gap: tokens.space.sm,
    padding: tokens.space.lg,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
  },
  kcal: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.bold,
  },
  macros: {
    flexDirection: 'row',
    gap: tokens.space.sm,
  },
  macro: {
    flex: 1,
    gap: tokens.space.xs,
  },
  swatch: {
    width: tokens.space.xl,
    height: tokens.space.xs,
    borderRadius: tokens.radius.pill,
  },
  macroValue: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.bold,
  },
  macroLabel: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
});
