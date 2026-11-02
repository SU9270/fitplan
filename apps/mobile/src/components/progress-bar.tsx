import { StyleSheet, View } from 'react-native';
import { tokens } from '../theme/tokens';

const HEIGHT = 8;

/** Thin horizontal bar; `value` is 0..1 (see `progress` in diary/display). */
export function ProgressBar({ value, color, label }: { value: number; color: string; label: string }) {
  const percent = Math.round(value * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    overflow: 'hidden',
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.background,
  },
  fill: {
    height: HEIGHT,
    borderRadius: tokens.radius.pill,
  },
});
