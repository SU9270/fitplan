import {
  MEAL_SHARE_STEP,
  MEAL_SHARES_TOTAL,
  PLATE_SLOTS,
  VEGETABLE_HINT_MEALS,
  type MacroTargets,
  type Meal,
  type MealGap,
  type MealShares,
  type PlateSlot,
} from '@fitplan/core';
import type { t as translate } from '../i18n';
import { formatNumber } from './amount';
import type { DiaryDay } from './api-types';

type T = typeof translate;
export type MealView = DiaryDay['meals'][number];
export type SuggestionView = MealView['suggestions'][number];

/** Entries of one meal by plate cell, in protein → staple → vegetable → other order. */
export function groupBySlot<E extends { slot: PlateSlot }>(entries: readonly E[]): { slot: PlateSlot; entries: E[] }[] {
  return PLATE_SLOTS.map((slot) => ({ slot, entries: entries.filter((e) => e.slot === slot) }));
}

const GAP_ORDER = ['kcal', 'proteinG', 'carbsG', 'fatG'] as const satisfies readonly (keyof MacroTargets)[];

/**
 * The meal's feedback in neutral words (requirements §3.3): one line per nutrient that is short
 * or over, one line listing those on target, and the vegetables hint at lunch and dinner.
 * Nothing for a meal without feedback (no target, or nothing logged yet).
 */
export function feedbackLines(view: { meal: Meal; gap: MealGap | null; hasVegetables: boolean }, t: T): string[] {
  const { gap } = view;
  if (gap === null) return [];
  const lines: string[] = [];
  const met: string[] = [];
  for (const key of GAP_ORDER) {
    const { status, diff } = gap[key];
    if (status === 'met') met.push(t(`gap.name.${key}`));
    else lines.push(t(`gap.${key}.${status}`, { n: Math.abs(diff) }));
  }
  if (met.length > 0) lines.push(t('gap.met', { list: met.join(t('list.separator')) }));
  if (VEGETABLE_HINT_MEALS.includes(view.meal) && !view.hasVegetables) lines.push(t('gap.noVegetables'));
  return lines;
}

/** "1.5 × 1 cup" or "150 克": an amount as portions of a label, or grams when there is no portion. */
function amountText(quantity: number, portionId: string | null, portionLabel: string | null, t: T): string {
  if (portionId === null) return t('common.grams', { n: formatNumber(quantity) });
  const n = formatNumber(quantity, 2);
  return portionLabel === null ? t('food.servings', { n }) : t('diary.portionAmount', { n, label: portionLabel });
}

/** What a suggestion says, and what it changes ("+19 克蛋白质", "−308 千卡"). */
export function suggestionText(
  s: SuggestionView,
  displayName: (item: { name: string; nameZh: string | null }) => string,
  t: T,
): { action: string; effect: string } {
  const amount = amountText(s.quantity, s.portionId, s.portionLabel, t);
  const food = displayName(s);
  if (s.kind === 'adjust' && s.reason === 'kcal') {
    return {
      action: t('suggest.reduce', { food, amount }),
      effect: t('suggest.effect.kcal', { n: Math.round(Math.abs(s.change.kcal ?? 0)) }),
    };
  }
  const gained =
    s.reason === 'protein' ? s.change.proteinG : s.reason === 'staple' ? s.change.carbsG : s.change.kcal;
  return {
    action: t(s.kind === 'add' ? 'suggest.add' : 'suggest.increase', { food, amount }),
    effect: t(`suggest.effect.${s.reason}`, { n: Math.round(gained ?? 0) }),
  };
}

export const shareTotal = (shares: MealShares): number =>
  shares.breakfast + shares.lunch + shares.dinner + shares.snack;

/** One meal's share moved by ±5 %, kept within 0–100 (the total is checked when saving). */
export function stepShare(shares: MealShares, meal: Meal, direction: 1 | -1): MealShares {
  const next = shares[meal] + direction * MEAL_SHARE_STEP;
  return next < 0 || next > MEAL_SHARES_TOTAL ? shares : { ...shares, [meal]: next };
}
