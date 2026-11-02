import { dayLabel, localDate } from './dates';

describe('localDate', () => {
  it('uses the local calendar date', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDate(new Date(2026, 10, 2, 0, 0))).toBe('2026-11-02');
  });
});

describe('dayLabel', () => {
  it('names today and yesterday, otherwise month and day', () => {
    expect(dayLabel('2026-11-02', '2026-11-02')).toEqual({ kind: 'today' });
    expect(dayLabel('2026-11-01', '2026-11-02')).toEqual({ kind: 'yesterday' });
    expect(dayLabel('2026-10-30', '2026-11-02')).toEqual({ kind: 'date', month: 10, day: 30 });
  });
});
