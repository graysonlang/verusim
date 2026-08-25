// Canonical simulation time is an integer number of seconds from the start of
// day one, epoch-style. Rates authored per minute or per hour convert through
// these constants; nothing else in the engine may carry a time unit implicitly.

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_DAY = 86_400;
export const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;

export function secondOfDay(second: number): number {
  return ((second % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
}
