// Shared numeric helpers and retention bounds. Every subsystem used to carry
// private copies of these; one definition keeps eviction consistent across the
// runtime and makes a bound change atomic.

import type { CharacterTier } from './types.js';

export interface TierRetention {
  memories: number;
  records: number;
  trace: number;
}

/** Per-character retention windows by narrative tier. */
export const RETENTION_BY_TIER: Record<CharacterTier, TierRetention> = {
  background: { memories: 16, records: 16, trace: 32 },
  principal: { memories: 64, records: 64, trace: 240 },
  secondary: { memories: 32, records: 32, trace: 96 },
};

/** Window for trace entries that belong to no character. */
export const SYSTEM_TRACE_ENTRIES = 240;
export const SYSTEM_TRACE_KEY = '*';

export function memoryWindow(tier: CharacterTier): number {
  return RETENTION_BY_TIER[tier].memories;
}

export function traceWindow(tier: CharacterTier): number {
  return RETENTION_BY_TIER[tier].trace;
}

/** Resolve record windows for a cast; unknown instances get the secondary window. */
export function recordWindows(
  characters: readonly { id: string; tier: CharacterTier }[],
): (instanceId: string) => number {
  const byId = new Map(
    characters.map(character => [character.id, RETENTION_BY_TIER[character.tier].records]),
  );
  return instanceId => byId.get(instanceId) ?? RETENTION_BY_TIER.secondary.records;
}

/**
 * Append a record and evict only the oldest record of the same owner beyond
 * that owner's window, so one busy character never evicts another's history.
 */
export function retainCharacterRecord<Item>(
  items: readonly Item[],
  item: Item,
  ownerOf: (item: Item) => string,
  windowOf: (owner: string) => number,
): Item[] {
  const next = [...items, item];
  const owner = ownerOf(item);
  const window = windowOf(owner);
  let count = 0;
  for (const candidate of next) if (ownerOf(candidate) === owner) count += 1;
  while (count > window) {
    const index = next.findIndex(candidate => ownerOf(candidate) === owner);
    next.splice(index, 1);
    count -= 1;
  }
  return next;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function appendBounded<Item>(items: readonly Item[], item: Item, maximum: number): Item[] {
  const next = [...items, item];
  return next.length <= maximum ? next : next.slice(next.length - maximum);
}
