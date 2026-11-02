/** `YYYY-MM-DD` moved by whole days; calendar arithmetic in UTC, so DST changes cannot skip a day. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Consecutive days with at least one diary entry, counting back from `today`. A day that has
 * no entry *yet* does not break the streak: when `today` is empty, counting starts at yesterday.
 * Dates after `today` are ignored. `dates` may be unsorted and contain duplicates.
 */
export function currentStreak(dates: readonly string[], today: string): number {
  const logged = new Set(dates.filter((d) => d <= today));
  let day = logged.has(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (logged.has(day)) {
    streak += 1;
    day = shiftDate(day, -1);
  }
  return streak;
}
