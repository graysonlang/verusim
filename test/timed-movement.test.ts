import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_SCENARIOS } from '../app/scenarios.js';
import {
  advanceTo,
  createSimulation,
  createSimulationFromSnapshot,
  createTimedRoute,
  locationCenter,
  navigationDistance,
  parseSnapshot,
  redirectCharacter,
  routeArrivalSecond,
  routePositionAtSecond,
  serializeSnapshot,
} from '../src/index.js';

function scenario(id: string) {
  const entry = BUILT_IN_SCENARIOS.find(candidate => candidate.id === id);
  assert.ok(entry);
  return entry;
}

function farthestLocation(
  state: ReturnType<typeof createSimulation>,
  from: { x: number; y: number; layerId: string },
  exclude: readonly string[],
) {
  const candidates = state.environment.locations
    .filter(location => location.layerId === from.layerId && !exclude.includes(location.id))
    .map(location => ({
      distance: navigationDistance(state.environment, from, locationCenter(location)),
      location,
    }))
    .filter(candidate => Number.isFinite(candidate.distance))
    .sort((left, right) => right.distance - left.distance);
  const farthest = candidates[0];
  assert.ok(farthest && farthest.distance > 60, 'a distant location exists');
  return farthest.location;
}

/** Start Mara on a walk long enough to be interrupted well before arrival. */
function startLongWalk() {
  const state = createSimulation(scenario('market-morning').prepared);
  const mara = state.characters.find(character => character.id === 'mara');
  assert.ok(mara);
  const target = farthestLocation(state, mara.position, [mara.currentLocationId ?? '']);
  return { mara, state: redirectCharacter(state, 'mara', target.id), target };
}

describe('interruptible timed movement', () => {
  it('commits a timed route whose position is a pure function of absolute time', () => {
    const { mara, state, target } = startLongWalk();
    const at20 = advanceTo(state, state.second + 20);
    const moved = at20.characters.find(character => character.id === 'mara');
    assert.ok(moved?.route);
    assert.equal(moved.route.destinationLocationId, target.id);
    assert.equal(moved.route.departureSecond, state.second);
    assert.deepEqual(moved.route.origin, mara.position);
    assert.deepEqual(moved.position, routePositionAtSecond(moved.route, state.second + 20));
    assert.ok(routeArrivalSecond(moved.route) > state.second + 20);
    const at35 = advanceTo(at20, state.second + 35);
    const later = at35.characters.find(character => character.id === 'mara');
    assert.ok(later);
    assert.deepEqual(later.position, routePositionAtSecond(moved.route, state.second + 35));
    assert.equal(later.currentActivity, `Walking to ${target.name}`);
  });

  it('interrupts at second 20, settles the exact route position, and redirects from there', () => {
    const { mara, state, target } = startLongWalk();
    const at20 = advanceTo(state, state.second + 20);
    const settled = at20.characters.find(character => character.id === 'mara');
    assert.ok(settled?.route);
    const original = settled.route;
    const elsewhere = farthestLocation(at20, settled.position, [
      target.id,
      mara.currentLocationId ?? '',
    ]);

    const redirected = redirectCharacter(at20, 'mara', elsewhere.id);
    assert.equal(
      redirected.characters.find(character => character.id === 'mara')?.directedLocationId,
      elsewhere.id,
    );
    const at25 = advanceTo(redirected, state.second + 25);
    const moving = at25.characters.find(character => character.id === 'mara');
    assert.ok(moving?.route);
    assert.equal(moving.route.destinationLocationId, elsewhere.id);
    assert.equal(moving.route.departureSecond, state.second + 20);
    assert.deepEqual(moving.route.origin, settled.position);
    assert.deepEqual(moving.position, routePositionAtSecond(moving.route, state.second + 25));
    const traveled = navigationDistance(state.environment, settled.position, moving.position);
    assert.ok(
      Math.abs(traveled - (mara.walkingMetersPerMinute / 60) * 5) < 1e-6,
      `traveled ${traveled}`,
    );
    assert.notDeepEqual(moving.position, mara.position);
    assert.notDeepEqual(moving.position, routePositionAtSecond(original, state.second + 25));

    const arrived = advanceTo(redirected, Math.ceil(routeArrivalSecond(moving.route)));
    const there = arrived.characters.find(character => character.id === 'mara');
    assert.equal(there?.currentLocationId, elsewhere.id);
    assert.equal(there?.route, null);
    assert.equal(there?.directedLocationId, null);
    assert.deepEqual(there?.position, locationCenter(elsewhere));
    assert.ok(
      arrived.trace.entries.filter(
        entry => entry.kind === 'intervention' && entry.instanceId === 'mara',
      ).length >= 2,
    );
  });

  it('routes across layers through a connector and reports the layer at each sampled second', () => {
    const state = createSimulation(scenario('alders-edge-town').prepared);
    const environment = state.environment;
    const upper = environment.locations.find(location => location.layerId !== 'surface');
    const surface = environment.locations.find(location => location.layerId === 'surface');
    assert.ok(upper);
    assert.ok(surface);
    const route = createTimedRoute(
      environment,
      locationCenter(surface),
      locationCenter(upper),
      upper.id,
      1000,
      1.5,
    );
    assert.ok(route);
    assert.ok(route.steps.some(step => step.connectorId !== null));
    const arrival = routeArrivalSecond(route);
    const samples = [1000, 1000 + (arrival - 1000) * 0.05, arrival, arrival + 10].map(second =>
      routePositionAtSecond(route, second),
    );
    assert.equal(samples[0]?.layerId, 'surface');
    assert.deepEqual(samples[2], locationCenter(upper));
    assert.deepEqual(samples[3], locationCenter(upper));
    assert.ok(samples[1] && samples[1].layerId === 'surface');
  });

  it('resumes a snapshot saved during travel to the same route and positions', () => {
    const { state } = startLongWalk();
    const at20 = advanceTo(state, state.second + 20);
    const snapshot = serializeSnapshot(at20);
    assert.equal(snapshot.schemaVersion, 21);
    assert.ok(snapshot.characters.some(character => character.route !== null));
    const resumed = createSimulationFromSnapshot({
      prepared: scenario('market-morning').prepared,
      snapshot,
    });
    assert.deepEqual(
      serializeSnapshot(advanceTo(resumed, state.second + 90)),
      serializeSnapshot(advanceTo(at20, state.second + 90)),
    );
    const legacy = structuredClone(snapshot) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 19;
    for (const character of legacy.characters as Record<string, unknown>[]) {
      delete character.route;
      delete character.directedLocationId;
      delete character.arrivedSecond;
    }
    const migrated = parseSnapshot(legacy);
    assert.ok(
      migrated.characters.every(
        character => character.route === null && character.directedLocationId === null,
      ),
    );
  });
});
