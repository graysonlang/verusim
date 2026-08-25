import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activityFeed, activityHeadingLabel } from '../app/activity.js';
import type { TraceEntry } from '../src/model/types.js';

const entries: TraceEntry[] = [
  {
    instanceId: null,
    id: '0:scenario',
    kind: 'scenario',
    second: 28800,
    sequence: 1,
    selection: null,
    summary: 'Market morning loaded',
    terms: [],
    tick: 0,
  },
  {
    instanceId: 'mara',
    id: '1:mara:activity',
    kind: 'activity',
    second: 28860,
    sequence: 1,
    selection: null,
    summary: 'Walked toward the bakery',
    terms: [{ id: 'destination', sources: ['characters.mara.destination'], value: 'bakery' }],
    tick: 1,
  },
  {
    instanceId: 'tomas',
    id: '2:tomas:decision',
    kind: 'decision',
    second: 28920,
    sequence: 1,
    selection: { rule: 'highest-utility-then-authored-order', selectedId: 'wait' },
    summary: 'Waited near the market',
    terms: [],
    tick: 2,
  },
];

const characterNames = new Map([
  ['mara', 'Mara Venn'],
  ['tomas', 'Tomas Reed'],
]);

describe('activity feed', () => {
  it('filters across character, kind, summary, and trace terms', () => {
    assert.deepEqual(
      activityFeed(entries, characterNames, 'mara bakery').visibleEntries.map(entry => entry.id),
      ['1:mara:activity'],
    );
    assert.deepEqual(
      activityFeed(entries, characterNames, 'decision wait').visibleEntries.map(entry => entry.id),
      ['2:tomas:decision'],
    );
    assert.deepEqual(
      activityFeed(entries, characterNames, 'system market').visibleEntries.map(entry => entry.id),
      ['0:scenario'],
    );
  });

  it('reports total and matching counts while showing the newest capped entries first', () => {
    const feed = activityFeed(entries, characterNames, '', 2);
    assert.equal(feed.totalCount, 3);
    assert.equal(feed.matchingCount, 3);
    assert.deepEqual(
      feed.visibleEntries.map(entry => entry.id),
      ['2:tomas:decision', '1:mara:activity'],
    );
  });

  it('formats the heading count from the currently matching entries', () => {
    assert.equal(activityHeadingLabel(activityFeed(entries, characterNames, '')), 'Activity (3)');
    assert.equal(
      activityHeadingLabel(activityFeed(entries, characterNames, 'mara')),
      'Activity (1)',
    );
  });
});
