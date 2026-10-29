import type { GuardrailReason } from '@fitplan/core';
import { StyleSheet, Text, View } from 'react-native';
import { reasonMessageKey } from '../onboarding/reasons';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';

/** Plain-language explanation for each guardrail reason. */
export function ReasonList({ reasons }: { reasons: readonly GuardrailReason[] }) {
  const { t } = useLocale();
  if (reasons.length === 0) return null;
  return (
    <View style={styles.list}>
      {reasons.map((reason) => (
        <View key={reason} style={styles.item}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.text}>{t(reasonMessageKey[reason])}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: tokens.space.sm,
  },
  item: {
    flexDirection: 'row',
    gap: tokens.space.sm,
  },
  bullet: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.body,
  },
  text: {
    flex: 1,
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    lineHeight: tokens.fontSize.body * 1.4,
  },
});
