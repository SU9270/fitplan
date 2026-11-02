import { dateParam, mealParam, stringParam } from './route-params';

describe('route params', () => {
  it('accept known values and fall back otherwise', () => {
    expect(mealParam('lunch')).toBe('lunch');
    expect(mealParam('brunch')).toBe('snack');
    expect(mealParam(['lunch'])).toBe('snack');
    expect(mealParam(undefined)).toBe('snack');
    expect(dateParam('2026-11-02', 'x')).toBe('2026-11-02');
    expect(dateParam('2026-02-30', '2026-11-02')).toBe('2026-11-02');
    expect(stringParam('abc')).toBe('abc');
    expect(stringParam('')).toBeNull();
    expect(stringParam(['a'])).toBeNull();
  });
});
