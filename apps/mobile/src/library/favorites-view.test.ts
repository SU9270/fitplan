import { LIBRARY_GROUPS } from '@fitplan/core';
import { setLocale, t } from '../i18n';
import { favoriteInitial, favoriteName, favoriteValue, initialTab, LIBRARY_TABS } from './favorites-view';

afterEach(() => setLocale('en'));

describe('LIBRARY_TABS', () => {
  it('puts 我的 first', () => {
    expect(LIBRARY_TABS).toEqual(['mine', ...LIBRARY_GROUPS]);
  });
});

describe('initialTab', () => {
  it('opens on 我的 only when it has something', () => {
    expect(initialTab(0, 0)).toBe('carbs');
    expect(initialTab(1, 0)).toBe('mine');
    expect(initialTab(0, 2)).toBe('mine');
  });
});

describe('favoriteName', () => {
  const egg = { name: 'Egg, whole, cooked, hard-boiled', nameZh: '水煮蛋（全蛋）', libraryKey: 'egg' };
  const tuna = { name: 'Tuna, canned in water', nameZh: '水浸金枪鱼罐头（沥干）', libraryKey: null };

  it('uses the library short name when there is a picture', () => {
    expect(favoriteName(egg, 'zh')).toBe('水煮蛋');
    expect(favoriteName(egg, 'en')).toBe('Egg');
  });

  it('strips the bracket note of other foods and falls back to the English name', () => {
    expect(favoriteName(tuna, 'zh')).toBe('水浸金枪鱼罐头');
    expect(favoriteName(tuna, 'en')).toBe('Tuna, canned in water');
    expect(favoriteName({ name: '妈妈的红烧肉', nameZh: null, libraryKey: null }, 'zh')).toBe('妈妈的红烧肉');
  });
});

describe('favoriteInitial', () => {
  it('is one whole character', () => {
    expect(favoriteInitial('鸡胸肉')).toBe('鸡');
    expect(favoriteInitial('tuna')).toBe('T');
    expect(favoriteInitial('  豆腐')).toBe('豆');
    expect(favoriteInitial('🍜拉面')).toBe('🍜');
    expect(favoriteInitial('')).toBe('');
  });
});

describe('favoriteValue', () => {
  it('shows the amount in grams and its kcal', () => {
    setLocale('zh');
    expect(favoriteValue({ grams: 100, kcal: 155.6 }, t)).toBe('100 克 · 156 千卡');
    expect(favoriteValue({ grams: 37.5, kcal: 195 }, t)).toBe('37.5 克 · 195 千卡');
  });

  it('shows only the amount when kcal is unknown', () => {
    setLocale('zh');
    expect(favoriteValue({ grams: 100, kcal: null }, t)).toBe('100 克');
  });

  it('reads the same way in English', () => {
    expect(favoriteValue({ grams: 100, kcal: 155.6 }, t)).toBe('100 g · 156 kcal');
  });
});
