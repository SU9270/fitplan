import { describe, expect, it } from 'vitest';
import { KCAL_FLOOR } from './constants';
import { bmi, bmrKcal, calorieTarget, tdeeKcal } from './energy';
import { macroTargets } from './macros';
import type { ActivityLevel, Goal, Pace, Sex } from './types';

type Input = readonly [Sex, number, number, number, ActivityLevel, Goal, Pace];
interface Expected {
  bmi: number;
  bmr: number;
  tdee: number;
  kcal: number;
  raised: boolean;
}

const cases: ReadonlyArray<readonly [Input, Expected]> = [
  [['male', 20, 175, 70, 3, 'lose', 'standard'], { bmi: 22.9, bmr: 1699, tdee: 2633, kcal: 2056, raised: false }],
  [['female', 22, 160, 55, 2, 'gain', 'standard'], { bmi: 21.5, bmr: 1279, tdee: 1759, kcal: 1934, raised: false }],
  [['male', 30, 180, 120, 1, 'lose', 'aggressive'], { bmi: 37.0, bmr: 2180, tdee: 2616, kcal: 2180, raised: true }],
  [['female', 25, 150, 45, 1, 'lose', 'aggressive'], { bmi: 20.0, bmr: 1102, tdee: 1322, kcal: 1200, raised: true }],
  [['unspecified', 28, 170, 65, 2, 'lose', 'conservative'], { bmi: 22.5, bmr: 1495, tdee: 2055, kcal: 1697, raised: false }],
  [['male', 19, 170, 53, 3, 'gain', 'standard'], { bmi: 18.3, bmr: 1503, tdee: 2329, kcal: 2562, raised: false }],
  [['female', 21, 168, 60, 4, 'lose', 'standard'], { bmi: 21.3, bmr: 1384, tdee: 2387, kcal: 1892, raised: false }],
];

describe('energy', () => {
  it.each(cases)('computes bmi/bmr/tdee/target for %j', (input, want) => {
    const [sex, age, heightCm, weightKg, level, goal, pace] = input;
    const bmr = bmrKcal(sex, age, heightCm, weightKg);
    const tdee = tdeeKcal(bmr, level);
    const target = calorieTarget({ goal, pace, tdee, bmr, weightKg, sex });
    expect(Math.round(bmi(weightKg, heightCm) * 10) / 10).toBe(want.bmi);
    expect(Math.round(bmr)).toBe(want.bmr);
    expect(Math.round(tdee)).toBe(want.tdee);
    expect(Math.round(target.kcal)).toBe(want.kcal);
    expect(target.raisedToFloor).toBe(want.raised);
  });

  it('caps deficit at 25% of TDEE', () => {
    const bmr = bmrKcal('male', 30, 180, 120);
    const tdee = tdeeKcal(bmr, 3);
    const target = calorieTarget({ goal: 'lose', pace: 'aggressive', tdee, bmr, weightKg: 120, sex: 'male' });
    expect(Math.round(tdee)).toBe(3379);
    expect(Math.round(target.kcal)).toBe(2534);
    expect(target.raisedToFloor).toBe(false);
  });
});

describe('invariants across all inputs', () => {
  it('macros sum within 1% of kcal and respect the floor', () => {
    const sexes: Sex[] = ['male', 'female', 'unspecified'];
    const goals: Goal[] = ['lose', 'gain'];
    const paces: Pace[] = ['conservative', 'standard', 'aggressive'];
    const levels: ActivityLevel[] = [1, 2, 3, 4, 5];
    let count = 0;
    for (const sex of sexes)
      for (const goal of goals)
        for (const pace of paces)
          for (const level of levels) {
            const bmr = bmrKcal(sex, 25, 170, 65);
            const tdee = tdeeKcal(bmr, level);
            const { kcal } = calorieTarget({ goal, pace, tdee, bmr, weightKg: 65, sex });
            const m = macroTargets(kcal, 65, goal);
            const sum = m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9;
            expect(Math.abs(sum - kcal) / kcal).toBeLessThanOrEqual(0.01);
            expect(kcal).toBeGreaterThanOrEqual(Math.max(bmr, KCAL_FLOOR[sex]));
            for (const v of [m.kcal, m.proteinG, m.carbsG, m.fatG]) {
              expect(Number.isFinite(v)).toBe(true);
              expect(v).toBeGreaterThanOrEqual(0);
            }
            count++;
          }
    expect(count).toBe(90);
  });
});
