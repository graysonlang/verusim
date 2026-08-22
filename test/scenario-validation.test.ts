import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import characters from '../library/characters.json';
import environments from '../library/environments.json';
import scenario from '../scenarios/market-morning.json';
import { createSimulation, parseScenario } from '../src/index.js';

describe('scenario validation', () => {
  it('migrates Phase 0 scenarios to the Phase 1 content shape', () => {
    const legacy = structuredClone(scenario) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    delete legacy.behaviorOpportunities;
    delete legacy.socialRelations;
    const migrated = parseScenario(legacy);
    assert.equal(migrated.schemaVersion, 2);
    assert.deepEqual(migrated.behaviorOpportunities, []);
    assert.deepEqual(migrated.socialRelations, []);
  });

  it('reports malformed schedules at their authored path', () => {
    const malformed = structuredClone(scenario);
    malformed.characters[0]?.schedule.reverse();
    assert.throws(
      () => parseScenario(malformed),
      /scenario\.characters\[0\]\.schedule\[1\]\.startMinute/,
    );
  });

  it('rejects missing library references before simulation begins', () => {
    const malformed = structuredClone(scenario);
    const first = malformed.characters[0];
    if (first === undefined) throw new Error('Fixture must contain a character');
    first.characterId = 'missing-character';
    assert.throws(
      () =>
        createSimulation({
          characterLibrary: characters,
          environmentLibrary: environments,
          scenario: malformed,
        }),
      /unknown character "missing-character"/,
    );
  });
});
