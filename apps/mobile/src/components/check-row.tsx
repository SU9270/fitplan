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
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Text style={styles.tick}>✓</Text>}
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
    paddingVertical: tokens.space.sm,
  },
  box: {
    width: BOX,
    height: BOX,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.sm / 2,
    borderWidth: 2,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
  },
  boxChecked: {
    borderColor: tokens.color.primary,
    backgroundColor: tokens.color.primary,
  },
  tick: {
    color: tokens.color.onPrimary,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.bold,
  },
  label: {
    flex: 1,
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
  },
});
