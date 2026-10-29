import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';

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
      <Text style={styles.label}>{label}</Text>
      <View style={styles.bar}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.segment, i < step && styles.segmentDone]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.space.xs,
  },
  label: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.medium,
  },
  bar: {
    flexDirection: 'row',
    gap: tokens.space.xs,
  },
  segment: {
    flex: 1,
    height: tokens.space.sm,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.border,
  },
  segmentDone: {
    backgroundColor: tokens.color.primary,
  },
});
