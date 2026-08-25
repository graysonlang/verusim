import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import aldersEdge from '../content/scenarios/alders-edge-town.json';
import highwaymanRoad from '../content/scenarios/highwayman-road.json';
import {
  DEFAULT_CADENCE_POLICY,
  advanceTo,
  applyCadenceInput,
  cadenceLogicalSecond,
  cadencePolicyForRate,
  createCadenceSession,
  createResourceCatalog,
  createSimulation,
  flushCadence,
  parseCadenceSave,
  prepareScenario,
  resumeCadenceSave,
  retierCadence,
  scheduleCadence,
  serializeCadenceSave,
  serializeSnapshot,
  setCharacterValueCharge,
  type CadenceSession,
  type CadenceTier,
  type ScenarioFile,
  type SimulationState,
} from '../src/index.js';

const catalog = createResourceCatalog(BUILT_IN_RESOURCES);

function roadScenario() {
  const scenario = structuredClone(highwaymanRoad) as unknown as ScenarioFile;
  const template = scenario.behaviorOpportunities[0];
  assert.ok(template);
  // Opportunities land off the minute grid and inside every batched interval.
  scenario.behaviorOpportunities = [130, 611, 1333, 1750].map((offset, index) => ({
    ...structuredClone(template),
    atSecond: scenario.startSecond + offset,
    id: `${template.id}-at-${index}`,
  }));
  return { actorId: template.actorId, scenario };
}

function roadSimulation(): { actorId: string; state: SimulationState } {
  const { actorId, scenario } = roadScenario();
  return { actorId, state: createSimulation(prepareScenario({ catalog, scenario })) };
}

function bytes(state: SimulationState): string {
  return JSON.stringify(serializeSnapshot(state));
}

/** Drive a session by real-time steps of `stepSeconds` up to `seconds` of logical time. */
function drive(session: CadenceSession, seconds: number, stepSeconds: number): CadenceSession {
  let current = session;
  let scheduled = 0;
  while (scheduled < seconds) {
    const step = Math.min(stepSeconds, seconds - scheduled);
    current = scheduleCadence(current, step);
    scheduled += step;
  }
  return current;
}

function cohortScenario(size: number): ScenarioFile {
  const scenario = structuredClone(aldersEdge) as unknown as ScenarioFile;
  const templates = scenario.characters;
  scenario.characters = Array.from({ length: size }, (_unused, index) => {
    const template = templates[index % templates.length];
    assert.ok(template);
    const placement = structuredClone(template);
    if (index >= templates.length) placement.instanceId = `${placement.instanceId}-${index}`;
    return placement;
  });
  return scenario;
}

describe('cadence policy over logical seconds', () => {
  const OBSERVATION = 1800;

  it('reaches byte-equivalent state and traces from every schedule at one observation boundary', () => {
    const { state } = roadSimulation();
    const expected = bytes(advanceTo(state, state.second + OBSERVATION));
    const schedules: Array<[string, CadenceSession]> = [
      ['real-time adjacent', drive(createCadenceSession(state, 'adjacent'), OBSERVATION, 1)],
      ['accelerated adjacent', drive(createCadenceSession(state, 'adjacent'), OBSERVATION, 60)],
      ['location', drive(createCadenceSession(state, 'location'), OBSERVATION, 17)],
      ['settlement', drive(createCadenceSession(state, 'settlement'), OBSERVATION, 600)],
      ['on-demand', drive(createCadenceSession(state, 'on-demand'), OBSERVATION, 45)],
      [
        'rate-scaled adjacent',
        drive(
          createCadenceSession(
            state,
            'adjacent',
            cadencePolicyForRate({ batchRealSeconds: 0.25, playbackRate: 3600 }),
          ),
          OBSERVATION,
          900,
        ),
      ],
    ];
    for (const [label, session] of schedules) {
      assert.equal(cadenceLogicalSecond(session), state.second + OBSERVATION, label);
      assert.equal(bytes(flushCadence(session).state), expected, label);
    }
  });

  it('commits only whole intervals and never runs ahead of scheduled logical time', () => {
    const { state } = roadSimulation();
    const session = drive(createCadenceSession(state, 'location'), 1234, 100);
    assert.equal(session.state.second, state.second + 1200);
    assert.equal(session.pendingSeconds, 34);
    assert.equal(cadenceLogicalSecond(session), state.second + 1234);
    assert.throws(() => scheduleCadence(session, 1.5), RangeError);
    assert.throws(() => scheduleCadence(session, -1), RangeError);
  });

  it('flushes pending work before a tier change so the boundary state is unchanged', () => {
    const { state } = roadSimulation();
    const expected = bytes(advanceTo(state, state.second + OBSERVATION));
    const first = drive(createCadenceSession(state, 'settlement'), 700, 100);
    assert.equal(first.pendingSeconds, 700);
    const retiered = retierCadence(first, 'adjacent');
    assert.equal(retiered.pendingSeconds, 0);
    assert.equal(retiered.state.second, state.second + 700);
    assert.equal(retiered.tier, 'adjacent');
    const finished = drive(retiered, OBSERVATION - 700, 1);
    assert.equal(bytes(flushCadence(finished).state), expected);
  });

  it('treats player input as an immediate barrier at the same second on every schedule', () => {
    const { actorId, state } = roadSimulation();
    const inputSecond = state.second + 1000;
    const input = (current: SimulationState) =>
      setCharacterValueCharge(current, actorId, 'safety', -0.95);
    const direct = advanceTo(input(advanceTo(state, inputSecond)), state.second + OBSERVATION);
    const untouched = advanceTo(state, state.second + OBSERVATION);
    assert.notEqual(bytes(direct), bytes(untouched), 'the input changes the outcome');

    const tiers: CadenceTier[] = ['adjacent', 'location', 'settlement', 'on-demand'];
    for (const tier of tiers) {
      const before = drive(createCadenceSession(state, tier), 1000, 250);
      const applied = applyCadenceInput(before, input);
      assert.equal(applied.state.second, inputSecond, tier);
      assert.equal(applied.pendingSeconds, 0, tier);
      const after = drive(applied, OBSERVATION - 1000, 250);
      assert.equal(bytes(flushCadence(after).state), bytes(direct), tier);
    }
  });

  it('scales batched intervals with playback rate without changing the default at real time', () => {
    assert.deepEqual(cadencePolicyForRate({ playbackRate: 1 }), DEFAULT_CADENCE_POLICY);
    assert.deepEqual(cadencePolicyForRate({ playbackRate: 0.5 }), DEFAULT_CADENCE_POLICY);
    assert.deepEqual(cadencePolicyForRate({ playbackRate: 600 }), {
      adjacent: 600,
      location: 600,
      'on-demand': null,
      settlement: 1800,
    });
    assert.deepEqual(cadencePolicyForRate({ batchRealSeconds: 0.5, playbackRate: 3600 }), {
      adjacent: 1800,
      location: 1800,
      'on-demand': null,
      settlement: 1800,
    });
    assert.throws(() => cadencePolicyForRate({ playbackRate: 0 }), RangeError);
    assert.throws(() => cadencePolicyForRate({ batchRealSeconds: 0, playbackRate: 1 }), RangeError);
  });

  it('round-trips a pending chunk through cadence save schema 2 and migrates schema 1', () => {
    const { state } = roadSimulation();
    const pending = drive(createCadenceSession(state, 'on-demand'), 777, 777);
    const save = JSON.parse(JSON.stringify(serializeCadenceSave(pending))) as Record<
      string,
      unknown
    >;
    assert.equal(save.schemaVersion, 2);
    assert.equal(save.pendingSeconds, 777);
    const resumed = resumeCadenceSave({
      prepared: prepareScenario({ catalog, scenario: roadScenario().scenario }),
      save,
    });
    assert.equal(cadenceLogicalSecond(resumed), state.second + 777);
    assert.equal(bytes(flushCadence(resumed).state), bytes(advanceTo(state, state.second + 777)));

    const legacy = structuredClone(save);
    legacy.schemaVersion = 1;
    legacy.pendingTicks = 13;
    delete legacy.pendingSeconds;
    legacy.policy = { adjacent: 1, location: 5, 'on-demand': null, settlement: 30 };
    const migrated = parseCadenceSave(legacy);
    assert.equal(migrated.schemaVersion, 2);
    assert.equal(migrated.pendingSeconds, 13 * 60);
    assert.deepEqual(migrated.policy, DEFAULT_CADENCE_POLICY);
    assert.throws(() => parseCadenceSave({ ...save, schemaVersion: 3 }), RangeError);
    assert.throws(() => parseCadenceSave({ ...save, pendingSeconds: 1.5 }), RangeError);
  });

  it('keeps up with due work for a forty-character cohort at every default schedule', () => {
    const state = createSimulation(prepareScenario({ catalog, scenario: cohortScenario(40) }));
    assert.equal(state.characters.length, 40);
    const hour = 3600;
    const expected = bytes(advanceTo(state, state.second + hour));
    // One logical hour scheduled as a 3600x host would (one real second of work)
    // must commit well inside that real second; the same hour scheduled second by
    // second at real time must commit well inside the hour it represents.
    const startedSettlement = performance.now();
    const settlement = drive(createCadenceSession(state, 'settlement'), hour, 900);
    const settlementMs = performance.now() - startedSettlement;
    const startedAdjacent = performance.now();
    const adjacent = drive(createCadenceSession(state, 'adjacent'), hour, 1);
    const adjacentMs = performance.now() - startedAdjacent;
    assert.equal(bytes(settlement.state), expected);
    assert.equal(bytes(adjacent.state), expected);
    assert.ok(settlementMs < 1000, `settlement hour took ${settlementMs.toFixed(0)}ms`);
    assert.ok(adjacentMs < 60_000, `adjacent hour took ${adjacentMs.toFixed(0)}ms`);
  });
});
