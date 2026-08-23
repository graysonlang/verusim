import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_SCENARIOS, DEFAULT_BUILT_IN_SCENARIO } from '../app/scenarios.js';
import characters from '../library/characters.json';
import copingCharacters from '../library/coping-characters.json';
import copingEnvironments from '../library/coping-environments.json';
import environments from '../library/environments.json';
import highwaymanCharacters from '../library/highwayman-characters.json';
import highwaymanEnvironments from '../library/highwayman-environments.json';
import mindModelCharacters from '../library/mind-model-characters.json';
import normCharacters from '../library/norm-characters.json';
import { createSimulation } from '../src/index.js';

const characterLibrary = {
  characters: [
    ...characters.characters,
    ...copingCharacters.characters,
    ...highwaymanCharacters.characters,
    ...mindModelCharacters.characters,
    ...normCharacters.characters,
  ],
  schemaVersion: 5,
};
const environmentLibrary = {
  environments: [
    ...environments.environments,
    ...copingEnvironments.environments,
    ...highwaymanEnvironments.environments,
  ],
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
        'endicott-margueritte',
        'pottsfield',
        'relationship-momentum',
        'innkeeper-coping',
        'cascade-room',
        'highwayman-road',
        'highwayman-square',
      ],
    );
    assert.equal(DEFAULT_BUILT_IN_SCENARIO.id, 'market-morning');
    assert.equal(new Set(BUILT_IN_SCENARIOS.map(entry => entry.id)).size, 10);
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
