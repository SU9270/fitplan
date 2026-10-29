import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '../theme/tokens';

export function Card({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warning' }) {
  return <View style={[styles.card, tone === 'warning' && styles.warning]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.space.md,
    padding: tokens.space.lg,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
  },
  warning: {
    borderWidth: 1.5,
    borderColor: tokens.color.carbs,
  },
});
