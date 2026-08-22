import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import characters from '../library/characters.json';
import environments from '../library/environments.json';
import scenario from '../scenarios/market-morning.json';
import {
  advanceSimulation,
  createSimulation,
  createSimulationFromSnapshot,
  describeAgent,
  parseScenario,
  parseSnapshot,
  serializeScenario,
  serializeSnapshot,
  setAgentResource,
  setAgentValueCharge,
} from '../src/index.js';

function starterSimulation() {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario,
  });
}

describe('simulation runtime', () => {
  it('resolves reusable character and environment references', () => {
    const state = starterSimulation();
    assert.equal(state.scenario.id, 'market-morning');
    assert.equal(state.environment.id, 'alders-edge');
    assert.deepEqual(
      state.agents.map(agent => agent.profile.name),
      ['Mara Vale', 'Tomas Reed', 'Nessa Arden', 'Elian Voss', 'Sera Dane'],
    );
  });

  it('advances deterministically through the same path used by the workbench', () => {
    const first = advanceSimulation(starterSimulation(), 12);
    const second = advanceSimulation(starterSimulation(), 12);
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
    const advanced = advanceSimulation(starterSimulation(), 4);
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
