import Ionicons from '@expo/vector-icons/Ionicons';
import { shiftDate } from '@fitplan/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dayLabel } from '../diary/dates';
import { kicker, useLocale } from '../i18n';
import { tokens } from '../theme/tokens';
import { Kicker, Title } from './display';

type Props = { date: string; today: string; onChange: (date: string) => void };

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
      <View style={styles.texts}>
        <Kicker>{kicker('app.name') ?? t('app.name').toUpperCase()}</Kicker>
        <Title numberOfLines={1}>{text}</Title>
      </View>
      <View style={styles.controls}>
        {!atToday ? (
          <Pressable accessibilityRole="button" onPress={() => onChange(today)} style={({ pressed }) => [styles.today, pressed && styles.pressed]}>
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
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={tokens.fontSize.subtitle} color={tokens.color.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The controls sit on the title's baseline, not centered on the two-line block.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
  },
  texts: {
    flexShrink: 1,
    gap: tokens.hairline,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingBottom: tokens.hairline,
  },
  today: {
    height: tokens.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: tokens.space.lg,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primarySoft,
  },
  todayText: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.bold,
  },
  arrow: {
    width: tokens.touchTarget,
    height: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.touchTarget / 2,
    borderWidth: 1.5,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.card,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.35,
  },
});
