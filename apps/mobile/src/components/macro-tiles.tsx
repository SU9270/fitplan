import type { MacroTargets } from '@fitplan/core';
import { StyleSheet, Text, View } from 'react-native';
import { useLocale, type MessageKey } from '../i18n';
import { tokens } from '../theme/tokens';

export const MACROS = [
  { field: 'proteinG', label: 'macro.protein', color: tokens.color.protein, track: tokens.color.proteinTrack },
  { field: 'carbsG', label: 'macro.carbs', color: tokens.color.carbs, track: tokens.color.carbsTrack },
  { field: 'fatG', label: 'macro.fat', color: tokens.color.fat, track: tokens.color.fatTrack },
] as const satisfies readonly { field: keyof MacroTargets; label: MessageKey; color: string; track: string }[];

type Props = {
  targets: MacroTargets;
  /** When given, each tile reads "eaten / target 克" (the diary) instead of the target alone. */
  eaten?: MacroTargets;
};

/** BoardUI stat tiles: a colored square, the macro's name, and its grams. */
export function MacroTiles({ targets, eaten }: Props) {
  const { t } = useLocale();
  return (
    <View style={styles.row}>
      {MACROS.map(({ field, label, color }) => {
        const value = eaten
          ? t('diary.macroAmount', { eaten: eaten[field], target: targets[field] })
          : t('macro.grams', { n: targets[field] });
        return (
          <View key={field} accessible accessibilityLabel={`${t(label)} ${value}`} style={styles.tile}>
            <View style={styles.labelRow}>
              <View style={[styles.swatch, { backgroundColor: color }]} />
              <Text style={styles.label}>{t(label)}</Text>
            </View>
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
              {eaten ? (
                <>
                  {eaten[field]}
                  <Text style={styles.of}> / {t('macro.grams', { n: targets[field] })}</Text>
                </>
              ) : (
                value
              )}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const SWATCH = 10;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: tokens.card.gap,
  },
  tile: {
    flex: 1,
    gap: tokens.hairline,
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.card.tilePaddingY,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: tokens.hairline,
  },
  label: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  value: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.body,
    fontWeight: tokens.fontWeight.semibold,
  },
  of: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.medium,
  },
});
