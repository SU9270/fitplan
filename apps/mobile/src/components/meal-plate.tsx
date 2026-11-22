import Ionicons from '@expo/vector-icons/Ionicons';
import type { PlateSlot } from '@fitplan/core';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DiaryEntry } from '../diary/api-types';
import { entryName } from '../diary/efficiency';
import { feedbackItems, feedbackSummary, splitPlate, suggestionText, type FeedbackTone, type MealView, type SuggestionView } from '../diary/plate-view';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';
import { TextButton } from './form';

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
  /** Save this meal as a template ("我的餐"). */
  onSave: () => void;
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
 * One meal, short by default: its foods in plate order (protein, staple, vegetable, other), each
 * with its cell's color dot, then one line naming what is still short. Tapping that line opens
 * the details: the gap feedback as tags with numbers, up to three one-tap adjustments
 * (requirements §3.3) and "save as my meal". Feedback shows once something is logged.
 */
export function MealPlate({ view, entries, onOpenEntry, onApply, onSave, applying }: Props) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const name = (item: { name: string; nameZh: string | null; quick?: boolean }) => entryName(item, locale, t);
  const items = feedbackItems(view, t);
  const summary = feedbackSummary(view, t);
  const { filled } = splitPlate(entries);
  if (filled.length === 0) return null;

  const toggleLabel = open ? t('plate.collapse') : t(view.suggestions.length > 0 ? 'plate.showSuggestions' : 'plate.showDetails');

  return (
    <>
      <View style={styles.foods}>
        {filled.flatMap(({ slot, entries: inSlot }) =>
          inSlot.map((entry) => {
            const kcal =
              entry.nutrients.kcal === null ? t('food.unknown') : t('report.kcal', { n: Math.round(entry.nutrients.kcal) });
            return (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                accessibilityLabel={`${t(`plate.slot.${slot}`)}, ${name(entry)}, ${kcal}`}
                onPress={() => onOpenEntry(entry)}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={[styles.swatch, { backgroundColor: SLOT_COLORS[slot] }]} />
                <Text style={styles.itemName} numberOfLines={1}>
                  {name(entry)}
                </Text>
                <Text style={styles.itemKcal}>{kcal}</Text>
              </Pressable>
            );
          }),
        )}
      </View>

      {/* No target, so no feedback to fold away: keep "save as my meal" in reach. */}
      {summary === null ? <TextButton title={t('templates.save')} onPress={onSave} /> : null}

      {summary !== null ? (
        <View style={styles.feedback}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${summary.text}, ${toggleLabel}`}
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((was) => !was)}
            style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
          >
            <View style={[styles.dot, { backgroundColor: TONE_COLORS[summary.tone] }]} />
            <Text style={[styles.summaryText, summary.tone !== 'short' && styles.quiet]} numberOfLines={1}>
              {summary.text}
            </Text>
            <Text style={styles.toggle}>{toggleLabel}</Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-forward'} size={tokens.fontSize.label} color={tokens.color.primary} />
          </Pressable>

          {open ? (
            <>
              <View style={[styles.tags, styles.divided]} accessible accessibilityLiveRegion="polite">
                {items.map((item) => (
                  <View key={item.text} style={styles.tag}>
                    <View style={[styles.dot, { backgroundColor: TONE_COLORS[item.tone] }]} />
                    <Text style={[styles.tagText, (item.tone === 'met' || item.tone === 'over') && styles.quiet]}>{item.text}</Text>
                  </View>
                ))}
              </View>

              {view.suggestions.length > 0 ? (
                <View style={[styles.suggestions, styles.divided]}>
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
                          style={({ pressed }) => [styles.apply, (pressed || applying) && styles.pressed]}
                        >
                          <Text style={styles.applyText}>{t('suggest.apply')}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.divided}>
                <TextButton title={t('templates.save')} onPress={onSave} />
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const SWATCH = 10;
const DOT = 6;

const styles = StyleSheet.create({
  foods: {
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.space.xs,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm,
    paddingVertical: tokens.space.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: tokens.hairline,
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
    paddingVertical: tokens.space.xs,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.xs,
    minHeight: tokens.touchTarget,
  },
  summaryText: {
    flex: 1,
    color: tokens.color.text,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
  },
  quiet: {
    color: tokens.color.textSecondary,
  },
  toggle: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.medium,
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
  applyText: {
    color: tokens.color.primary,
    fontSize: tokens.fontSize.label,
    fontWeight: tokens.fontWeight.semibold,
  },
});
