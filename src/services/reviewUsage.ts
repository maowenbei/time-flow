export const REQUIRED_DAYS = 3;

/** Stored local calendar dates, capped once the lifetime threshold is reached. */
export function normalizeUsageDays(days: readonly string[]): string[] {
  return [...new Set(days.filter(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)))].slice(0, REQUIRED_DAYS);
}

export function recordUsageDay(days: string[], day: string): string[] {
  if (days.length >= REQUIRED_DAYS || days.includes(day)) return days;
  return normalizeUsageDays([...days, day]);
}

export function migrateUsageDays(stored: unknown, tasks: readonly { day: string; elapsedDuration: number }[]): string[] {
  return normalizeUsageDays(Array.isArray(stored) ? stored : tasks.filter(task => task.elapsedDuration > 0).map(task => task.day));
}

export function isReviewEligible(days: readonly string[]): boolean {
  return normalizeUsageDays(days).length >= REQUIRED_DAYS;
}
