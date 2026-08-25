import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_SCENARIOS } from '../app/scenarios.js';
import highwaymanRoad from '../content/scenarios/highwayman-road.json';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import {
  advanceSimulation,
  advanceTo,
  createResourceCatalog,
  createSimulation,
  navigationDistance,
  prepareScenario,
  serializeSnapshot,
  setCharacterValueCharge,
} from '../src/index.js';

const catalog = createResourceCatalog(BUILT_IN_RESOURCES);

function marketMorning() {
  const entry = BUILT_IN_SCENARIOS.find(candidate => candidate.id === 'market-morning');
  assert.ok(entry);
  return createSimulation(entry.prepared);
}

function roadWithOpportunitiesAt(seconds: readonly number[]) {
  const scenario = structuredClone(highwaymanRoad) as {
    startSecond: number;
    behaviorOpportunities: { atSecond: number; id: string }[];
  };
  assert.ok(scenario.behaviorOpportunities.length > 0);
  const template = scenario.behaviorOpportunities[0];
  assert.ok(template);
  scenario.behaviorOpportunities = seconds.map((offset, index) => ({
    ...structuredClone(template),
    atSecond: scenario.startSecond + offset,
    id: `${template.id}-at-${index}`,
  }));
  return { scenario, start: scenario.startSecond };
}

describe('event-delimited advancement', () => {
  it('moves a walking character at the authored pace per elapsed second', () => {
    const state = marketMorning();
    const walker = state.characters.find(character => character.currentLocationId === null);
    assert.ok(walker, 'a character starts in transit');
    const later = advanceTo(state, state.second + 10);
    const moved = later.characters.find(character => character.id === walker.id);
    assert.ok(moved);
    const distance = navigationDistance(state.environment, walker.position, moved.position);
    assert.ok(
      Math.abs(distance - (walker.walkingMetersPerMinute / 60) * 10) < 1e-6,
      `moved ${distance}`,
    );
    assert.equal(later.second, state.second + 10);
  });

  it('resolves two events inside one authored minute at their exact seconds in stable order', () => {
    const { scenario, start } = roadWithOpportunitiesAt([20, 40]);
    const prepared = prepareScenario({ catalog, scenario });
    const next = advanceSimulation(createSimulation(prepared), 1);
    assert.equal(next.second, start + 60);
    assert.equal(next.tick, 1);
    assert.deepEqual(
      next.decisions.map(decision => decision.second),
      [start + 20, start + 40],
    );
    const decisionEntries = next.trace.entries.filter(entry => entry.kind === 'decision');
    assert.deepEqual(
      decisionEntries.map(entry => entry.second),
      [start + 20, start + 40],
    );
    assert.ok(decisionEntries.every(entry => entry.tick === 1));
  });

  it('lets a player action at second 20 change the appraisal at second 30, before the minute boundary', () => {
    const { scenario, start } = roadWithOpportunitiesAt([30]);
    const prepared = prepareScenario({ catalog, scenario });
    const initial = createSimulation(prepared);
    const actorId = scenario.behaviorOpportunities[0]
      ? (highwaymanRoad.behaviorOpportunities[0] as { actorId: string }).actorId
      : '';
    assert.ok(actorId);
    const untouched = advanceTo(initial, start + 60);
    const paused = advanceTo(initial, start + 20);
    assert.equal(paused.decisions.length, 0);
    const pushed = setCharacterValueCharge(paused, actorId, 'safety', -0.95);
    const touched = advanceTo(pushed, start + 60);
    assert.equal(touched.decisions[0]?.second, start + 30);
    assert.equal(untouched.decisions[0]?.second, start + 30);
    assert.notEqual(
      JSON.stringify(touched.decisions[0]?.candidates),
      JSON.stringify(untouched.decisions[0]?.candidates),
    );
    assert.ok(touched.decisions[0] && touched.decisions[0].second < start + 60);
  });

  it('rejects targets before the current second or off the integer domain', () => {
    const state = marketMorning();
    assert.throws(() => advanceTo(state, state.second - 1), RangeError);
    assert.throws(() => advanceTo(state, state.second + 0.5), RangeError);
    assert.equal(advanceTo(state, state.second), state);
  });

  it('reaches byte-identical state under whole, per-tick, two-second, and one-second partitions', () => {
    // Movement and timers integrate per interval from committed routes, while
    // continuous accumulators integrate exactly once per authored tick, so no
    // partition can change the arithmetic that produces authoritative state.
    const partition = (
      seconds: number,
      target: number,
      start: ReturnType<typeof marketMorning>,
    ) => {
      let state = start;
      while (state.second < target)
        state = advanceTo(state, Math.min(target, state.second + seconds));
      return JSON.stringify(serializeSnapshot(state));
    };
    for (const entry of BUILT_IN_SCENARIOS) {
      const state = createSimulation(entry.prepared);
      const target = state.second + 600;
      const whole = JSON.stringify(serializeSnapshot(advanceTo(state, target)));
      assert.equal(partition(60, target, state), whole, `${entry.id}: 10 x 60s`);
      assert.equal(partition(7, target, state), whole, `${entry.id}: 7s steps`);
      assert.equal(partition(2, target, state), whole, `${entry.id}: 300 x 2s`);
      assert.equal(partition(1, target, state), whole, `${entry.id}: 600 x 1s`);
    }
  });
});
