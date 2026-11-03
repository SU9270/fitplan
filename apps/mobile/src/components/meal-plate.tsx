import type { PlateSlot } from '@fitplan/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DiaryEntry } from '../diary/api-types';
import { entryName } from '../diary/efficiency';
import { feedbackItems, splitPlate, suggestionText, type FeedbackTone, type MealView, type SuggestionView } from '../diary/plate-view';
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

/** Dot color per feedback tone: blue for what is still missing, neutral otherwise (no red, §3.3). */
const TONE_COLORS: Record<FeedbackTone, string> = {
  short: tokens.color.primary,
  over: tokens.color.textTertiary,
  met: tokens.color.kcal,
  hint: tokens.color.vegetable,
};

/**
 * One meal as a plate (protein, staple, vegetable, other): the cells with food, then one line
 * naming the empty cells; then the gap feedback as tags and up to three one-tap adjustments
 * in one block (requirements §3.3). Feedback shows once something is logged.
 */
export function MealPlate({ view, entries, onOpenEntry, onApply, applying }: Props) {
  const { t, locale } = useLocale();
  const name = (item: { name: string; nameZh: string | null; quick?: boolean }) => entryName(item, locale, t);
  const items = feedbackItems(view, t);
  const { filled, missing } = splitPlate(entries);

  return (
    <>
      {filled.length > 0 ? (
        <View style={styles.grid}>
          {filled.map(({ slot, entries: inSlot }) => (
            <View key={slot} style={styles.cell}>
              <View style={styles.cellHeader}>
                <View style={[styles.swatch, { backgroundColor: SLOT_COLORS[slot] }]} />
                <Text style={styles.cellTitle}>{t(`plate.slot.${slot}`)}</Text>
              </View>
              {inSlot.map((entry) => {
                const kcal =
                  entry.nutrients.kcal === null ? t('food.unknown') : t('report.kcal', { n: Math.round(entry.nutrients.kcal) });
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
      ) : null}

      {filled.length === 0 ? (
        <View style={styles.missing}>
          <Text style={styles.missingLabel}>{t('plate.nothingYet')}</Text>
        </View>
      ) : missing.length > 0 ? (
        <View
          style={styles.missing}
          accessible
          accessibilityLabel={`${t('plate.missing')}${missing.map((slot) => t(`plate.slot.${slot}`)).join(t('list.separator'))}`}
        >
          <Text style={styles.missingLabel}>{t('plate.missing')}</Text>
          {missing.map((slot) => (
            <View key={slot} style={styles.missingSlot}>
              <View style={[styles.swatch, { backgroundColor: SLOT_COLORS[slot] }]} />
              <Text style={styles.missingLabel}>{t(`plate.slot.${slot}`)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {items.length > 0 || view.suggestions.length > 0 ? (
        <View style={styles.feedback}>
          {items.length > 0 ? (
            <View style={styles.tags} accessible accessibilityLiveRegion="polite">
              {items.map((item) => (
                <View key={item.text} style={styles.tag}>
                  <View style={[styles.dot, { backgroundColor: TONE_COLORS[item.tone] }]} />
                  <Text style={[styles.tagText, (item.tone === 'met' || item.tone === 'over') && styles.tagTextQuiet]}>
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {view.suggestions.length > 0 ? (
            <View style={[styles.suggestions, items.length > 0 && styles.divided]}>
              <Text style={styles.suggestTitle}>{t('suggest.title')}</Text>
              {view.suggestions.map((s) => {
                const { action, effect } = suggestionText(s, name, t);
                return (
                  <View key={s.kind === 'add' ? `add-${s.foodId}` : `adjust-${s.entryId}`} style={styles.suggestion}>
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
        </View>
      ) : null}
    </>
  );
}

const SWATCH = 10;
const DOT = 6;

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
  missing: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.space.sm,
    rowGap: tokens.space.xs,
    paddingHorizontal: tokens.card.headerInset,
  },
  missingSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
  },
  missingLabel: {
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
    gap: tokens.space.md,
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: tokens.space.xs,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.card,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  tagText: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.caption,
    fontWeight: tokens.fontWeight.medium,
  },
  tagTextQuiet: {
    color: tokens.color.textSecondary,
  },
  suggestions: {
    gap: tokens.space.sm,
  },
  divided: {
    paddingTop: tokens.space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.color.border,
  },
  suggestTitle: {
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.semibold,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
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
