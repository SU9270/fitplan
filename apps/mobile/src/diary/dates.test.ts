import { dayLabel, localDate, shiftDate } from './dates';

describe('localDate', () => {
  it('uses the local calendar date', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDate(new Date(2026, 10, 2, 0, 0))).toBe('2026-11-02');
  });
});

describe('shiftDate', () => {
  it('moves across month and year ends and leap days', () => {
    expect(shiftDate('2026-11-02', -1)).toBe('2026-11-01');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('is not affected by DST changes (2026-11-01 in the US)', () => {
    expect(shiftDate('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftDate('2026-03-08', 1)).toBe('2026-03-09');
  });
});

describe('dayLabel', () => {
  it('names today and yesterday, otherwise month and day', () => {
    expect(dayLabel('2026-11-02', '2026-11-02')).toEqual({ kind: 'today' });
    expect(dayLabel('2026-11-01', '2026-11-02')).toEqual({ kind: 'yesterday' });
    expect(dayLabel('2026-10-30', '2026-11-02')).toEqual({ kind: 'date', month: 10, day: 30 });
  });
});
