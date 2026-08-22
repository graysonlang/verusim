import type { CausalTrace, TraceEntry, TraceScalar, TraceTerm } from '../model/types.js';

export function createTrace(entries: TraceEntry[] = []): CausalTrace {
  return { entries, schemaVersion: 1 };
}

export function appendTrace(trace: CausalTrace, entry: TraceEntry, maximum: number): CausalTrace {
  const entries = [...trace.entries, entry];
  return {
    entries: entries.length <= maximum ? entries : entries.slice(entries.length - maximum),
    schemaVersion: 1,
  };
}

export function traceTerm(id: string, value: TraceScalar, ...sources: string[]): TraceTerm {
  return { id, sources, value };
}
