import type { TraceEntry } from '../src/model/types.js';

export interface ActivityFeed {
  matchingCount: number;
  totalCount: number;
  visibleEntries: TraceEntry[];
}

function searchText(entry: TraceEntry, characterNames: ReadonlyMap<string, string>): string {
  const character =
    entry.agentId === null ? 'system' : (characterNames.get(entry.agentId) ?? entry.agentId);
  const terms = entry.terms
    .map(term => `${term.id} ${String(term.value)} ${term.sources.join(' ')}`)
    .join(' ');
  const selection =
    entry.selection === null
      ? ''
      : `${entry.selection.rule} ${entry.selection.selectedId ?? 'none'}`;
  return `${character} ${entry.kind} ${entry.summary} ${terms} ${selection}`.toLowerCase();
}

export function activityFeed(
  entries: readonly TraceEntry[],
  characterNames: ReadonlyMap<string, string>,
  query: string,
  maximumVisible = 250,
): ActivityFeed {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching =
    terms.length === 0
      ? [...entries]
      : entries.filter(entry => {
          const haystack = searchText(entry, characterNames);
          return terms.every(term => haystack.includes(term));
        });
  const limit = Math.max(0, Math.floor(maximumVisible));
  return {
    matchingCount: matching.length,
    totalCount: entries.length,
    visibleEntries: matching.slice(Math.max(0, matching.length - limit)).reverse(),
  };
}
