import { displayName, per100gOf, progress } from './display';

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

describe('progress', () => {
  it('clamps to 0..1 and handles a missing target', () => {
    expect(progress(500, 2000)).toBe(0.25);
    expect(progress(2500, 2000)).toBe(1);
    expect(progress(10, 0)).toBe(0);
  });
});
