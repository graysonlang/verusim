// Shared numeric helpers and retention bounds. Every subsystem used to carry
// private copies of these; one definition keeps eviction consistent across the
// runtime and makes a bound change atomic.

export const MAX_TRACE_ENTRIES = 240;
export const MAX_MEMORIES = 16;

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function appendBounded<Item>(items: readonly Item[], item: Item, maximum: number): Item[] {
  const next = [...items, item];
  return next.length <= maximum ? next : next.slice(next.length - maximum);
}
