import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import characters from '../library/characters.json';
import environments from '../library/environments.json';
import scenario from '../scenarios/market-morning.json';
import {
  createSimulation,
  parseCharacterLibrary,
  parseScenario,
  parseSnapshot,
  serializeSnapshot,
} from '../src/index.js';

describe('scenario validation', () => {
  it('migrates Phase 0 scenarios to the agenda content shape', () => {
    const legacy = structuredClone(scenario) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    delete legacy.behaviorOpportunities;
    delete legacy.socialRelations;
    const migrated = parseScenario(legacy);
    assert.equal(migrated.schemaVersion, 4);
    assert.deepEqual(migrated.agendaGoals, []);
    assert.deepEqual(migrated.behaviorOpportunities, []);
    assert.deepEqual(migrated.disclosureItems, []);
    assert.deepEqual(migrated.disclosureOpportunities, []);
    assert.deepEqual(migrated.dyads, []);
    assert.deepEqual(migrated.taskOperators, []);
    assert.deepEqual(migrated.worldFacts, []);
  });

  it('migrates Phase 1 character and dyad content explicitly', () => {
    const legacyCharacters = structuredClone(characters) as unknown as Record<string, unknown>;
    legacyCharacters.schemaVersion = 2;
    const profiles = legacyCharacters.characters as Record<string, unknown>[];
    for (const profile of profiles) delete profile.disclosure;
    const migratedCharacters = parseCharacterLibrary(legacyCharacters);
    assert.equal(migratedCharacters.schemaVersion, 3);
    assert.equal(migratedCharacters.characters[0]?.disclosure.troughPosition, 0.52);

    const legacyScenario = structuredClone(scenario) as unknown as Record<string, unknown>;
    legacyScenario.schemaVersion = 2;
    delete legacyScenario.dyads;
    delete legacyScenario.disclosureItems;
    delete legacyScenario.disclosureOpportunities;
    legacyScenario.socialRelations = [
      {
        observerId: 'mara',
        subjectId: 'tomas',
        features: { category: 0, familiarity: 0.4, kinship: 0, reciprocity: 0.2, similarity: 0.3 },
      },
    ];
    const migratedScenario = parseScenario(legacyScenario);
    assert.equal(migratedScenario.schemaVersion, 4);
    assert.equal(migratedScenario.dyads[0]?.mode, 'courteous');
    assert.equal(migratedScenario.dyads[0]?.estimateConfidence, 0.1);
  });

  it('migrates relational scenarios and snapshots to the agenda boundary', () => {
    const relationalScenario = structuredClone(scenario) as unknown as Record<string, unknown>;
    relationalScenario.schemaVersion = 3;
    delete relationalScenario.agendaGoals;
    delete relationalScenario.taskOperators;
    delete relationalScenario.worldFacts;
    const migratedScenario = parseScenario(relationalScenario);
    assert.equal(migratedScenario.schemaVersion, 4);
    assert.deepEqual(migratedScenario.agendaGoals, []);

    const snapshot = serializeSnapshot(
      createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario,
      }),
    ) as unknown as Record<string, unknown>;
    snapshot.schemaVersion = 1;
    snapshot.scenario = relationalScenario;
    delete snapshot.agendaDecisions;
    delete snapshot.agendaGoals;
    delete snapshot.intentions;
    delete snapshot.plans;
    delete snapshot.worldFacts;
    delete snapshot.worldRevision;
    const migratedSnapshot = parseSnapshot(snapshot);
    assert.equal(migratedSnapshot.schemaVersion, 2);
    assert.deepEqual(migratedSnapshot.agendaGoals, []);
    assert.deepEqual(migratedSnapshot.worldFacts, []);
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
