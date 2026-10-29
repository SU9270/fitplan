import { describe, expect, it } from 'vitest';
import { bmrKcal, calorieTarget, tdeeKcal } from './energy';
import { macroTargets } from './macros';
import type { ActivityLevel, Goal, Pace, Sex } from './types';

type Input = readonly [Sex, number, number, number, ActivityLevel, Goal, Pace];
interface Expected {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const cases: ReadonlyArray<readonly [Input, Expected]> = [
  [['male', 20, 175, 70, 3, 'lose', 'standard'], { kcal: 2056, proteinG: 140, carbsG: 248, fatG: 56 }],
  [['female', 22, 160, 55, 2, 'gain', 'standard'], { kcal: 1934, proteinG: 99, carbsG: 286, fatG: 44 }],
  [['male', 30, 180, 120, 1, 'lose', 'aggressive'], { kcal: 2180, proteinG: 240, carbsG: 89, fatG: 96 }],
  [['female', 25, 150, 45, 1, 'lose', 'aggressive'], { kcal: 1200, proteinG: 90, carbsG: 129, fatG: 36 }],
  [['unspecified', 28, 170, 65, 2, 'lose', 'conservative'], { kcal: 1697, proteinG: 130, carbsG: 177, fatG: 52 }],
  [['male', 19, 170, 53, 3, 'gain', 'standard'], { kcal: 2562, proteinG: 95, carbsG: 417, fatG: 57 }],
  [['female', 21, 168, 60, 4, 'lose', 'standard'], { kcal: 1892, proteinG: 120, carbsG: 245, fatG: 48 }],
];

describe('macroTargets', () => {
  it.each(cases)('computes macros for %j', (input, want) => {
    const [sex, age, heightCm, weightKg, level, goal, pace] = input;
    const bmr = bmrKcal(sex, age, heightCm, weightKg);
    const tdee = tdeeKcal(bmr, level);
    const { kcal } = calorieTarget({ goal, pace, tdee, bmr, weightKg, sex });
    expect(macroTargets(kcal, weightKg, goal)).toEqual(want);
  });

  it('never returns negative carbs', () => {
    const m = macroTargets(800, 120, 'lose');
    expect(m.carbsG).toBe(0);
  });
});
