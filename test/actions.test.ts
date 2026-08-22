import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterActions, isActionEnabled, type QuickAction } from '../app/actions.js';

const actions: readonly QuickAction[] = [
  { id: 'open', keywords: ['file', 'scenario'], label: 'Open file', run: () => undefined },
  {
    id: 'play',
    keywords: ['simulation', 'transport'],
    label: 'Play / pause',
    run: () => undefined,
  },
  {
    enabled: () => false,
    id: 'focus',
    keywords: ['agent', 'view'],
    label: 'Focus selected character',
    run: () => undefined,
  },
];

describe('quick actions', () => {
  it('filters every query term across labels and keywords', () => {
    assert.deepEqual(
      filterActions(actions, 'scenario file').map(action => action.id),
      ['open'],
    );
    assert.deepEqual(
      filterActions(actions, 'transport').map(action => action.id),
      ['play'],
    );
    assert.deepEqual(filterActions(actions, 'missing'), []);
  });

  it('keeps enablement separate from searchability', () => {
    assert.equal(isActionEnabled(actions[0] as QuickAction), true);
    assert.equal(isActionEnabled(actions[2] as QuickAction), false);
    assert.deepEqual(
      filterActions(actions, 'focus').map(action => action.id),
      ['focus'],
    );
  });
});
