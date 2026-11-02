import { shiftDate } from '@fitplan/core';

/** The device's local calendar date as `YYYY-MM-DD` (what the diary is keyed by). */
export function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export type DayLabel = { kind: 'today' } | { kind: 'yesterday' } | { kind: 'date'; month: number; day: number };

/** How the day switcher names `date`, relative to `today` (both `YYYY-MM-DD`). */
export function dayLabel(date: string, today: string): DayLabel {
  if (date === today) return { kind: 'today' };
  if (date === shiftDate(today, -1)) return { kind: 'yesterday' };
  const [, month, day] = date.split('-').map(Number);
  return { kind: 'date', month: month ?? 0, day: day ?? 0 };
}
