import {
  RETENTION_BY_TIER,
  SYSTEM_TRACE_ENTRIES,
  SYSTEM_TRACE_KEY,
  traceWindow,
} from '../model/retention.js';
import type {
  CausalTrace,
  CharacterTier,
  TraceEntry,
  TraceScalar,
  TraceTerm,
} from '../model/types.js';

export function traceWindows(
  placements: readonly { instanceId: string; tier: CharacterTier }[],
): Record<string, number> {
  return Object.fromEntries(
    placements.map(placement => [placement.instanceId, traceWindow(placement.tier)]),
  );
}

export function createTrace(
  windows: Record<string, number>,
  entries: readonly Omit<TraceEntry, 'sequence'>[] = [],
): CausalTrace {
  let trace: CausalTrace = {
    entries: [],
    schemaVersion: 2,
    sequences: {},
    windows: { ...windows },
  };
  for (const entry of entries) trace = appendTrace(trace, entry);
  return trace;
}

function traceKey(entry: { instanceId: string | null }): string {
  return entry.instanceId ?? SYSTEM_TRACE_KEY;
}

/** Append with a per-character monotonic sequence and per-character eviction. */
export function appendTrace(trace: CausalTrace, entry: Omit<TraceEntry, 'sequence'>): CausalTrace {
  const key = traceKey(entry);
  const sequence = (trace.sequences[key] ?? 0) + 1;
  const entries = [...trace.entries, { ...entry, sequence }];
  const window =
    key === SYSTEM_TRACE_KEY
      ? SYSTEM_TRACE_ENTRIES
      : (trace.windows[key] ?? RETENTION_BY_TIER.secondary.trace);
  let count = 0;
  for (const candidate of entries) if (traceKey(candidate) === key) count += 1;
  while (count > window) {
    entries.splice(
      entries.findIndex(candidate => traceKey(candidate) === key),
      1,
    );
    count -= 1;
  }
  return {
    entries,
    schemaVersion: 2,
    sequences: { ...trace.sequences, [key]: sequence },
    windows: trace.windows,
  };
}

export function traceTerm(id: string, value: TraceScalar, ...sources: string[]): TraceTerm {
  return { id, sources, value };
}
