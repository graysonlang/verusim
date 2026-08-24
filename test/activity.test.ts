import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activityFeed, activityHeadingLabel } from '../app/activity.js';
import type { TraceEntry } from '../src/model/types.js';

const entries: TraceEntry[] = [
  {
    agentId: null,
    id: '0:scenario',
    kind: 'scenario',
    minute: 480,
    selection: null,
    summary: 'Market morning loaded',
    terms: [],
    tick: 0,
  },
  {
    agentId: 'mara',
    id: '1:mara:activity',
    kind: 'activity',
    minute: 481,
    selection: null,
    summary: 'Walked toward the bakery',
    terms: [{ id: 'destination', sources: ['agents.mara.destination'], value: 'bakery' }],
    tick: 1,
  },
  {
    agentId: 'tomas',
    id: '2:tomas:decision',
    kind: 'decision',
    minute: 482,
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
