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

function replaceWithLegacyTrace(snapshot: Record<string, unknown>): void {
  const currentTrace = snapshot.trace as {
    entries: Array<Record<string, unknown>>;
  };
  snapshot.trace = currentTrace.entries.map(entry => {
    const legacyEntry = { ...entry };
    const terms = legacyEntry.terms as Array<{ id: string; value: unknown }>;
    delete legacyEntry.selection;
    delete legacyEntry.terms;
    legacyEntry.causes = terms.map(term => `${term.id}:${String(term.value)}`);
    return legacyEntry;
  });
}

describe('scenario validation', () => {
  it('migrates Phase 0 scenarios to the agenda content shape', () => {
    const legacy = structuredClone(scenario) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    delete legacy.behaviorOpportunities;
    delete legacy.socialRelations;
    const migrated = parseScenario(legacy);
    assert.equal(migrated.schemaVersion, 5);
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
    assert.equal(migratedCharacters.schemaVersion, 5);
    assert.equal(migratedCharacters.characters[0]?.capabilities.acuity, 0.5);
    assert.equal(migratedCharacters.characters[0]?.disclosure.troughPosition, 0.52);
    assert.equal(migratedCharacters.characters[0]?.physical.sex, 'unspecified');

    const relationalCharacters = structuredClone(characters) as unknown as Record<string, unknown>;
    relationalCharacters.schemaVersion = 3;
    for (const profile of relationalCharacters.characters as Record<string, unknown>[]) {
      delete profile.capabilities;
    }
    const migratedRelationalCharacters = parseCharacterLibrary(relationalCharacters);
    assert.equal(migratedRelationalCharacters.schemaVersion, 5);
    assert.equal(migratedRelationalCharacters.characters[0]?.capabilities.expressiveControl, 0.5);

    const capabilityCharacters = structuredClone(characters) as unknown as Record<string, unknown>;
    capabilityCharacters.schemaVersion = 4;
    for (const profile of capabilityCharacters.characters as Record<string, unknown>[]) {
      delete profile.physical;
    }
    const migratedCapabilityCharacters = parseCharacterLibrary(capabilityCharacters);
    assert.equal(migratedCapabilityCharacters.schemaVersion, 5);
    assert.equal(migratedCapabilityCharacters.characters[0]?.capabilities.acuity, 0.72);
    assert.deepEqual(migratedCapabilityCharacters.characters[0]?.physical.build, {
      heightClass: 'average',
      weightClass: 'average',
    });

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
    assert.equal(migratedScenario.schemaVersion, 5);
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
    assert.equal(migratedScenario.schemaVersion, 5);
    assert.deepEqual(migratedScenario.agendaGoals, []);

    const snapshot = serializeSnapshot(
      createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario,
      }),
    ) as unknown as Record<string, unknown>;
    replaceWithLegacyTrace(snapshot);
    snapshot.schemaVersion = 1;
    snapshot.scenario = relationalScenario;
    delete snapshot.agendaDecisions;
    delete snapshot.agendaGoals;
    delete snapshot.intentions;
    delete snapshot.plans;
    delete snapshot.worldFacts;
    delete snapshot.worldRevision;
    const migratedSnapshot = parseSnapshot(snapshot);
    assert.equal(migratedSnapshot.schemaVersion, 3);
    assert.equal(migratedSnapshot.trace.schemaVersion, 1);
    assert.equal(migratedSnapshot.trace.entries[0]?.terms[0]?.id, 'legacy-cause');
    assert.deepEqual(migratedSnapshot.agendaGoals, []);
    assert.deepEqual(migratedSnapshot.worldFacts, []);

    const agendaSnapshot = serializeSnapshot(
      createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario,
      }),
    ) as unknown as Record<string, unknown>;
    replaceWithLegacyTrace(agendaSnapshot);
    agendaSnapshot.schemaVersion = 2;
    const migratedAgendaSnapshot = parseSnapshot(agendaSnapshot);
    assert.equal(migratedAgendaSnapshot.schemaVersion, 3);
    assert.equal(migratedAgendaSnapshot.trace.schemaVersion, 1);
  });

  it('migrates legacy schedule activities to explicit recovery modes', () => {
    const legacy = structuredClone(scenario) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 4;
    for (const placement of legacy.characters as Array<Record<string, unknown>>) {
      for (const block of placement.schedule as Array<Record<string, unknown>>) {
        delete block.recoveryMode;
      }
    }

    const migrated = parseScenario(legacy);
    assert.equal(migrated.schemaVersion, 5);
    assert.equal(migrated.characters[0]?.schedule[0]?.recoveryMode, 'sleep');
    assert.equal(migrated.characters[0]?.schedule[1]?.recoveryMode, 'none');

    const snapshot = serializeSnapshot(
      createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario,
      }),
    ) as unknown as Record<string, unknown>;
    const snapshotAgents = snapshot.agents as Array<Record<string, unknown>>;
    const snapshotSchedule = snapshotAgents[0]?.schedule as Array<Record<string, unknown>>;
    delete snapshotSchedule[0]?.recoveryMode;
    assert.equal(parseSnapshot(snapshot).agents[0]?.schedule[0]?.recoveryMode, 'sleep');
  });

  it('accepts only known optional initial time rates', () => {
    const authored = structuredClone(scenario) as unknown as Record<string, unknown>;
    authored.initialTimeRate = '10x';
    assert.equal(parseScenario(authored).initialTimeRate, '10x');

    authored.initialTimeRate = 'warp-speed';
    assert.throws(
      () => parseScenario(authored),
      /scenario\.initialTimeRate: expected a known time rate identifier/,
    );
  });

  it('requires explicit gate events in the versioned causal trace', () => {
    const snapshot = serializeSnapshot(
      createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario,
      }),
    );
    snapshot.trace.entries.push({
      agentId: 'mara',
      id: '0:mara:gate:emergency',
      kind: 'gate',
      minute: snapshot.minute,
      selection: { rule: 'preempt-gate', selectedId: 'emergency' },
      summary: 'Emergency preempted ordinary appraisal',
      terms: [
        {
          id: 'somatic-level',
          sources: ['agents.mara.somatic.level'],
          value: 3,
        },
      ],
      tick: snapshot.tick,
    });
    assert.deepEqual(parseSnapshot(snapshot), snapshot);

    const malformed = structuredClone(snapshot);
    const gate = malformed.trace.entries.at(-1);
    assert.ok(gate);
    gate.selection = null;
    assert.throws(
      () => parseSnapshot(malformed),
      /snapshot\.trace\.entries\[.*\]\.selection: gate entries require an explicit selection/,
    );
  });

  it('reports malformed schedules at their authored path', () => {
    const malformed = structuredClone(scenario);
    malformed.characters[0]?.schedule.reverse();
    assert.throws(
      () => parseScenario(malformed),
      /scenario\.characters\[0\]\.schedule\[1\]\.startMinute/,
    );
  });

  it('reports malformed capabilities at their authored path', () => {
    const malformed = structuredClone(characters);
    const first = malformed.characters[0];
    assert.ok(first);
    first.capabilities.acuity = 1.2;
    assert.throws(
      () => parseCharacterLibrary(malformed),
      /characterLibrary\.characters\[0\]\.capabilities\.acuity/,
    );
  });

  it('reports malformed physical profiles at their authored path', () => {
    const malformed = structuredClone(characters);
    const first = malformed.characters[0];
    assert.ok(first);
    first.physical.build.heightClass = 'towering';
    assert.throws(
      () => parseCharacterLibrary(malformed),
      /characterLibrary\.characters\[0\]\.physical\.build\.heightClass/,
    );

    first.physical.build.heightClass = 'average';
    first.physical.ageYears = 10;
    assert.throws(
      () => parseCharacterLibrary(malformed),
      /characterLibrary\.characters\[0\]\.formativeEvents\[0\]\.age/,
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
