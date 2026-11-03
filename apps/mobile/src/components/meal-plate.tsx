import type { PlateSlot } from '@fitplan/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DiaryEntry } from '../diary/api-types';
import { displayName } from '../diary/display';
import { feedbackLines, groupBySlot, suggestionText, type MealView, type SuggestionView } from '../diary/plate-view';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';

export const SLOT_COLORS: Record<PlateSlot, string> = {
  protein: tokens.color.protein,
  staple: tokens.color.carbs,
  vegetable: tokens.color.vegetable,
  other: tokens.color.otherFood,
};

type Props = {
  view: MealView;
  /** This meal's entries (logging order). */
  entries: readonly DiaryEntry[];
  onOpenEntry: (entry: DiaryEntry) => void;
  onApply: (suggestion: SuggestionView) => void;
  /** Suggestions are disabled while one is being applied. */
  applying: boolean;
};

/**
 * One meal as a four-cell plate (protein, staple, vegetable, other), then the gap feedback and
 * up to three one-tap adjustments (requirements §3.3). Feedback shows once something is logged.
 */
export function MealPlate({ view, entries, onOpenEntry, onApply, applying }: Props) {
  const { t, locale } = useLocale();
  const name = (item: { name: string; nameZh: string | null }) => displayName(item, locale);
  const lines = feedbackLines(view, t);

  return (
    <>
      <View style={styles.grid}>
        {groupBySlot(entries).map(({ slot, entries: inSlot }) => (
          <View key={slot} style={styles.cell}>
            <View style={styles.cellHeader}>
              <View style={[styles.swatch, { backgroundColor: SLOT_COLORS[slot] }]} />
              <Text style={styles.cellTitle}>{t(`plate.slot.${slot}`)}</Text>
            </View>
            {inSlot.length === 0 ? <Text style={styles.empty}>{t('plate.slotEmpty')}</Text> : null}
            {inSlot.map((entry) => {
              const kcal = entry.nutrients.kcal === null ? t('food.unknown') : t('report.kcal', { n: Math.round(entry.nutrients.kcal) });
              return (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${name(entry)}, ${kcal}`}
                  onPress={() => onOpenEntry(entry)}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                >
                  <Text style={styles.itemName} numberOfLines={1}>
                    {name(entry)}
                  </Text>
                  <Text style={styles.itemKcal}>{kcal}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {lines.length > 0 ? (
        <View style={styles.feedback} accessible accessibilityLiveRegion="polite">
          {lines.map((line) => (
            <Text key={line} style={styles.feedbackLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {view.suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          <Text style={styles.suggestTitle}>{t('suggest.title')}</Text>
          {view.suggestions.map((s) => {
            const { action, effect } = suggestionText(s, name, t);
            return (
              <View key={s.kind === 'add' ? `add-${s.foodId}` : `reduce-${s.entryId}`} style={styles.suggestion}>
                <View style={styles.suggestionTexts}>
                  <Text style={styles.suggestionAction}>{action}</Text>
                  <Text style={styles.suggestionEffect}>{effect}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('suggest.applyLabel', { text: action })}
                  accessibilityState={{ disabled: applying }}
                  disabled={applying}
                  onPress={() => onApply(s)}
                  style={({ pressed }) => [styles.apply, (pressed || applying) && styles.applyPressed]}
                >
                  <Text style={styles.applyText}>{t('suggest.apply')}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </>
  );
}

const SWATCH = 10;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.card.gap,
  },
  cell: {
    // Two cells per row: half the width minus half the gap.
    flexBasis: '48%',
    flexGrow: 1,
    gap: tokens.space.xs,
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.card.tilePaddingY,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  cellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: tokens.hairline,
  },
  cellTitle: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.medium,
  },
  empty: {
    color: tokens.color.textTertiary,
    fontSize: tokens.fontSize.caption,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.space.xs,
    paddingVertical: tokens.hairline,
  },
  itemPressed: {
    opacity: 0.6,
  },
  itemName: {
    flex: 1,
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
  },
  itemKcal: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  feedback: {
    gap: tokens.hairline,
    paddingHorizontal: tokens.card.headerInset,
    paddingVertical: tokens.space.xs,
  },
  feedbackLine: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.label,
  },
  suggestions: {
    gap: tokens.card.gap,
  },
  suggestTitle: {
    paddingHorizontal: tokens.card.headerInset,
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.semibold,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.card.tilePaddingY,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  suggestionTexts: {
    flex: 1,
    gap: tokens.hairline,
  },
  suggestionAction: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
  },
  suggestionEffect: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
  apply: {
    minHeight: tokens.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.primarySoft,
  },
  applyPressed: {
    opacity: 0.6,
  },
  applyText: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.semibold,
  },
});
