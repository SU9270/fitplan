import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import { type } from './display';

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

/** One row of equal-width single-choice chips, for short numeric choices such as 0–7 training days. */
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
            <Text style={[type.num, styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The same edge as a text input's. */
const TRACK_BORDER = 1.5;

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    padding: tokens.space.xs,
    gap: tokens.space.xs,
    borderRadius: tokens.radius.md,
    borderWidth: TRACK_BORDER,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.field,
  },
  // Border + track padding + segment = the height of an input, so a row of controls lines up.
  segment: {
    flex: 1,
    minHeight: tokens.controlHeight - 2 * (tokens.space.xs + TRACK_BORDER),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.space.sm,
    borderRadius: tokens.radius.inner - TRACK_BORDER,
  },
  // The chosen segment is a paper-white key standing out of the dark track.
  segmentSelected: {
    backgroundColor: tokens.color.paper,
    ...tokens.shadow.raised,
  },
  segmentText: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label + 1,
    fontWeight: tokens.fontWeight.medium,
    textAlign: 'center',
  },
  segmentTextSelected: {
    color: tokens.color.onPaper,
    fontWeight: tokens.fontWeight.bold,
  },
  // The chips share the row's width equally, so eight of them never leave one alone on a second line.
  chips: {
    flexDirection: 'row',
    gap: tokens.card.gap,
  },
  chip: {
    flex: 1,
    minWidth: 0,
    minHeight: tokens.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.color.cardBorder,
    backgroundColor: tokens.color.card,
  },
  chipSelected: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primary,
  },
  chipText: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
  },
  chipTextSelected: {
    color: tokens.color.onPrimary,
  },
});
