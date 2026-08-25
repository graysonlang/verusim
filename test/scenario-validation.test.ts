import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import {
  characters,
  copingCharacters,
  copingEnvironments,
  environments,
  mindModelCharacters,
  normCharacters,
} from './fixtures.js';
import scenario from '../content/scenarios/market-morning.json';
import { downgradeScenario, downgradeSnapshotVocabulary } from './legacy.js';
import mindModelScenario from '../content/scenarios/endicott-margueritte.json';
import normScenario from '../content/scenarios/pottsfield.json';
import relationshipScenario from '../content/scenarios/relationship-momentum.json';
import cascadeScenario from '../content/scenarios/cascade-room.json';
import narrativeScenario from '../content/scenarios/narrative-agency.json';
import {
  advanceSimulation,
  createResourceCatalog,
  createSimulation,
  parseCharacterLibrary,
  parseEnvironmentLibrary,
  parseScenario,
  parseSnapshot,
  prepareScenario,
  serializeSnapshot,
} from '../src/index.js';

const resourceCatalog = createResourceCatalog(BUILT_IN_RESOURCES);

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

function downgradeScenarioReferences(
  value: unknown,
  schemaVersion: number,
): Record<string, unknown> {
  return downgradeScenario(value, schemaVersion);
}

function downgradeSnapshotReferences(
  snapshot: Record<string, unknown>,
  schemaVersion: number,
): void {
  const environment = snapshot.environment as { resourceId: string };
  snapshot.environmentId = environment.resourceId;
  delete snapshot.environment;
  delete snapshot.resourceLock;
  for (const agent of snapshot.characters as Array<Record<string, unknown>>) {
    const profile = agent.profile as { resourceId: string };
    agent.profileId = profile.resourceId;
    delete agent.profile;
  }
  snapshot.schemaVersion = schemaVersion;
  downgradeSnapshotVocabulary(snapshot);
}

describe('scenario validation', () => {
  it('migrates Phase 0 scenarios to the agenda content shape', () => {
    const legacy = downgradeScenarioReferences(scenario, 1);
    delete legacy.behaviorOpportunities;
    delete legacy.socialRelations;
    const migrated = parseScenario(legacy);
    assert.equal(migrated.schemaVersion, 18);
    assert.deepEqual(migrated.agendaGoals, []);
    assert.deepEqual(migrated.behaviorOpportunities, []);
    assert.deepEqual(migrated.disclosureItems, []);
    assert.deepEqual(migrated.disclosureOpportunities, []);
    assert.deepEqual(migrated.dyads, []);
    assert.deepEqual(migrated.observationEvents, []);
    assert.deepEqual(migrated.legacyLocalNorms, []);
    assert.deepEqual(migrated.relationshipEvents, []);
    assert.deepEqual(migrated.relationshipRequests, []);
    assert.deepEqual(migrated.appraisalEvents, []);
    assert.deepEqual(migrated.characters[0]?.normPerspectives, []);
    assert.equal(migrated.characters[0]?.position.layerId, 'surface');
    assert.deepEqual(migrated.taskOperators, []);
    assert.deepEqual(migrated.worldFacts, []);
    assert.deepEqual(migrated.environmentConditions, {
      season: 'spring',
      temperatureCelsius: 15,
      weather: 'clear',
    });
  });

  it('migrates Phase 1 character and dyad content explicitly', () => {
    const legacyCharacters = structuredClone(characters) as unknown as Record<string, unknown>;
    legacyCharacters.schemaVersion = 2;
    const profiles = legacyCharacters.characters as Record<string, unknown>[];
    for (const profile of profiles) delete profile.disclosure;
    const migratedCharacters = parseCharacterLibrary(legacyCharacters);
    assert.equal(migratedCharacters.schemaVersion, 7);
    assert.equal(migratedCharacters.characters[0]?.capabilities.acuity, 0.5);
    assert.equal(migratedCharacters.characters[0]?.disclosure.troughPosition, 0.52);
    assert.equal(migratedCharacters.characters[0]?.physical.sex, 'unspecified');
    assert.equal(migratedCharacters.characters[0]?.cascadePriors.fawn, 0.5);
    assert.equal(migratedCharacters.characters[0]?.narrativeClaims[0]?.id, 'claim-1');

    const relationalCharacters = structuredClone(characters) as unknown as Record<string, unknown>;
    relationalCharacters.schemaVersion = 3;
    for (const profile of relationalCharacters.characters as Record<string, unknown>[]) {
      delete profile.capabilities;
    }
    const migratedRelationalCharacters = parseCharacterLibrary(relationalCharacters);
    assert.equal(migratedRelationalCharacters.schemaVersion, 7);
    assert.equal(migratedRelationalCharacters.characters[0]?.capabilities.expressiveControl, 0.5);

    const capabilityCharacters = structuredClone(characters) as unknown as Record<string, unknown>;
    capabilityCharacters.schemaVersion = 4;
    for (const profile of capabilityCharacters.characters as Record<string, unknown>[]) {
      delete profile.physical;
    }
    const migratedCapabilityCharacters = parseCharacterLibrary(capabilityCharacters);
    assert.equal(migratedCapabilityCharacters.schemaVersion, 7);
    assert.equal(migratedCapabilityCharacters.characters[0]?.capabilities.acuity, 0.72);
    assert.deepEqual(migratedCapabilityCharacters.characters[0]?.physical.build, {
      heightClass: 'average',
      weightClass: 'average',
    });

    const migratedEnvironments = parseEnvironmentLibrary(environments);
    assert.equal(migratedEnvironments.schemaVersion, 3);
    assert.deepEqual(migratedEnvironments.environments[0]?.outletAffordances, []);

    const legacyScenario = downgradeScenarioReferences(scenario, 2);
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
    assert.equal(migratedScenario.schemaVersion, 18);
    assert.equal(migratedScenario.dyads[0]?.mode, 'courteous');
    assert.equal(migratedScenario.dyads[0]?.estimateConfidence, 0.1);
    assert.equal(migratedScenario.dyads[0]?.suspicion, 0);
    assert.equal(migratedScenario.dyads[0]?.exposureDebt, 0);
    assert.deepEqual(migratedScenario.observationEvents, []);
  });

  it('migrates relational scenarios and snapshots to the agenda boundary', () => {
    const relationalScenario = downgradeScenarioReferences(scenario, 3);
    delete relationalScenario.agendaGoals;
    delete relationalScenario.taskOperators;
    delete relationalScenario.worldFacts;
    const migratedScenario = parseScenario(relationalScenario);
    assert.equal(migratedScenario.schemaVersion, 18);
    assert.deepEqual(migratedScenario.agendaGoals, []);

    const snapshot = serializeSnapshot(
      createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario,
      }),
    ) as unknown as Record<string, unknown>;
    replaceWithLegacyTrace(snapshot);
    downgradeSnapshotReferences(snapshot, 1);
    snapshot.scenario = relationalScenario;
    delete snapshot.agendaDecisions;
    delete snapshot.agendaGoals;
    delete snapshot.intentions;
    delete snapshot.plans;
    delete snapshot.worldFacts;
    delete snapshot.worldRevision;
    const migratedSnapshot = parseSnapshot(snapshot);
    assert.equal(migratedSnapshot.schemaVersion, 18);
    assert.equal(migratedSnapshot.trace.schemaVersion, 2);
    assert.equal(migratedSnapshot.trace.entries[0]?.terms[0]?.id, 'legacy-cause');
    assert.deepEqual(migratedSnapshot.agendaGoals, []);
    assert.deepEqual(migratedSnapshot.worldFacts, []);
    assert.equal(migratedSnapshot.characters[0]?.position.layerId, 'surface');
    assert.equal(migratedSnapshot.characters[0]?.destination.layerId, 'surface');
    assert.deepEqual(migratedSnapshot.observations, []);
    assert.deepEqual(migratedSnapshot.resolvedObservationEventIds, []);
    assert.deepEqual(migratedSnapshot.relationshipDecisions, []);
    assert.deepEqual(migratedSnapshot.resolvedRelationshipEventIds, []);
    assert.deepEqual(migratedSnapshot.resolvedRelationshipRequestIds, []);
    assert.deepEqual(migratedSnapshot.appraisalRecords, []);
    assert.deepEqual(migratedSnapshot.resolvedAppraisalEventIds, []);

    const agendaSnapshot = serializeSnapshot(
      createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario,
      }),
    ) as unknown as Record<string, unknown>;
    replaceWithLegacyTrace(agendaSnapshot);
    downgradeSnapshotReferences(agendaSnapshot, 2);
    const migratedAgendaSnapshot = parseSnapshot(agendaSnapshot);
    assert.equal(migratedAgendaSnapshot.schemaVersion, 18);
    assert.equal(migratedAgendaSnapshot.trace.schemaVersion, 2);
  });

  it('migrates legacy schedule activities to explicit recovery modes', () => {
    const legacy = downgradeScenarioReferences(scenario, 4);
    for (const placement of legacy.characters as Array<Record<string, unknown>>) {
      for (const block of placement.schedule as Array<Record<string, unknown>>) {
        delete block.recoveryMode;
      }
    }

    const migrated = parseScenario(legacy);
    assert.equal(migrated.schemaVersion, 18);
    assert.equal(migrated.characters[0]?.schedule[0]?.recoveryMode, 'sleep');
    assert.equal(migrated.characters[0]?.schedule[1]?.recoveryMode, 'none');

    const snapshot = serializeSnapshot(
      createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario,
      }),
    ) as unknown as Record<string, unknown>;
    const snapshotAgents = snapshot.characters as Array<Record<string, unknown>>;
    const snapshotSchedule = snapshotAgents[0]?.schedule as Array<Record<string, unknown>>;
    delete snapshotSchedule[0]?.recoveryMode;
    assert.equal(parseSnapshot(snapshot).characters[0]?.schedule[0]?.recoveryMode, 'sleep');
  });

  it('adds neutral atmosphere without rewriting version 5 recovery data', () => {
    const prior = downgradeScenarioReferences(scenario, 5);
    delete prior.environmentConditions;
    const placements = prior.characters as Array<Record<string, unknown>>;
    const schedule = placements[0]?.schedule as Array<Record<string, unknown>>;
    assert.equal(schedule[0]?.recoveryMode, 'sleep');

    const migrated = parseScenario(prior);
    assert.equal(migrated.schemaVersion, 18);
    assert.equal(migrated.characters[0]?.schedule[0]?.recoveryMode, 'sleep');
    assert.deepEqual(migrated.environmentConditions, {
      season: 'spring',
      temperatureCelsius: 15,
      weather: 'clear',
    });
  });

  it('adds observation state without rewriting version 6 atmosphere data', () => {
    const prior = downgradeScenarioReferences(mindModelScenario, 6);
    delete prior.observationEvents;
    for (const dyad of prior.dyads as Array<Record<string, unknown>>) delete dyad.suspicion;

    const migrated = parseScenario(prior);
    assert.equal(migrated.schemaVersion, 18);
    assert.deepEqual(migrated.observationEvents, []);
    assert.equal(migrated.dyads[0]?.suspicion, 0);
    assert.deepEqual(migrated.environmentConditions, mindModelScenario.environmentConditions);
  });

  it('adds local norm state without rewriting version 7 observations', () => {
    const prior = downgradeScenarioReferences(mindModelScenario, 7);
    const migrated = parseScenario(prior);

    assert.equal(migrated.schemaVersion, 18);
    assert.deepEqual(migrated.legacyLocalNorms, []);
    assert.ok(migrated.characters.every(placement => placement.normPerspectives.length === 0));
    assert.ok(migrated.observationEvents.every(event => event.eventType === 'mind-model'));

    const observed = advanceSimulation(
      createSimulation({
        characterLibrary: mindModelCharacters,
        environmentLibrary: environments,
        scenario: mindModelScenario,
      }),
      2,
    );
    const snapshot = serializeSnapshot(observed) as unknown as Record<string, unknown>;
    downgradeSnapshotReferences(snapshot, 4);
    const migratedSnapshot = parseSnapshot(snapshot);
    assert.equal(migratedSnapshot.schemaVersion, 18);
    assert.ok(migratedSnapshot.observations.length > 0);
    assert.ok(migratedSnapshot.observations.every(event => event.eventType === 'mind-model'));
    assert.ok(
      migratedSnapshot.scenario.observationEvents.every(event => event.eventType === 'mind-model'),
    );
  });

  it('migrates the bounded scenario-local norm shape into stable norm addresses', () => {
    const legacy = structuredClone(normScenario) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 13;
    legacy.localNorms = [
      {
        id: 'harvest-observance',
        label: 'The harvest observance preserves a fair communal order',
        compatibilityTurns: { fairness: 0.8 },
      },
    ];
    delete legacy.socialContractPlacements;
    for (const placement of legacy.characters as Array<Record<string, unknown>>) {
      for (const perspective of placement.normPerspectives as Array<Record<string, unknown>>) {
        perspective.normId = 'harvest-observance';
        delete perspective.norm;
      }
    }
    const event = (legacy.observationEvents as Array<Record<string, unknown>>)[0];
    assert.ok(event);
    event.normId = 'harvest-observance';
    delete event.norm;

    const migrated = parseScenario(legacy);
    assert.equal(migrated.schemaVersion, 18);
    assert.equal(migrated.legacyLocalNorms[0]?.address.resourceId, 'harvest-observance');
    assert.equal(
      migrated.characters[0]?.normPerspectives[0]?.norm.resourceId,
      'harvest-observance',
    );
    assert.ok(migrated.observationEvents[0]?.eventType === 'norm');
    assert.equal(migrated.observationEvents[0].norm.resourceId, 'harvest-observance');
    assert.deepEqual(migrated.socialContractPlacements, []);

    const state = createSimulation({
      characterLibrary: normCharacters,
      environmentLibrary: environments,
      scenario: migrated,
    });
    assert.equal(state.norms[0]?.address.resourceId, 'harvest-observance');
  });

  it('adds coping inputs without rewriting version 9 relationship state', () => {
    const prior = downgradeScenarioReferences(relationshipScenario, 9);
    delete prior.appraisalEvents;
    for (const placement of prior.characters as Array<Record<string, unknown>>) {
      for (const block of placement.schedule as Array<Record<string, unknown>>) {
        delete block.resourceDrainsPerHour;
        delete block.maskingDemand;
      }
    }
    const migrated = parseScenario(prior);
    assert.equal(migrated.schemaVersion, 18);
    assert.deepEqual(migrated.appraisalEvents, []);
    assert.ok(
      migrated.characters.every(placement =>
        placement.schedule.every(
          block =>
            block.maskingDemand === null && Object.keys(block.resourceDrainsPerHour).length === 0,
        ),
      ),
    );
    assert.equal(migrated.dyads[0]?.exposureDebt, 0);

    const snapshot = serializeSnapshot(
      createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario: relationshipScenario,
      }),
    ) as unknown as Record<string, unknown>;
    downgradeSnapshotReferences(snapshot, 6);
    snapshot.scenario = prior;
    delete snapshot.appraisalRecords;
    delete snapshot.resolvedAppraisalEventIds;
    for (const agent of snapshot.characters as Array<Record<string, unknown>>) {
      delete agent.cascadeDwellUntilMinute;
      delete agent.cascadeLoad;
      delete agent.cascadeTargetId;
      delete agent.currentOutlet;
      delete agent.outletHistory;
    }
    const migratedSnapshot = parseSnapshot(snapshot);
    assert.equal(migratedSnapshot.schemaVersion, 18);
    assert.deepEqual(migratedSnapshot.appraisalRecords, []);
    assert.deepEqual(migratedSnapshot.resolvedAppraisalEventIds, []);
    assert.ok(migratedSnapshot.characters.every(agent => agent.currentOutlet === null));
  });

  it('adds narrative agency without rewriting version 10 coping state', () => {
    const prior = downgradeScenarioReferences(cascadeScenario, 10);
    delete prior.aspirationOpportunities;
    delete prior.narrativeEvents;
    delete prior.reputationGroups;
    for (const placement of prior.characters as Array<Record<string, unknown>>) {
      delete placement.agency;
      delete placement.narrativeOverrides;
    }
    for (const dyad of prior.dyads as Array<Record<string, unknown>>) {
      delete dyad.validatorClaimIds;
    }
    const migrated = parseScenario(prior);
    assert.equal(migrated.schemaVersion, 18);
    assert.equal(migrated.appraisalEvents.length, cascadeScenario.appraisalEvents.length);
    assert.deepEqual(migrated.aspirationOpportunities, []);
    assert.deepEqual(migrated.narrativeEvents, []);
    assert.ok(migrated.characters.every(placement => placement.agency === 'responder'));

    const snapshot = serializeSnapshot(
      advanceSimulation(
        createSimulation({
          characterLibrary: characters,
          environmentLibrary: environments,
          scenario: cascadeScenario,
        }),
        1,
      ),
    ) as unknown as Record<string, unknown>;
    downgradeSnapshotReferences(snapshot, 7);
    snapshot.scenario = prior;
    delete snapshot.narrativeRecords;
    delete snapshot.reputations;
    delete snapshot.resolvedAspirationOpportunityIds;
    delete snapshot.resolvedNarrativeEventIds;
    for (const agent of snapshot.characters as Array<Record<string, unknown>>) {
      delete agent.narrative;
    }
    const migratedSnapshot = parseSnapshot(snapshot);
    assert.equal(migratedSnapshot.schemaVersion, 18);
    assert.ok(migratedSnapshot.characters.every(agent => agent.narrative === null));
    assert.ok(migratedSnapshot.characters.some(agent => agent.cascade !== 'none'));
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

  it('validates authored environment conditions', () => {
    const malformed = structuredClone(scenario);
    malformed.environmentConditions.weather = 'meteor-shower';
    assert.throws(
      () => parseScenario(malformed),
      /scenario\.environmentConditions\.weather: expected a known weather identifier/,
    );

    malformed.environmentConditions.weather = 'clear';
    malformed.environmentConditions.temperatureCelsius = 100;
    assert.throws(
      () => parseScenario(malformed),
      /scenario\.environmentConditions\.temperatureCelsius/,
    );
  });

  it('validates authored social observations', () => {
    const malformed = structuredClone(mindModelScenario);
    const first = malformed.observationEvents[0];
    assert.ok(first);
    first.diagnosticity = 2;
    assert.throws(
      () => parseScenario(malformed),
      /scenario\.observationEvents\[0\]\.diagnosticity/,
    );

    first.diagnosticity = 0.25;
    first.observerIds = ['missing-observer'];
    assert.throws(
      () =>
        createSimulation({
          characterLibrary: mindModelCharacters,
          environmentLibrary: environments,
          scenario: malformed,
        }),
      /unknown agent "missing-observer"/,
    );
  });

  it('validates local norm references at their authored paths', () => {
    const malformed = structuredClone(normScenario);
    const perspective = malformed.characters[1]?.normPerspectives[0];
    const event = malformed.observationEvents[0];
    assert.ok(perspective);
    assert.ok(event);
    perspective.norm.resourceId = 'missing-norm';
    assert.throws(
      () => prepareScenario({ catalog: resourceCatalog, scenario: malformed }),
      /scenario\.characters\[1\]\.normPerspectives\[0\]\.norm: unknown norm resource "verusim:norm:missing-norm"/,
    );

    perspective.norm.resourceId = 'pottsfield-harvest-observance';
    event.norm.resourceId = 'missing-norm';
    assert.throws(
      () => prepareScenario({ catalog: resourceCatalog, scenario: malformed }),
      /scenario\.observationEvents\[0\]\.norm: unknown norm resource "verusim:norm:missing-norm"/,
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
      instanceId: 'mara',
      id: '0:mara:gate:emergency',
      kind: 'gate',
      minute: snapshot.minute,
      sequence: 1,
      selection: { rule: 'preempt-gate', selectedId: 'emergency' },
      summary: 'Emergency preempted ordinary appraisal',
      terms: [
        {
          id: 'somatic-level',
          sources: ['characters.mara.somatic.level'],
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

  it('rejects every pre-start event at its indexed authored path', () => {
    const eventCases: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ['appraisalEvents', { instanceId: 'mara', atMinute: 469, id: 'pre-start-appraisal' }],
      [
        'aspirationOpportunities',
        {
          actorId: 'mara',
          atMinute: 469,
          claimId: 'claim-1',
          id: 'pre-start-aspiration',
          label: 'Already available',
        },
      ],
      [
        'behaviorOpportunities',
        { actorId: 'mara', atMinute: 469, id: 'pre-start-behavior', targetId: null },
      ],
      [
        'disclosureOpportunities',
        {
          atMinute: 469,
          id: 'pre-start-disclosure',
          itemId: 'private-matter',
          ownerId: 'mara',
        },
      ],
      [
        'displayEvents',
        {
          atMinute: 469,
          displayId: 'old-display',
          id: 'pre-start-display',
          wearerId: 'mara',
        },
      ],
      [
        'incidentEvents',
        {
          actorId: null,
          affectedInstanceId: 'mara',
          atMinute: 469,
          id: 'pre-start-incident',
        },
      ],
      ['narrativeEvents', { atMinute: 469, id: 'pre-start-narrative' }],
      ['observationEvents', { atMinute: 469, id: 'pre-start-observation', subjectId: 'mara' }],
      [
        'relationshipEvents',
        {
          atMinute: 469,
          id: 'pre-start-relationship',
          observerId: 'mara',
          subjectId: 'tomas',
        },
      ],
      [
        'relationshipRequests',
        {
          atMinute: 469,
          id: 'pre-start-request',
          requesterId: 'mara',
          responderId: 'tomas',
        },
      ],
      ['somaticEvents', { instanceId: 'mara', atMinute: 469, id: 'pre-start-somatic' }],
    ];

    for (const [field, event] of eventCases) {
      const malformed = structuredClone(parseScenario(scenario)) as unknown as Record<
        string,
        unknown
      >;
      malformed[field] = [event];
      assert.throws(
        () => parseScenario(malformed),
        new RegExp(`scenario\\.${field}\\[0\\]\\.atMinute`),
        field,
      );
    }
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
    first.physical.build.heightClass = 'towering' as never;
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

  it('reports malformed coping content at its authored path', () => {
    const malformedCharacters = structuredClone(copingCharacters);
    const firstCharacter = malformedCharacters.characters[0];
    assert.ok(firstCharacter);
    const firstPreference = firstCharacter.outletPreferences[0];
    assert.ok(firstPreference);
    firstPreference.operation = 'brood' as never;
    assert.throws(
      () => parseCharacterLibrary(malformedCharacters),
      /characterLibrary\.characters\[0\]\.outletPreferences\[0\]\.operation/,
    );

    const malformedEnvironments = structuredClone(copingEnvironments);
    const firstAffordance = malformedEnvironments.environments[0]?.outletAffordances[0];
    assert.ok(firstAffordance);
    firstAffordance.durationMinutes = 0;
    assert.throws(
      () => parseEnvironmentLibrary(malformedEnvironments),
      /environmentLibrary\.environments\[0\]\.outletAffordances\[0\]\.durationMinutes/,
    );

    const malformedScenario = structuredClone(cascadeScenario);
    const firstEvent = malformedScenario.appraisalEvents[0];
    assert.ok(firstEvent);
    firstEvent.copingPotential = 2;
    assert.throws(
      () => parseScenario(malformedScenario),
      /scenario\.appraisalEvents\[0\]\.copingPotential/,
    );
  });

  it('reports malformed narrative references at their authored path', () => {
    const malformed = structuredClone(narrativeScenario);
    const event = malformed.narrativeEvents[0];
    assert.ok(event && event.eventType === 'self-deprecation-agreement');
    event.claimId = 'missing-claim';
    assert.throws(
      () =>
        createSimulation({
          characterLibrary: characters,
          environmentLibrary: environments,
          scenario: malformed,
        }),
      /scenario\.narrativeEvents\[0\]\.claimId: unknown actor narrative claim/,
    );
  });

  it('rejects missing library references before simulation begins', () => {
    const malformed = structuredClone(scenario);
    const first = malformed.characters[0];
    if (first === undefined) throw new Error('Fixture must contain a character');
    first.profile.resourceId = 'missing-character';
    assert.throws(
      () =>
        createSimulation({
          characterLibrary: characters,
          environmentLibrary: environments,
          scenario: malformed,
        }),
      /unknown resource "verusim:character-profile:missing-character"/,
    );
  });
});
