import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { characters, environments } from './fixtures.js';
import scenario from '../content/scenarios/market-morning.json';
import {
  VALUE_IDS,
  advanceSimulation,
  classifyMovementSpeed,
  createSimulation,
  createSimulationFromSnapshot,
  describeCharacter,
  parseScenario,
  parseSnapshot,
  serializeScenario,
  serializeSnapshot,
  setCharacterResource,
  setCharacterValueCharge,
  type RecoveryMode,
  type ScenarioFile,
  type CharacterInstance,
} from '../src/index.js';

function starterSimulation() {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario,
  });
}

function recoverySimulation(mode: RecoveryMode) {
  const authored = structuredClone(scenario) as unknown as ScenarioFile;
  authored.startSecond = 0;
  authored.ambientTurnsPerHour = {};
  const mara = authored.characters.find(placement => placement.instanceId === 'mara');
  assert.ok(mara);
  mara.initialResources = {
    executiveBudget: 0.1,
    physicalStamina: 0.1,
    regulationReserve: 0.1,
    socialBattery: 0.1,
  };
  const firstBlock = mara.schedule[0];
  assert.ok(firstBlock);
  firstBlock.activity = 'Quietly calibrating a clock';
  firstBlock.recoveryMode = mode;
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario: authored,
  });
}

function neutralAgent(agent: CharacterInstance): CharacterInstance {
  const values = Object.fromEntries(
    VALUE_IDS.map(valueId => [
      valueId,
      { ...agent.values[valueId], charge: 0, deficitIntegral: 0 },
    ]),
  ) as CharacterInstance['values'];
  return { ...agent, values };
}

describe('simulation runtime', () => {
  it('resolves reusable character and environment references', () => {
    const state = starterSimulation();
    assert.equal(state.scenario.id, 'market-morning');
    assert.equal(state.environment.layoutId, 'alders-edge');
    assert.deepEqual(
      state.characters.map(agent => agent.profile.name),
      ['Mara Vale', 'Tomas Reed', 'Nessa Arden', 'Elian Voss', 'Sera Dane'],
    );
  });

  it('advances deterministically through the same path used by the workbench', () => {
    const first = advanceSimulation(starterSimulation(), 60);
    const second = advanceSimulation(starterSimulation(), 60);
    assert.deepEqual(first, second);
    assert.equal(first.second, 31800);

    const mara = first.characters.find(agent => agent.id === 'mara');
    assert.ok(mara);
    assert.equal(mara.currentLocationId, 'wayfarer-inn');
    assert.equal(mara.currentActivity, 'Opening the common room');
    assert.ok(Math.abs(mara.values.safety.charge - 0.108) < 1e-12);
    assert.ok(
      first.trace.entries.some(entry => entry.instanceId === 'mara' && entry.kind === 'activity'),
    );
  });

  it('derives one legible concern from the full value state', () => {
    const state = starterSimulation();
    const tomas = state.characters.find(agent => agent.id === 'tomas');
    assert.ok(tomas);
    const observation = describeCharacter(tomas);
    assert.equal(observation.dominantValue, 'respect');
    assert.equal(observation.stateOfMind, 'Protecting respect');
  });

  it('classifies current movement independently from authored maximum walking pace', () => {
    assert.deepEqual([0, 8, 20, 45, 84, 150, 240, 360].map(classifyMovementSpeed), [
      'still',
      'crawling',
      'plodding',
      'strolling',
      'walking',
      'jogging',
      'running',
      'sprinting',
    ]);

    const mara = starterSimulation().characters.find(agent => agent.id === 'mara');
    assert.ok(mara);
    const moving = describeCharacter({
      ...mara,
      destination: { ...mara.position, x: mara.position.x + 100 },
    });
    const arrived = describeCharacter({ ...mara, destination: { ...mara.position } });
    assert.equal(moving.movementMetersPerMinute, mara.walkingMetersPerMinute);
    assert.equal(moving.movementSpeedClass, 'walking');
    assert.equal(arrived.movementMetersPerMinute, 0);
    assert.equal(arrived.movementSpeedClass, 'still');

    const tomas = starterSimulation().characters.find(agent => agent.id === 'tomas');
    assert.ok(tomas);
    assert.ok(Math.abs(tomas.walkingMetersPerMinute - 83 * 1.04 * 0.94) < 1e-12);
  });

  it('lets depleted social battery impair otherwise neutral mood', () => {
    const mara = starterSimulation().characters.find(agent => agent.id === 'mara');
    assert.ok(mara);
    const neutral = neutralAgent(mara);
    const rested = describeCharacter({
      ...neutral,
      resources: { ...neutral.resources, physicalStamina: 1, socialBattery: 1 },
    });
    const depleted = describeCharacter({
      ...neutral,
      resources: { ...neutral.resources, physicalStamina: 1, socialBattery: 0 },
    });

    assert.equal(rested.mood, 'steady');
    assert.equal(rested.resourceStrain, 0);
    assert.equal(depleted.mood, 'low');
    assert.ok(Math.abs(depleted.resourceStrain - 0.38) < 1e-12);
    assert.ok(Math.abs(depleted.valence - (rested.valence - 0.38)) < 1e-12);
  });

  it('recharges resources from explicit sleep, rest, and break schedules', () => {
    const recovered = new Map<RecoveryMode, CharacterInstance>();
    for (const mode of ['break', 'rest', 'sleep'] as const) {
      const advanced = advanceSimulation(recoverySimulation(mode), 60);
      const mara = advanced.characters.find(agent => agent.id === 'mara');
      assert.ok(mara);
      recovered.set(mode, mara);
      for (const amount of Object.values(mara.resources)) assert.ok(amount > 0.1);
      const resourceTrace = advanced.trace.entries.find(
        entry => entry.instanceId === 'mara' && entry.kind === 'resource',
      );
      assert.ok(resourceTrace);
      assert.equal(resourceTrace.terms.find(term => term.id === 'recovery-mode')?.value, mode);
    }

    const idle = advanceSimulation(recoverySimulation('none'), 60);
    const idleMara = idle.characters.find(agent => agent.id === 'mara');
    assert.ok(idleMara);
    assert.deepEqual(idleMara.resources, {
      executiveBudget: 0.1,
      physicalStamina: 0.1,
      regulationReserve: 0.1,
      socialBattery: 0.1,
    });
    assert.ok(
      (recovered.get('sleep')?.resources.physicalStamina ?? 0) >
        (recovered.get('rest')?.resources.physicalStamina ?? 0),
    );
    assert.ok(
      (recovered.get('rest')?.resources.physicalStamina ?? 0) >
        (recovered.get('break')?.resources.physicalStamina ?? 0),
    );
  });

  it('records workbench interventions without mutating prior state', () => {
    const initial = starterSimulation();
    const changedValue = setCharacterValueCharge(initial, 'sera', 'autonomy', 0.75);
    const changedResource = setCharacterResource(changedValue, 'sera', 'regulationReserve', 0.1);
    assert.equal(
      initial.characters.find(agent => agent.id === 'sera')?.values.autonomy.charge,
      -0.24,
    );
    assert.equal(
      changedResource.characters.find(agent => agent.id === 'sera')?.values.autonomy.charge,
      0.75,
    );
    assert.equal(
      changedResource.characters.find(agent => agent.id === 'sera')?.resources.regulationReserve,
      0.1,
    );
    assert.equal(changedResource.trace.entries.at(-1)?.kind, 'intervention');
  });

  it('resolves an event at scenario start exactly once', () => {
    const authored = parseScenario(scenario);
    authored.behaviorOpportunities = [
      {
        actorId: 'mara',
        atSecond: authored.startSecond,
        candidates: [
          {
            claimExpressions: [],
            contractViolation: 0,
            id: 'acknowledge-opening',
            impacts: [{ subjectId: 'mara', turns: { safety: 0.1 } }],
            label: 'Acknowledge the opening moment',
            operation: 'acknowledge-opening',
            repercussionSeverity: 0,
            selfDirected: true,
            somaticDemand: 0,
          },
        ],
        context: {
          enforcementPresence: 0,
          networkConductivity: 0,
          perceivedThreat: 0,
          witnessIds: [],
        },
        id: 'start-boundary-opportunity',
        targetId: null,
      },
    ];
    const initial = createSimulation({
      characterLibrary: characters,
      environmentLibrary: environments,
      scenario: authored,
    });
    const first = advanceSimulation(initial, 1);
    const second = advanceSimulation(first, 1);

    assert.deepEqual(first.resolvedOpportunityIds, ['start-boundary-opportunity']);
    assert.deepEqual(second.resolvedOpportunityIds, ['start-boundary-opportunity']);
    assert.equal(
      second.decisions.filter(decision => decision.opportunityId === 'start-boundary-opportunity')
        .length,
      1,
    );
  });

  it('keeps same-tick intervention identities distinct after trace saturation and resume', () => {
    const initial = starterSimulation();
    const scenarioEntry = initial.trace.entries[0];
    assert.ok(scenarioEntry);
    const saturated = {
      ...initial,
      trace: {
        ...initial.trace,
        entries: Array.from({ length: 240 }, (_, index) => ({
          ...scenarioEntry,
          id: `saturated-trace:${index}`,
        })),
      },
    };
    assert.equal(saturated.trace.entries.length, 240);
    const first = setCharacterValueCharge(saturated, 'sera', 'autonomy', 0.6);
    const second = setCharacterValueCharge(first, 'sera', 'autonomy', 0.7);
    const interventionIds = second.trace.entries
      .filter(entry => entry.kind === 'intervention' && entry.tick === second.tick)
      .map(entry => entry.id);
    const sera = second.characters.find(agent => agent.id === 'sera');
    assert.ok(sera);
    const memoryIds = sera.memories
      .filter(memory => memory.type === 'intervention')
      .map(memory => memory.id);

    assert.equal(interventionIds.length, 2);
    assert.equal(new Set(interventionIds).size, interventionIds.length);
    assert.deepEqual(memoryIds.slice(-2), interventionIds);

    const snapshot = serializeSnapshot(second);
    const resumed = createSimulationFromSnapshot({
      characterLibrary: characters,
      environmentLibrary: environments,
      snapshot,
    });
    const continued = setCharacterValueCharge(resumed, 'sera', 'autonomy', 0.8);
    const replayed = setCharacterValueCharge(
      createSimulationFromSnapshot({
        characterLibrary: characters,
        environmentLibrary: environments,
        snapshot,
      }),
      'sera',
      'autonomy',
      0.8,
    );
    const continuedIds = continued.trace.entries
      .filter(entry => entry.kind === 'intervention' && entry.tick === continued.tick)
      .map(entry => entry.id);

    assert.equal(continuedIds.length, 3);
    assert.equal(new Set(continuedIds).size, continuedIds.length);
    assert.deepEqual(continued, replayed);
  });

  it('keeps authored scenarios separate from resumable snapshots', () => {
    const advanced = advanceSimulation(starterSimulation(), 20);
    const authored = serializeScenario(advanced);
    const snapshot = serializeSnapshot(advanced);
    assert.equal(authored.startSecond, scenario.startSecond);
    assert.equal(snapshot.second, advanced.second);
    assert.deepEqual(parseScenario(authored), authored);
    assert.deepEqual(parseSnapshot(snapshot), snapshot);
    const resumed = createSimulationFromSnapshot({
      characterLibrary: characters,
      environmentLibrary: environments,
      snapshot,
    });
    assert.deepEqual(resumed, advanced);
  });

  it('validates live snapshot references before restoring state', () => {
    const snapshot = serializeSnapshot(starterSimulation());
    const firstAgent = snapshot.characters[0];
    const firstBlock = firstAgent?.schedule[0];
    assert.ok(firstBlock);
    firstBlock.locationId = 'missing-location';
    assert.throws(
      () =>
        createSimulationFromSnapshot({
          characterLibrary: characters,
          environmentLibrary: environments,
          snapshot,
        }),
      /snapshot\.characters\[0\]\.schedule\[0\]\.locationId/,
    );
  });
});
