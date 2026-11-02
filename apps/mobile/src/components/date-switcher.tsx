import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shiftDate } from '@fitplan/core';
import { dayLabel } from '../diary/dates';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';

type Props = { date: string; today: string; onChange: (date: string) => void };

/** ‹ 今天 › — previous / next day; never past today. */
export function DateSwitcher({ date, today, onChange }: Props) {
  const { t } = useLocale();
  const label = dayLabel(date, today);
  const text =
    label.kind === 'today'
      ? t('diary.today')
      : label.kind === 'yesterday'
        ? t('diary.yesterday')
        : t('diary.date', { month: label.month, day: label.day });
  const atToday = date >= today;

  return (
    <View style={styles.row}>
      <Arrow symbol="‹" label={t('diary.prevDay')} onPress={() => onChange(shiftDate(date, -1))} />
      <Text accessibilityRole="header" style={styles.label}>
        {text}
      </Text>
      <Arrow symbol="›" label={t('diary.nextDay')} disabled={atToday} onPress={() => onChange(shiftDate(date, 1))} />
    </View>
  );
}

function Arrow({ symbol, label, onPress, disabled = false }: { symbol: string; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={tokens.space.sm}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.arrowText}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.semibold,
  },
  arrow: {
    width: tokens.touchTarget,
    height: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  arrowText: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.3,
  },
});
