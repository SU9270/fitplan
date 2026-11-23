import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';
import { type } from './display';

/** Segmented progress bar for the questionnaire ("第 2 / 4 步"). */
export function StepProgress({ step, total }: { step: number; total: number }) {
  const { t } = useLocale();
  const label = t('onboarding.step', { step, total });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={styles.container}
    >
      <Text style={[type.num, styles.label]}>{label}</Text>
      <View style={styles.bar}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.segment, i < step && styles.segmentDone]} />
        ))}
      </View>
    </View>
  );
}

const SEGMENT_HEIGHT = 6;

const styles = StyleSheet.create({
  container: {
    gap: tokens.space.sm,
  },
  label: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  bar: {
    flexDirection: 'row',
    gap: tokens.space.xs,
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.surfaceRaised,
  },
  segmentDone: {
    backgroundColor: tokens.color.primary,
  },
});
