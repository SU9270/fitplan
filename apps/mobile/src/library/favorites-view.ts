import { LIBRARY_GROUPS, type LibraryGroup } from '@fitplan/core';
import { formatNumber } from '../diary/amount';
import type { Locale, t as translate } from '../i18n';
import { shortName } from './library-view';

// Display rules of the food library's "我的" group
// (docs/superpowers/specs/2026-11-22-my-food-library-design.md).

type T = typeof translate;

/** The library's chips: the user's own group, then the nutrition groups. */
export type LibraryTab = 'mine' | LibraryGroup;
export const LIBRARY_TABS: readonly LibraryTab[] = ['mine', ...LIBRARY_GROUPS];

/** The chip the tab opens on: "我的" once it has something, otherwise the first nutrition group. */
export function initialTab(favorites: number, templates: number): LibraryTab {
  return favorites > 0 || templates > 0 ? 'mine' : LIBRARY_GROUPS[0];
}

/**
 * A starred food's name on its tile: the library's short name when it has a picture; otherwise
 * the Chinese name without its note in brackets, or the full name when there is none.
 */
export function favoriteName(food: { name: string; nameZh: string | null; libraryKey: string | null }, locale: Locale): string {
  if (food.libraryKey !== null) return shortName({ key: food.libraryKey, nameZh: food.nameZh }, locale);
  if (locale === 'zh' && food.nameZh) return food.nameZh.replace(/（[^）]*）$/, '').trim() || food.nameZh;
  return food.name;
}

/** The character in a tile's circle when the food has no picture: the name's first, whole. */
export function favoriteInitial(name: string): string {
  // Spread iterates by code point, so an emoji is not cut in half.
  return ([...name.trim()][0] ?? '').toUpperCase();
}

/**
 * What a tile's "＋" adds: grams and their kcal ("100 克 · 156 千卡"). Grams rather than the
 * portion label, because USDA labels ("1 cup, chopped or diced") do not fit a tile.
 */
export function favoriteValue(food: { grams: number; kcal: number | null }, t: T): string {
  const amount = t('common.grams', { n: formatNumber(food.grams) });
  return food.kcal === null ? amount : t('library.mine.value', { amount, kcal: Math.round(food.kcal) });
}
