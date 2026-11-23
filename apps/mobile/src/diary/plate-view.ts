import {
  MEAL_SHARE_STEP,
  MEAL_SHARES_TOTAL,
  PLATE_SLOTS,
  type DayGap,
  type MacroTargets,
  type Meal,
  type MealShares,
  type PlateSlot,
} from '@fitplan/core';
import type { t as translate } from '../i18n';
import { formatNumber } from './amount';
import type { DiaryDay } from './api-types';

type T = typeof translate;
/** The whole day against the daily target (the server sends it once dinner has an entry). */
export type DayFeedback = NonNullable<DiaryDay['feedback']>;
export type SuggestionView = DayFeedback['suggestions'][number];
/** What the feedback texts are made from. */
type FeedbackView = { gap: DayGap; hasVegetables: boolean };

/** Entries of one meal by plate cell, in protein → staple → vegetable → other order. */
export function groupBySlot<E extends { slot: PlateSlot }>(entries: readonly E[]): { slot: PlateSlot; entries: E[] }[] {
  return PLATE_SLOTS.map((slot) => ({ slot, entries: entries.filter((e) => e.slot === slot) }));
}

/** The plate split into the cells that have entries and the cells still empty (both in plate order). */
export function splitPlate<E extends { slot: PlateSlot }>(
  entries: readonly E[],
): { filled: { slot: PlateSlot; entries: E[] }[]; missing: PlateSlot[] } {
  const cells = groupBySlot(entries);
  return {
    filled: cells.filter((c) => c.entries.length > 0),
    missing: cells.filter((c) => c.entries.length === 0).map((c) => c.slot),
  };
}

const GAP_ORDER = ['kcal', 'proteinG', 'carbsG', 'fatG'] as const satisfies readonly (keyof MacroTargets)[];

export type FeedbackTone = 'short' | 'met' | 'hint';
export interface FeedbackItem {
  text: string;
  tone: FeedbackTone;
}

/**
 * The day's feedback in neutral words (requirements §3.3): one item per nutrient that is short,
 * one item listing those that are enough, and the vegetables hint when no meal had any. Above
 * the target counts as enough: eating more is not called out (2026-11-22).
 */
export function feedbackItems({ gap, hasVegetables }: FeedbackView, t: T): FeedbackItem[] {
  const items: FeedbackItem[] = [];
  const met: string[] = [];
  for (const key of GAP_ORDER) {
    const { status, diff } = gap[key];
    if (status === 'short') items.push({ text: t(`gap.${key}.short`, { n: Math.abs(diff) }), tone: 'short' });
    else met.push(t(`gap.name.${key}`));
  }
  if (met.length > 0) items.push({ text: t('gap.met', { list: met.join(t('list.separator')) }), tone: 'met' });
  if (!hasVegetables) items.push({ text: t('gap.noVegetables'), tone: 'hint' });
  return items;
}

/**
 * The day's feedback as one line: what is still short, by name only (the numbers are one tap
 * away). Calories are left to the rings at the top unless nothing else is short. Null when
 * nothing is short: a day on or above target gets no line at all (2026-11-22).
 */
export function feedbackSummary({ gap, hasVegetables }: FeedbackView, t: T): FeedbackItem | null {
  const short = GAP_ORDER.filter((key) => key !== 'kcal' && gap[key].status === 'short').map((key) => t(`gap.name.${key}`));
  if (!hasVegetables) short.push(t('plate.slot.vegetable'));
  if (short.length === 0 && gap.kcal.status === 'short') short.push(t('gap.name.kcal'));
  if (short.length === 0) return null;
  return { text: t('gap.summary.short', { list: short.join(t('gap.summary.separator')) }), tone: 'short' };
}

/** "1.5 × 1 cup" or "150 克": an amount as portions of a label, or grams when there is no portion. */
export function amountLabel(quantity: number, portionId: string | null, portionLabel: string | null, t: T): string {
  if (portionId === null) return t('common.grams', { n: formatNumber(quantity) });
  const n = formatNumber(quantity, 2);
  return portionLabel === null ? t('food.servings', { n }) : t('diary.portionAmount', { n, label: portionLabel });
}

/** What a suggestion says, and what it brings ("+19 克蛋白质"). */
export function suggestionText(
  s: SuggestionView,
  displayName: (item: { name: string; nameZh: string | null }) => string,
  t: T,
): { action: string; effect: string } {
  const amount = amountLabel(s.quantity, s.portionId, s.portionLabel, t);
  const food = displayName(s);
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
