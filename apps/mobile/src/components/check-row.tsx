import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** Checkbox with a wrapping label (health screening answers, consent). */
export function CheckRow({ label, checked, onChange }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={[styles.row, checked && styles.rowChecked]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={BOX - tokens.space.sm} color={tokens.color.onPrimary} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const BOX = 24;

const styles = StyleSheet.create({
  row: {
    minHeight: tokens.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.card.padding + tokens.card.headerInset,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.color.cardBorder,
    backgroundColor: tokens.color.card,
  },
  rowChecked: {
    borderColor: tokens.color.primary,
  },
  box: {
    width: BOX,
    height: BOX,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.sm,
    borderWidth: 1.5,
    borderColor: tokens.color.borderStrong,
    backgroundColor: tokens.color.field,
  },
  boxChecked: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primary,
  },
  label: {
    flex: 1,
    color: tokens.color.text,
    fontSize: tokens.fontSize.label + 1,
    lineHeight: (tokens.fontSize.label + 1) * 1.4,
  },
});
