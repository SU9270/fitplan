import type { MacroTargets } from '@fitplan/core';
import { StyleSheet, Text, View } from 'react-native';
import { progress } from '../diary/display';
import { useLocale, type MessageKey } from '../i18n';
import { tokens } from '../theme/tokens';
import { type } from './display';

export const MACROS = [
  { field: 'proteinG', label: 'macro.protein', color: tokens.color.protein, track: tokens.color.proteinTrack },
  { field: 'carbsG', label: 'macro.carbs', color: tokens.color.carbs, track: tokens.color.carbsTrack },
  { field: 'fatG', label: 'macro.fat', color: tokens.color.fat, track: tokens.color.fatTrack },
] as const satisfies readonly { field: keyof MacroTargets; label: MessageKey; color: string; track: string }[];

type Props = {
  targets: MacroTargets;
  /** When given, each tile reads "eaten / target 克" with a progress bar (the diary) instead of the target alone. */
  eaten?: MacroTargets;
  /** paper: white tiles with dark text, for a ticket. */
  tone?: 'dark' | 'paper';
};

/** Stat tiles: a colored square, the macro's name, its grams, and (in the diary) how far along it is. */
export function MacroTiles({ targets, eaten, tone = 'dark' }: Props) {
  const { t } = useLocale();
  const paper = tone === 'paper';
  return (
    <View style={styles.row}>
      {MACROS.map(({ field, label, color, track }) => {
        const value = eaten
          ? t('diary.macroAmount', { eaten: eaten[field], target: targets[field] })
          : t('macro.grams', { n: targets[field] });
        return (
          <View key={field} accessible accessibilityLabel={`${t(label)} ${value}`} style={[styles.tile, paper && styles.tilePaper]}>
            <View style={styles.labelRow}>
              <View style={[styles.swatch, { backgroundColor: color }]} />
              <Text style={[styles.label, paper && styles.labelPaper]}>{t(label)}</Text>
            </View>
            <Text style={[type.num, styles.value, paper && styles.valuePaper]} numberOfLines={1} adjustsFontSizeToFit>
              {eaten ? (
                <>
                  {eaten[field]}
                  <Text style={styles.of}> / {t('macro.grams', { n: targets[field] })}</Text>
                </>
              ) : (
                value
              )}
            </Text>
            {eaten ? (
              <View style={[styles.bar, { backgroundColor: track }]}>
                <View style={[styles.barFill, { backgroundColor: color, width: `${progress(eaten[field], targets[field]) * 100}%` }]} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const SWATCH = 8;
const BAR = 4;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: tokens.card.gap,
  },
  tile: {
    flex: 1,
    gap: tokens.space.xs,
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.card.tilePaddingY,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  tilePaper: {
    backgroundColor: tokens.color.paperTile,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs + tokens.hairline,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: tokens.hairline,
  },
  label: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption - 1,
  },
  labelPaper: {
    color: tokens.color.onPaperSecondary,
  },
  value: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.title - 2,
  },
  valuePaper: {
    color: tokens.color.onPaper,
  },
  of: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption - 1,
  },
  bar: {
    height: BAR,
    marginTop: tokens.space.xs,
    overflow: 'hidden',
    borderRadius: BAR / 2,
  },
  barFill: {
    height: BAR,
    borderRadius: BAR / 2,
  },
});
