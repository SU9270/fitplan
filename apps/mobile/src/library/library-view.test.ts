import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { groupValue, mealAt, shortName, type LibraryTileFood } from './library-view';

const food: LibraryTileFood = {
  key: 'chicken_breast',
  name: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
  nameZh: '鸡胸肉（烤）',
  per100g: { kcal: 165, proteinG: 31.02, carbsG: 0, fatG: 3.57 },
  fiberG: 0,
  omega3AlaG: 0.03,
  omega3EpaDhaG: 0.03,
};

describe('mealAt', () => {
  it('follows the time of day', () => {
    const at = (h: number) => mealAt(new Date(2026, 10, 3, h, 30));
    expect([7, 9, 10, 13, 14, 16, 17, 20, 21, 23].map(at)).toEqual([
      'breakfast',
      'breakfast',
      'lunch',
      'lunch',
      'snack',
      'snack',
      'dinner',
      'dinner',
      'snack',
      'snack',
    ]);
  });
});

describe('shortName', () => {
  it('drops the note in brackets in Chinese and spells out the key in English', () => {
    expect(shortName(food, 'zh')).toBe('鸡胸肉');
    expect(shortName({ key: 'banana', nameZh: '香蕉' }, 'zh')).toBe('香蕉');
    expect(shortName(food, 'en')).toBe('Chicken breast');
    expect(shortName({ key: 'tofu', nameZh: null }, 'zh')).toBe('Tofu');
  });
});

describe('groupValue', () => {
  it('shows the nutrient the group is about', () => {
    expect(groupValue(food, 'protein')).toEqual({ key: 'library.value.protein', n: '31' });
    expect(groupValue({ ...food, per100g: { ...food.per100g, kcal: 34.4 } }, 'vegetable')).toEqual({
      key: 'library.value.kcal',
      n: '34',
    });
    expect(groupValue({ ...food, fiberG: null }, 'fiber')).toBeNull();
  });

  it('shows EPA + DHA in mg for fish and ALA in g for seeds', () => {
    expect(groupValue({ ...food, omega3AlaG: 0.11, omega3EpaDhaG: 2.147 }, 'omega3')).toEqual({ key: 'library.value.epaDha', n: '2147' });
    expect(groupValue({ ...food, omega3AlaG: 9.08, omega3EpaDhaG: 0 }, 'omega3')).toEqual({ key: 'library.value.ala', n: '9.1' });
    expect(groupValue({ ...food, omega3AlaG: 17.83, omega3EpaDhaG: null }, 'omega3')).toEqual({ key: 'library.value.ala', n: '17.8' });
  });
});

describe('library images', () => {
  const root = path.resolve(__dirname, '../../');
  const csv = readFileSync(path.resolve(root, '../api/data/usda-zh.csv'), 'utf8');
  // The library key is the last column; rows with quoted commas still end in it.
  const keys = csv
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.slice(line.lastIndexOf(',') + 1).trim())
    .filter((key) => key !== '');
  const files = readdirSync(path.join(root, 'assets/library'))
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.slice(0, -'.png'.length));
  const mapped = [...readFileSync(path.join(__dirname, 'images.ts'), 'utf8').matchAll(/^ {2}(\w+): require\('\.\.\/\.\.\/assets\/library\/(\w+)\.png'\),$/gm)];

  it('has a picture for every food in the library and no stray ones', () => {
    expect(keys.length).toBeGreaterThanOrEqual(50);
    expect([...files].sort()).toEqual([...keys].sort());
  });

  it('maps every picture under its own key', () => {
    expect(mapped.map((m) => m[1])).toEqual(mapped.map((m) => m[2]));
    expect(mapped.map((m) => m[1]).sort()).toEqual([...files].sort());
  });
});
