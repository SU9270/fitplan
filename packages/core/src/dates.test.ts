import { describe, expect, it } from 'vitest';
import { currentStreak, shiftDate } from './dates';

describe('shiftDate', () => {
  it('moves across month and year ends and leap days', () => {
    expect(shiftDate('2026-11-02', -1)).toBe('2026-11-01');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('is not affected by DST changes (2026-11-01 and 2026-03-08 in the US)', () => {
    expect(shiftDate('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftDate('2026-03-08', 1)).toBe('2026-03-09');
  });
});

describe('currentStreak', () => {
  const today = '2026-11-02';

  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-11-02', '2026-11-01', '2026-10-31', '2026-10-29'], today)).toBe(3);
  });

  it('keeps the streak alive when today has no entry yet', () => {
    expect(currentStreak(['2026-11-01', '2026-10-31'], today)).toBe(2);
  });

  it('is 0 when neither today nor yesterday has an entry', () => {
    expect(currentStreak(['2026-10-31', '2026-10-30'], today)).toBe(0);
    expect(currentStreak([], today)).toBe(0);
  });

  it('ignores order, duplicates and dates after today; crosses month ends', () => {
    expect(currentStreak(['2026-11-03', '2026-10-31', '2026-11-01', '2026-11-01', '2026-11-02'], today)).toBe(3);
    expect(currentStreak(['2026-03-01', '2026-02-28'], '2026-03-01')).toBe(2);
  });
});
