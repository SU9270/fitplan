import { describe, expect, it } from 'vitest';
import { per100gFromServing, scaleNutrients, sumNutrients } from './nutrition';

// Values shaped like a cooked chicken breast entry (per 100 g).
const chicken = { kcal: 165, proteinG: 31.02, carbsG: 0, fatG: 3.57 };

describe('scaleNutrients', () => {
  it('scales per-100 g values to the logged grams', () => {
    expect(scaleNutrients(chicken, 150)).toEqual({ kcal: 247.5, proteinG: 46.53, carbsG: 0, fatG: 5.355 });
  });

  it('keeps unknown values unknown and zero as zero', () => {
    expect(scaleNutrients({ kcal: 50, proteinG: null, carbsG: 0, fatG: null }, 200)).toEqual({
      kcal: 100,
      proteinG: null,
      carbsG: 0,
      fatG: null,
    });
  });

  it('does not round', () => {
    expect(scaleNutrients({ kcal: 1, proteinG: 1, carbsG: 1, fatG: 1 }, 33).kcal).toBeCloseTo(0.33, 10);
  });
});

describe('per100gFromServing', () => {
  it('converts a nutrition label to per-100 g values', () => {
    // 1 bar = 60 g: 210 kcal, 20 g protein, 24 g carbs, 7 g fat
    const per100 = per100gFromServing({ kcal: 210, proteinG: 20, carbsG: 24, fatG: 7 }, 60);
    expect(per100.kcal).toBeCloseTo(350, 10);
    expect(per100.proteinG).toBeCloseTo(33.333, 3);
    expect(per100.carbsG).toBeCloseTo(40, 10);
    expect(per100.fatG).toBeCloseTo(11.667, 3);
  });

  it('round-trips through scaleNutrients', () => {
    const label = { kcal: 210, proteinG: 20, carbsG: 24, fatG: 7 };
    const back = scaleNutrients(per100gFromServing(label, 60), 60);
    for (const key of ['kcal', 'proteinG', 'carbsG', 'fatG'] as const) expect(back[key]).toBeCloseTo(label[key], 10);
  });
});

describe('sumNutrients', () => {
  it('returns zeros for an empty day', () => {
    expect(sumNutrients([])).toEqual({ totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }, unknown: [] });
  });

  it('rounds only the final sum', () => {
    // 3 × 0.4 kcal: rounding each item first would give 0, rounding the sum gives 1.
    const item = { kcal: 0.4, proteinG: 0.4, carbsG: 0.4, fatG: 0.4 };
    expect(sumNutrients([item, item, item]).totals).toEqual({ kcal: 1, proteinG: 1, carbsG: 1, fatG: 1 });
  });

  it('counts unknown values as 0 and lists them once, in a fixed order', () => {
    const r = sumNutrients([
      { kcal: 100, proteinG: null, carbsG: 10, fatG: null },
      { kcal: 50.6, proteinG: 5, carbsG: null, fatG: null },
    ]);
    expect(r.totals).toEqual({ kcal: 151, proteinG: 5, carbsG: 10, fatG: 0 });
    expect(r.unknown).toEqual(['proteinG', 'carbsG', 'fatG']);
  });
});
