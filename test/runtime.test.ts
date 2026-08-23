import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { characters, environments } from './fixtures.js';
import scenario from '../scenarios/market-morning.json';
import {
  VALUE_IDS,
  advanceSimulation,
  classifyMovementSpeed,
  createSimulation,
  createSimulationFromSnapshot,
  describeAgent,
  parseScenario,
  parseSnapshot,
  serializeScenario,
  serializeSnapshot,
  setAgentResource,
  setAgentValueCharge,
  type RecoveryMode,
  type ScenarioFile,
  type SimulationAgent,
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
  authored.startMinute = 0;
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

function neutralAgent(agent: SimulationAgent): SimulationAgent {
  const values = Object.fromEntries(
    VALUE_IDS.map(valueId => [
      valueId,
      { ...agent.values[valueId], charge: 0, deficitIntegral: 0 },
    ]),
  ) as SimulationAgent['values'];
  return { ...agent, values };
}

describe('simulation runtime', () => {
  it('resolves reusable character and environment references', () => {
    const state = starterSimulation();
    assert.equal(state.scenario.id, 'market-morning');
    assert.equal(state.environment.layoutId, 'alders-edge');
    assert.deepEqual(
      state.agents.map(agent => agent.profile.name),
      ['Mara Vale', 'Tomas Reed', 'Nessa Arden', 'Elian Voss', 'Sera Dane'],
    );
  });

  it('advances deterministically through the same path used by the workbench', () => {
    const first = advanceSimulation(starterSimulation(), 60);
    const second = advanceSimulation(starterSimulation(), 60);
    assert.deepEqual(first, second);
    assert.equal(first.minute, 530);

    const mara = first.agents.find(agent => agent.id === 'mara');
    assert.ok(mara);
    assert.equal(mara.currentLocationId, 'wayfarer-inn');
    assert.equal(mara.currentActivity, 'Opening the common room');
    assert.ok(Math.abs(mara.values.safety.charge - 0.108) < 1e-12);
    assert.ok(
      first.trace.entries.some(entry => entry.agentId === 'mara' && entry.kind === 'activity'),
    );
  });

  it('derives one legible concern from the full value state', () => {
    const state = starterSimulation();
    const tomas = state.agents.find(agent => agent.id === 'tomas');
    assert.ok(tomas);
    const observation = describeAgent(tomas);
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

    const mara = starterSimulation().agents.find(agent => agent.id === 'mara');
    assert.ok(mara);
    const moving = describeAgent({
      ...mara,
      destination: { x: mara.position.x + 100, y: mara.position.y },
    });
    const arrived = describeAgent({ ...mara, destination: { ...mara.position } });
    assert.equal(moving.movementMetersPerMinute, mara.walkingMetersPerMinute);
    assert.equal(moving.movementSpeedClass, 'plodding');
    assert.equal(arrived.movementMetersPerMinute, 0);
    assert.equal(arrived.movementSpeedClass, 'still');

    const tomas = starterSimulation().agents.find(agent => agent.id === 'tomas');
    assert.ok(tomas);
    assert.ok(Math.abs(tomas.walkingMetersPerMinute - 17 * 1.04 * 0.94) < 1e-12);
  });

  it('lets depleted social battery impair otherwise neutral mood', () => {
    const mara = starterSimulation().agents.find(agent => agent.id === 'mara');
    assert.ok(mara);
    const neutral = neutralAgent(mara);
    const rested = describeAgent({
      ...neutral,
      resources: { ...neutral.resources, physicalStamina: 1, socialBattery: 1 },
    });
    const depleted = describeAgent({
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
    const recovered = new Map<RecoveryMode, SimulationAgent>();
    for (const mode of ['break', 'rest', 'sleep'] as const) {
      const advanced = advanceSimulation(recoverySimulation(mode), 60);
      const mara = advanced.agents.find(agent => agent.id === 'mara');
      assert.ok(mara);
      recovered.set(mode, mara);
      for (const amount of Object.values(mara.resources)) assert.ok(amount > 0.1);
      const resourceTrace = advanced.trace.entries.find(
        entry => entry.agentId === 'mara' && entry.kind === 'resource',
      );
      assert.ok(resourceTrace);
      assert.equal(resourceTrace.terms.find(term => term.id === 'recovery-mode')?.value, mode);
    }

    const idle = advanceSimulation(recoverySimulation('none'), 60);
    const idleMara = idle.agents.find(agent => agent.id === 'mara');
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
    const changedValue = setAgentValueCharge(initial, 'sera', 'autonomy', 0.75);
    const changedResource = setAgentResource(changedValue, 'sera', 'regulationReserve', 0.1);
    assert.equal(initial.agents.find(agent => agent.id === 'sera')?.values.autonomy.charge, -0.24);
    assert.equal(
      changedResource.agents.find(agent => agent.id === 'sera')?.values.autonomy.charge,
      0.75,
    );
    assert.equal(
      changedResource.agents.find(agent => agent.id === 'sera')?.resources.regulationReserve,
      0.1,
    );
    assert.equal(changedResource.trace.entries.at(-1)?.kind, 'intervention');
  });

  it('keeps authored scenarios separate from resumable snapshots', () => {
    const advanced = advanceSimulation(starterSimulation(), 20);
    const authored = serializeScenario(advanced);
    const snapshot = serializeSnapshot(advanced);
    assert.equal(authored.startMinute, scenario.startMinute);
    assert.equal(snapshot.minute, advanced.minute);
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
    const firstAgent = snapshot.agents[0];
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
      /snapshot\.agents\[0\]\.schedule\[0\]\.locationId/,
    );
  });
});
