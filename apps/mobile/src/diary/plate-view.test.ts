import { setLocale, t } from '../i18n';
import { feedbackLines, groupBySlot, shareTotal, stepShare, suggestionText, type SuggestionView } from './plate-view';

afterEach(() => setLocale('en'));

const met = { status: 'met' as const, diff: 0 };

describe('groupBySlot', () => {
  it('orders the cells protein, staple, vegetable, other and keeps entry order', () => {
    const groups = groupBySlot([
      { id: 'a', slot: 'other' as const },
      { id: 'b', slot: 'protein' as const },
      { id: 'c', slot: 'protein' as const },
    ]);
    expect(groups.map((g) => [g.slot, g.entries.map((e) => e.id)])).toEqual([
      ['protein', ['b', 'c']],
      ['staple', []],
      ['vegetable', []],
      ['other', ['a']],
    ]);
  });
});

describe('feedbackLines', () => {
  it('says what is short or over, lists what is on target, and hints vegetables at lunch', () => {
    setLocale('zh');
    const lines = feedbackLines(
      {
        meal: 'lunch',
        hasVegetables: false,
        gap: {
          kcal: { status: 'over', diff: 120 },
          proteinG: { status: 'short', diff: -25 },
          carbsG: met,
          fatG: met,
        },
      },
      t,
    );
    expect(lines).toEqual(['热量比这餐目标多 120 千卡', '蛋白质还差 25 克', '主食、脂肪已够', '这餐还没有蔬菜']);
  });

  it('is empty without a gap and skips the vegetable hint at breakfast', () => {
    expect(feedbackLines({ meal: 'lunch', hasVegetables: false, gap: null }, t)).toEqual([]);
    const lines = feedbackLines({ meal: 'breakfast', hasVegetables: false, gap: { kcal: met, proteinG: met, carbsG: met, fatG: met } }, t);
    expect(lines).toEqual(['Calories, Protein, Carbs, Fat: on target']);
  });
});

describe('suggestionText', () => {
  const name = (item: { name: string; nameZh: string | null }) => item.nameZh ?? item.name;
  const base = { name: 'Egg, whole, cooked, hard-boiled', nameZh: '水煮蛋', portionId: 'p', portionLabel: '1 large' };

  it('describes an addition with what it brings', () => {
    setLocale('zh');
    const add = {
      ...base,
      kind: 'add',
      reason: 'protein',
      foodId: 'usda-1',
      quantity: 3,
      change: { kcal: 232.5, proteinG: 18.87, carbsG: 1.68, fatG: 15.9 },
    } as SuggestionView;
    expect(suggestionText(add, name, t)).toEqual({ action: '加 3 × 1 large 水煮蛋', effect: '+19 克蛋白质' });
  });

  it('describes a reduction in portions or grams', () => {
    setLocale('zh');
    const reduce = {
      name: 'Rice, white, long-grain, regular, enriched, cooked',
      nameZh: '白米饭',
      kind: 'reduce',
      reason: 'kcal',
      entryId: 'e1',
      portionId: 'p',
      portionLabel: '1 cup',
      quantity: 1.5,
      change: { kcal: -308.1, proteinG: -6.4, carbsG: -66.8, fatG: -0.7 },
    } as SuggestionView;
    expect(suggestionText(reduce, name, t)).toEqual({ action: '白米饭 减到 1.5 × 1 cup', effect: '−308 千卡' });
    expect(suggestionText({ ...reduce, portionId: null, portionLabel: null, quantity: 15 } as SuggestionView, name, t).action).toBe(
      '白米饭 减到 15 克',
    );
  });
});

describe('meal shares', () => {
  const shares = { breakfast: 25, lunch: 30, dinner: 30, snack: 15 };

  it('steps by 5 within 0–100', () => {
    expect(stepShare(shares, 'lunch', 1)).toEqual({ ...shares, lunch: 35 });
    expect(stepShare({ ...shares, snack: 0 }, 'snack', -1)).toEqual({ ...shares, snack: 0 });
    expect(stepShare({ ...shares, dinner: 100 }, 'dinner', 1).dinner).toBe(100);
  });

  it('totals the four meals', () => {
    expect(shareTotal(shares)).toBe(100);
    expect(shareTotal(stepShare(shares, 'lunch', 1))).toBe(105);
  });
});
