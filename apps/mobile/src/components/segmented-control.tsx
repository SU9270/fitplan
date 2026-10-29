import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

export type Option<T> = { value: T; label: string; accessibilityLabel?: string };

type Props<T> = {
  /** Group label, read out by screen readers (and shown by the caller if wanted). */
  label: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

/** Equal-width single-choice control, e.g. 保守 / 标准 / 积极 or the unit switch. */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Wrapping row of single-choice chips, for short numeric choices such as 0–7 training days. */
export function ChipRow<T extends number>({ label, options, value, onChange }: Props<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    padding: tokens.space.xs,
    gap: tokens.space.xs,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.border,
  },
  segment: {
    flex: 1,
    minHeight: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.sm,
  },
  segmentSelected: {
    backgroundColor: tokens.color.surface,
  },
  segmentText: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.medium,
    textAlign: 'center',
  },
  segmentTextSelected: {
    color: tokens.color.primary,
    fontWeight: tokens.fontWeight.semibold,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
  },
  chip: {
    minWidth: tokens.touchTarget,
    minHeight: tokens.touchTarget,
    alignItems: 'center',
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
});
