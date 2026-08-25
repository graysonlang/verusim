import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import cascadeScenario from '../content/scenarios/cascade-room.json';
import relationshipScenario from '../content/scenarios/relationship-momentum.json';
import {
  LOW_STAKES_EXCHANGE_MAX,
  advanceSimulation,
  cadenceLogicalTick,
  catchUpConstantRate,
  createCadenceSession,
  createSimulation,
  createSimulationFromSnapshot,
  createSomaticState,
  evaluateOrbitExchange,
  flushCadence,
  projectEmbodiedObservation,
  projectTextObservation,
  resolveOrbitExchange,
  resumeCadenceSave,
  scheduleCadence,
  serializeCadenceSave,
  serializeSnapshot,
  type CadenceTier,
  type LowStakesExchange,
  type SimulationState,
} from '../src/index.js';
import { characters, environments } from './fixtures.js';

function createCascadeSimulation(): SimulationState {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario: cascadeScenario,
  });
}

function createRelationshipSimulation(): SimulationState {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario: relationshipScenario,
  });
}

const lowStakesExchange: LowStakesExchange = {
  id: 'courtyard-greeting',
  initiatorId: 'requester',
  intimacyBid: 0.6,
  powerBid: 0.5,
  responderId: 'responder',
  stakes: 0.15,
  summary: 'The requester offers a warm courtyard greeting.',
};

describe('integration adapters', () => {
  it('projects text and embodied tells from the same unchanged causal trace', () => {
    const state = advanceSimulation(createCascadeSimulation(), 1);
    const before = structuredClone(state.trace);
    const text = projectTextObservation(state, 'witness');
    const embodied = projectEmbodiedObservation(state, 'witness');

    assert.deepEqual(text.sourceTraceIds, embodied.sourceTraceIds);
    assert.ok(text.sourceTraceIds.length > 0);
    assert.equal(text.medium, 'text');
    assert.equal(embodied.medium, 'embodied');
    assert.equal('posture' in text, false);
    assert.equal('tells' in embodied, false);
    assert.deepEqual(state.trace, before);

    const restored = createSimulationFromSnapshot({
      characterLibrary: characters,
      environmentLibrary: environments,
      snapshot: serializeSnapshot(state),
    });
    assert.deepEqual(projectTextObservation(restored, 'witness'), text);
    assert.deepEqual(projectEmbodiedObservation(restored, 'witness'), embodied);
  });

  it('makes every cadence tier agree with full evaluation at observation boundaries', () => {
    const full = advanceSimulation(createRelationshipSimulation(), 7);
    const tiers: CadenceTier[] = ['adjacent', 'location', 'settlement', 'on-demand'];

    for (const tier of tiers) {
      const scheduled = scheduleCadence(
        createCadenceSession(createRelationshipSimulation(), tier),
        7,
      );
      assert.equal(cadenceLogicalTick(scheduled), full.tick);
      assert.deepEqual(serializeSnapshot(flushCadence(scheduled).state), serializeSnapshot(full));
    }
  });

  it('keeps accelerated and chunked cadence replay deterministic across a saved pending chunk', () => {
    const initial = createRelationshipSimulation();
    const direct = advanceSimulation(initial, 60);
    const accelerated = scheduleCadence(
      createCadenceSession(createRelationshipSimulation(), 'location'),
      60,
    );
    let incremental = createCadenceSession(createRelationshipSimulation(), 'location');
    for (let tick = 0; tick < 60; tick += 1) incremental = scheduleCadence(incremental, 1);

    assert.deepEqual(serializeSnapshot(accelerated.state), serializeSnapshot(direct));
    assert.deepEqual(serializeSnapshot(incremental.state), serializeSnapshot(direct));

    const pending = scheduleCadence(
      createCadenceSession(createRelationshipSimulation(), 'on-demand'),
      13,
    );
    const save = JSON.parse(JSON.stringify(serializeCadenceSave(pending))) as unknown;
    const resumed = resumeCadenceSave({
      characterLibrary: characters,
      environmentLibrary: environments,
      save,
    });
    assert.equal(cadenceLogicalTick(resumed), initial.tick + 13);
    assert.deepEqual(
      serializeSnapshot(flushCadence(resumed).state),
      serializeSnapshot(advanceSimulation(initial, 13)),
    );
  });

  it('uses closed-form catch-up only for an exact constant-rate primitive', () => {
    const direct = catchUpConstantRate(0.25, 0.125, 4, 0, 1);
    let stepped = 0.25;
    for (let minute = 0; minute < 4; minute += 1) {
      stepped = catchUpConstantRate(stepped, 0.125, 1, 0, 1);
    }
    assert.equal(direct, stepped);
    assert.equal(catchUpConstantRate(0.9, 0.125, 4, 0, 1), 1);
  });

  it('settles low-stakes ORBIT exchanges through complementary power and matched intimacy', () => {
    const state = createRelationshipSimulation();
    const settlement = evaluateOrbitExchange(state, lowStakesExchange);

    assert.ok(
      Math.abs(settlement.responsePower + settlement.settledPower) <
        Math.abs(settlement.responsePower - settlement.settledPower),
    );
    assert.ok(
      Math.abs(settlement.responseIntimacy - settlement.settledIntimacy) <
        Math.abs(settlement.responseIntimacy + settlement.settledIntimacy),
    );

    const cold = evaluateOrbitExchange(state, {
      ...lowStakesExchange,
      id: 'cold-greeting',
      intimacyBid: -0.6,
    });
    assert.ok(settlement.stanceTurn > cold.stanceTurn);
  });

  it('produces the same low-stakes exchange after observed or offscreen cadence', () => {
    const observedState = advanceSimulation(createRelationshipSimulation(), 6);
    projectTextObservation(observedState, 'requester');
    const observed = resolveOrbitExchange(observedState, lowStakesExchange);

    const offscreen = scheduleCadence(
      createCadenceSession(createRelationshipSimulation(), 'on-demand'),
      6,
    );
    const resolvedOffscreen = resolveOrbitExchange(
      flushCadence(offscreen).state,
      lowStakesExchange,
    );
    assert.deepEqual(serializeSnapshot(resolvedOffscreen), serializeSnapshot(observed));
  });

  it('routes consequential exchanges to ordinary appraisal and traces somatic preemption', () => {
    assert.throws(
      () =>
        evaluateOrbitExchange(createRelationshipSimulation(), {
          ...lowStakesExchange,
          stakes: LOW_STAKES_EXCHANGE_MAX + 0.01,
        }),
      /ordinary appraisal evaluator/,
    );

    const state = createRelationshipSimulation();
    const preempted: SimulationState = {
      ...state,
      characters: state.characters.map(agent =>
        agent.id === lowStakesExchange.initiatorId
          ? {
              ...agent,
              somatic: createSomaticState([
                {
                  attentionTax: 1,
                  cadence: 'fluctuating',
                  copingPotential: 0,
                  id: 'acute-crisis',
                  impairment: 0.8,
                  label: 'Acute crisis',
                  origin: 'event',
                  pain: 0.8,
                  perceivedUrgency: 1,
                  preemption: 'emergency',
                  visible: 1,
                },
              ]),
            }
          : agent,
      ),
    };
    assert.throws(
      () => evaluateOrbitExchange(preempted, lowStakesExchange),
      /somatic state preempts/,
    );
    const resolved = resolveOrbitExchange(preempted, lowStakesExchange);
    assert.deepEqual(resolved.dyads, preempted.dyads);
    assert.equal(resolved.trace.entries.at(-1)?.kind, 'gate');
    assert.deepEqual(
      resolved.trace.entries.at(-1)?.terms.map(term => term.id),
      ['initiator-somatic-level', 'responder-somatic-level'],
    );
  });
});
