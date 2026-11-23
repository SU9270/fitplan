import type { GuardrailReason } from '@fitplan/core';
import { StyleSheet, Text, View } from 'react-native';
import { reasonMessageKey } from '../onboarding/reasons';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';

type Props = {
  reasons: readonly GuardrailReason[];
  /** paper: dark text, for a ticket. */
  tone?: 'dark' | 'paper';
};

/** Plain-language explanation for each guardrail reason. */
export function ReasonList({ reasons, tone = 'dark' }: Props) {
  const { t } = useLocale();
  if (reasons.length === 0) return null;
  return (
    <View style={styles.list}>
      {reasons.map((reason) => (
        <View key={reason} style={styles.item}>
          <Text style={[styles.bullet, tone === 'paper' && styles.bulletPaper]}>•</Text>
          <Text style={[styles.text, tone === 'paper' && styles.textPaper]}>{t(reasonMessageKey[reason])}</Text>
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
    fontSize: tokens.fontSize.label,
    lineHeight: tokens.fontSize.label * 1.5,
  },
  text: {
    flex: 1,
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    lineHeight: tokens.fontSize.label * 1.5,
  },
  bulletPaper: {
    color: tokens.color.onPaperSecondary,
  },
  textPaper: {
    color: tokens.color.onPaper,
  },
});
