import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_SCENARIOS, DEFAULT_BUILT_IN_SCENARIO } from '../app/scenarios.js';
import { createSimulation } from '../src/index.js';

describe('built-in scenario catalog', () => {
  it('provides the complete authored scenario set with stable identities', () => {
    assert.deepEqual(
      BUILT_IN_SCENARIOS.map(entry => entry.id),
      [
        'market-morning',
        'alders-edge-town',
        'baker-deadline',
        'disclosure-audience',
        'endicott-margueritte',
        'pottsfield',
        'pottsfield-charter-day',
        'relationship-momentum',
        'innkeeper-coping',
        'cascade-room',
        'narrative-agency',
        'highwayman-road',
        'highwayman-square',
      ],
    );
    assert.equal(DEFAULT_BUILT_IN_SCENARIO.id, 'market-morning');
    assert.equal(new Set(BUILT_IN_SCENARIOS.map(entry => entry.id)).size, 13);
  });

  it('loads every included asset through the regular simulation path', () => {
    for (const entry of BUILT_IN_SCENARIOS) {
      const state = createSimulation(entry.prepared);
      assert.equal(state.scenario.id, entry.id);
      assert.equal(state.scenario.title, entry.title);
      assert.equal(state.scenario.summary, entry.summary);
      assert.ok(state.agents.length > 0);
    }
  });
});
