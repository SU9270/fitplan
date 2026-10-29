export type Sex = 'male' | 'female' | 'unspecified';
export type Goal = 'lose' | 'gain';
export type Pace = 'conservative' | 'standard' | 'aggressive';
export type ActivityLevel = 1 | 2 | 3 | 4 | 5;

export interface MacroTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
