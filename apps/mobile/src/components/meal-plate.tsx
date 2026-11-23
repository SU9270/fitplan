import type { PlateSlot } from '@fitplan/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DiaryEntry } from '../diary/api-types';
import { entryName } from '../diary/efficiency';
import { splitPlate } from '../diary/plate-view';
import { useLocale } from '../i18n';
import { tokens } from '../theme/tokens';
import { type } from './display';

export const SLOT_COLORS: Record<PlateSlot, string> = {
  protein: tokens.color.protein,
  staple: tokens.color.carbs,
  vegetable: tokens.color.vegetable,
  other: tokens.color.otherFood,
};

type Props = {
  /** This meal's entries (logging order). */
  entries: readonly DiaryEntry[];
  onOpenEntry: (entry: DiaryEntry) => void;
};

/**
 * One meal's foods in plate order (protein, staple, vegetable, other), each with its cell's color
 * dot. What is still short is said once for the whole day (see `DayFeedback`), not per meal.
 */
export function MealPlate({ entries, onOpenEntry }: Props) {
  const { t, locale } = useLocale();
  const name = (item: { name: string; nameZh: string | null; quick?: boolean }) => entryName(item, locale, t);
  const { filled } = splitPlate(entries);
  if (filled.length === 0) return null;

  return (
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
              <Text style={[type.num, styles.itemKcal]}>{kcal}</Text>
            </Pressable>
          );
        }),
      )}
    </View>
  );
}

const SWATCH = 8;

const styles = StyleSheet.create({
  foods: {
    paddingHorizontal: tokens.card.tilePaddingX,
    paddingVertical: tokens.space.xs,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.surface,
  },
  item: {
    minHeight: tokens.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.sm + tokens.hairline,
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
    fontSize: tokens.fontSize.label + 1,
    fontWeight: tokens.fontWeight.medium,
  },
  itemKcal: {
    color: tokens.color.textSecondary,
    fontSize: tokens.fontSize.caption,
  },
});
