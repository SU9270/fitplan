import { EMPTY_CUSTOM_FORM, formFromFood, toCustomFoodInput } from './custom-form';

const label = { name: 'Protein bar', servingLabel: '1 bar', servingGrams: '60', kcal: '210', proteinG: '20', carbsG: '24', fatG: '7' };

describe('toCustomFoodInput', () => {
  it('parses a filled-in label; a blank serving name becomes null', () => {
    expect(toCustomFoodInput(label)).toEqual({
      ok: true,
      input: { name: 'Protein bar', servingLabel: '1 bar', servingGrams: 60, kcal: 210, proteinG: 20, carbsG: 24, fatG: 7 },
    });
    const r = toCustomFoodInput({ ...label, servingLabel: '  ', kcal: '210,5' });
    expect(r).toMatchObject({ ok: true, input: { servingLabel: null, kcal: 210.5 } });
  });

  it('reports one message per field', () => {
    expect(toCustomFoodInput(EMPTY_CUSTOM_FORM)).toEqual({
      ok: false,
      errors: {
        name: 'custom.error.name',
        servingGrams: 'custom.error.number',
        kcal: 'custom.error.number',
        proteinG: 'custom.error.number',
        carbsG: 'custom.error.number',
        fatG: 'custom.error.number',
      },
    });
    expect(toCustomFoodInput({ ...label, fatG: '1e3' })).toEqual({ ok: false, errors: { fatG: 'custom.error.number' } });
  });

  it('flags macros heavier than the serving', () => {
    expect(toCustomFoodInput({ ...label, servingGrams: '40' })).toEqual({
      ok: false,
      errors: { servingGrams: 'custom.error.macros' },
    });
  });
});

describe('formFromFood', () => {
  it('turns per-100 g values back into the serving', () => {
    const food = {
      name: 'Protein bar',
      per100g: { kcal: 350, proteinG: 33.333333, carbsG: 40, fatG: 11.666667 },
      portions: [{ label: null, grams: 60 }],
    };
    expect(formFromFood(food)).toEqual({ ...label, servingLabel: '' });
  });
});
