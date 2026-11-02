import { MEALS, isCalendarDate, type Meal } from '@fitplan/validators';

/** Search params are strings (or arrays, or missing); fall back to safe values. */
export function mealParam(value: string | string[] | undefined): Meal {
  return MEALS.find((m) => m === value) ?? 'snack';
}

export function dateParam(value: string | string[] | undefined, fallback: string): string {
  return typeof value === 'string' && isCalendarDate(value) ? value : fallback;
}

export function stringParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}
