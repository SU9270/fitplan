import type { MacroTargets } from '@fitplan/core';
import { StyleSheet, Text, View } from 'react-native';
import { useLocale, type MessageKey } from '../i18n';
import { tokens } from '../theme/tokens';

const MACROS = [
  { field: 'proteinG', label: 'macro.protein', color: tokens.color.protein },
  { field: 'carbsG', label: 'macro.carbs', color: tokens.color.carbs },
  { field: 'fatG', label: 'macro.fat', color: tokens.color.fat },
] as const satisfies readonly { field: keyof MacroTargets; label: MessageKey; color: string }[];

/** Protein / carbs / fat in the macro colors. */
export function MacroTiles({ targets }: { targets: MacroTargets }) {
  const { t } = useLocale();
  return (
    <View style={styles.row}>
      {MACROS.map(({ field, label, color }) => {
        const value = t('macro.grams', { n: targets[field] });
        return (
          <View key={field} accessible accessibilityLabel={`${t(label)} ${value}`} style={styles.tile}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{t(label)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: tokens.space.sm,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.space.xs,
    padding: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  swatch: {
    width: tokens.space.xl,
    height: tokens.space.xs,
    borderRadius: tokens.radius.pill,
  },
  value: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.subtitle,
    fontWeight: tokens.fontWeight.bold,
  },
  label: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
});
