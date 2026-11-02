import { displayName, entryAmount, groupByMeal, per100gOf, progress } from './display';

describe('displayName', () => {
  const food = { name: 'Rice, white, long-grain, regular, enriched, cooked', nameZh: '白米饭' };
  it('uses the Chinese name in Chinese, the English name otherwise', () => {
    expect(displayName(food, 'zh')).toBe('白米饭');
    expect(displayName(food, 'en')).toBe(food.name);
    expect(displayName({ ...food, nameZh: null }, 'zh')).toBe(food.name);
  });
});

describe('per100gOf', () => {
  it('reverses the server scaling and keeps unknown values', () => {
    expect(per100gOf({ kcal: 247.5, proteinG: null, carbsG: 0, fatG: 5.4 }, 150)).toEqual({
      kcal: 165,
      proteinG: null,
      carbsG: 0,
      fatG: 3.6,
    });
  });
});

describe('groupByMeal', () => {
  it('orders meals, keeps entry order and rounds subtotals from unrounded values', () => {
    const n = (kcal: number) => ({ kcal, proteinG: 1, carbsG: null, fatG: 0 });
    const entries = [
      { id: 'a', meal: 'dinner' as const, nutrients: n(100.4) },
      { id: 'b', meal: 'breakfast' as const, nutrients: n(0.3) },
      { id: 'c', meal: 'dinner' as const, nutrients: n(100.4) },
    ];
    const groups = groupByMeal(entries);
    expect(groups.map((g) => g.meal)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    expect(groups[2]?.entries.map((e) => e.id)).toEqual(['a', 'c']);
    expect(groups[2]?.subtotal).toEqual({ totals: { kcal: 201, proteinG: 2, carbsG: 0, fatG: 0 }, unknown: ['carbsG'] });
    expect(groups[1]?.entries).toEqual([]);
  });
});

describe('progress', () => {
  it('clamps to 0..1 and handles a missing target', () => {
    expect(progress(500, 2000)).toBe(0.25);
    expect(progress(2500, 2000)).toBe(1);
    expect(progress(10, 0)).toBe(0);
  });
});

describe('entryAmount', () => {
  it('reads portions (named or not) and grams', () => {
    expect(entryAmount({ portionId: 'p', portionLabel: '1 cup', quantity: 1.5, grams: 237 })).toEqual({
      kind: 'portion',
      quantity: 1.5,
      label: '1 cup',
    });
    expect(entryAmount({ portionId: 'p', portionLabel: null, quantity: 2, grams: 120 })).toEqual({
      kind: 'portion',
      quantity: 2,
      label: null,
    });
    expect(entryAmount({ portionId: null, portionLabel: '6 pcs', quantity: 1, grams: 150 })).toMatchObject({ kind: 'portion' });
    expect(entryAmount({ portionId: null, portionLabel: null, quantity: 150, grams: 150 })).toEqual({ kind: 'grams', grams: 150 });
  });
});
