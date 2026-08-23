import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_SCENARIOS, DEFAULT_BUILT_IN_SCENARIO } from '../app/scenarios.js';
import characters from '../library/characters.json';
import environments from '../library/environments.json';
import highwaymanCharacters from '../library/highwayman-characters.json';
import highwaymanEnvironments from '../library/highwayman-environments.json';
import { createSimulation } from '../src/index.js';

const characterLibrary = {
  characters: [...characters.characters, ...highwaymanCharacters.characters],
  schemaVersion: 5,
};
const environmentLibrary = {
  environments: [...environments.environments, ...highwaymanEnvironments.environments],
  schemaVersion: 1,
};

describe('built-in scenario catalog', () => {
  it('provides the complete authored scenario set with stable identities', () => {
    assert.deepEqual(
      BUILT_IN_SCENARIOS.map(entry => entry.id),
      [
        'market-morning',
        'baker-deadline',
        'disclosure-audience',
        'highwayman-road',
        'highwayman-square',
      ],
    );
    assert.equal(DEFAULT_BUILT_IN_SCENARIO.id, 'market-morning');
    assert.equal(new Set(BUILT_IN_SCENARIOS.map(entry => entry.id)).size, 5);
  });

  it('loads every included asset through the regular simulation path', () => {
    for (const entry of BUILT_IN_SCENARIOS) {
      const state = createSimulation({
        characterLibrary,
        environmentLibrary,
        scenario: entry.scenario,
      });
      assert.equal(state.scenario.id, entry.id);
      assert.equal(state.scenario.title, entry.title);
      assert.equal(state.scenario.summary, entry.summary);
      assert.ok(state.agents.length > 0);
    }
  });
});
