import { describe, expect, it } from 'vitest';
import { libraryGroups, type LibraryFoodFacts } from './library';

const facts = (over: Partial<LibraryFoodFacts> & Pick<LibraryFoodFacts, 'per100g'>): LibraryFoodFacts => ({
  category: null,
  fiberG: null,
  omega3AlaG: null,
  omega3EpaDhaG: null,
  ...over,
});

describe('libraryGroups', () => {
  it('puts rice under carbs only', () => {
    const rice = facts({ category: 'Cereal Grains and Pasta', per100g: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 }, fiberG: 0.4 });
    expect(libraryGroups(rice)).toEqual(['carbs']);
  });

  it('keeps eggs and salmon in protein, not fat', () => {
    const egg = facts({ category: 'Dairy and Egg Products', per100g: { kcal: 155, proteinG: 12.6, carbsG: 1.1, fatG: 10.6 } });
    expect(libraryGroups(egg)).toEqual(['protein']);
    const salmon = facts({
      category: 'Finfish and Shellfish Products',
      per100g: { kcal: 206, proteinG: 22.1, carbsG: 0, fatG: 12.4 },
      omega3AlaG: 0.11,
      omega3EpaDhaG: 2.15,
    });
    expect(libraryGroups(salmon)).toEqual(['protein', 'omega3']);
  });

  it('lists avocado as fruit, fat and high fiber', () => {
    const avocado = facts({
      category: 'Fruits and Fruit Juices',
      per100g: { kcal: 160, proteinG: 2, carbsG: 8.5, fatG: 14.7 },
      fiberG: 6.7,
      omega3AlaG: 0.11,
    });
    expect(libraryGroups(avocado)).toEqual(['fat', 'fruit', 'fiber']);
  });

  it('counts ALA per 100 g and per 100 kcal: walnuts qualify, olive oil does not', () => {
    const walnuts = facts({
      category: 'Nut and Seed Products',
      per100g: { kcal: 654, proteinG: 15.2, carbsG: 13.7, fatG: 65.2 },
      fiberG: 6.7,
      omega3AlaG: 9.08,
    });
    expect(libraryGroups(walnuts)).toEqual(['fat', 'fiber', 'omega3']);
    const oliveOil = facts({ category: 'Fats and Oils', per100g: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 }, omega3AlaG: 0.76 });
    expect(libraryGroups(oliveOil)).toEqual(['fat']);
  });

  it('uses the EPA + DHA threshold of 80 mg', () => {
    const base = { category: 'Finfish and Shellfish Products', per100g: { kcal: 90, proteinG: 20, carbsG: 0, fatG: 1 } };
    expect(libraryGroups(facts({ ...base, omega3EpaDhaG: 0.08 }))).toEqual(['protein', 'omega3']);
    expect(libraryGroups(facts({ ...base, omega3EpaDhaG: 0.079 }))).toEqual(['protein']);
  });

  it('puts leafy vegetables under vegetable and starchy ones under carbs', () => {
    const veg = 'Vegetables and Vegetable Products';
    expect(libraryGroups(facts({ category: veg, per100g: { kcal: 34, proteinG: 2.8, carbsG: 6.6, fatG: 0.4 }, fiberG: 2.6 }))).toEqual([
      'vegetable',
    ]);
    expect(libraryGroups(facts({ category: veg, per100g: { kcal: 90, proteinG: 2, carbsG: 20.7, fatG: 0.2 }, fiberG: 3.3 }))).toEqual([
      'carbs',
    ]);
  });

  it('marks 6 g of fiber as high fiber, 5.9 g not', () => {
    const beans = { category: 'Legumes and Legume Products', per100g: { kcal: 132, proteinG: 8.9, carbsG: 23.7, fatG: 0.5 } };
    expect(libraryGroups(facts({ ...beans, fiberG: 6 }))).toEqual(['carbs', 'fiber']);
    expect(libraryGroups(facts({ ...beans, fiberG: 5.9 }))).toEqual(['carbs']);
  });

  it('lists protein powder (a USDA beverage) under protein', () => {
    const whey = facts({ category: 'Beverages', per100g: { kcal: 352, proteinG: 78.1, carbsG: 6.3, fatG: 1.6 } });
    expect(libraryGroups(whey)).toEqual(['protein']);
  });

  it('puts nothing in a group on unknown nutrients', () => {
    expect(libraryGroups(facts({ per100g: { kcal: null, proteinG: null, carbsG: null, fatG: null } }))).toEqual([]);
  });
});
