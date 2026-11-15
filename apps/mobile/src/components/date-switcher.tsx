import Ionicons from '@expo/vector-icons/Ionicons';
import { shiftDate } from '@fitplan/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dayLabel } from '../diary/dates';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';

type Props = { date: string; today: string; onChange: (date: string) => void };

/** Round arrow buttons; `hitSlop` brings the touch area up to 44 pt. */
const ARROW_SIZE = 36;
const ARROW_HIT_SLOP = (tokens.touchTarget - ARROW_SIZE) / 2;

/**
 * The shown day as the page title, with ‹ › beside it (never past today) and "回到今天" when an
 * earlier day is shown.
 */
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
      <Text accessibilityRole="header" style={styles.label}>
        {text}
      </Text>
      <View style={styles.controls}>
        {!atToday ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={ARROW_HIT_SLOP}
            onPress={() => onChange(today)}
            style={({ pressed }) => [styles.today, pressed && styles.pressed]}
          >
            <Text style={styles.todayText}>{t('diary.backToToday')}</Text>
          </Pressable>
        ) : null}
        <Arrow icon="chevron-back" label={t('diary.prevDay')} onPress={() => onChange(shiftDate(date, -1))} />
        <Arrow icon="chevron-forward" label={t('diary.nextDay')} disabled={atToday} onPress={() => onChange(shiftDate(date, 1))} />
      </View>
    </View>
  );
}

function Arrow({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={ARROW_HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={tokens.fontSize.subtitle} color={tokens.color.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
  },
  label: {
    flexShrink: 1,
    color: tokens.color.text,
    fontSize: tokens.fontSize.title,
    fontWeight: tokens.fontWeight.semibold,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  today: {
    height: ARROW_SIZE,
    justifyContent: 'center',
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primarySoft,
  },
  todayText: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.semibold,
  },
  arrow: {
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ARROW_SIZE / 2,
    backgroundColor: tokens.color.card,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.3,
  },
});
