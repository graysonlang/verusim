import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import { BUILT_IN_SCENARIOS } from '../app/scenarios.js';
import {
  EXTERIOR_PROJECTION,
  agentProjectionStyle,
  projectionAfterVerticalStep,
} from '../app/world-view.js';
import {
  advanceSimulation,
  createSimulation,
  createSimulationFromSnapshot,
  evaluateProximity,
  evaluateSpatialPerception,
  environmentLayersTopDown,
  environmentSpatialContextAt,
  findNavigationRoute,
  parseEnvironmentLibrary,
  parseResourceFile,
  serializeSnapshot,
  type EnvironmentLayoutResourceFile,
  type SimulationState,
} from '../src/index.js';

function townScenario() {
  const entry = BUILT_IN_SCENARIOS.find(candidate => candidate.id === 'alders-edge-town');
  assert.ok(entry);
  return entry;
}

function townState(): SimulationState {
  return createSimulation(townScenario().prepared);
}

describe('layered environments', () => {
  it('uses a distinct layout of one stable town identity', () => {
    const town = townState().environment;
    const market = createSimulation(
      BUILT_IN_SCENARIOS.find(candidate => candidate.id === 'market-morning')?.prepared ??
        assert.fail('missing market scenario'),
    ).environment;

    assert.equal(town.environmentId, market.environmentId);
    assert.notEqual(town.layoutId, market.layoutId);
    assert.deepEqual(
      town.layers.map(layer => layer.id),
      ['surface', 'upper', 'cellars'],
    );
    assert.ok(town.locations.length >= 40);
  });

  it('migrates a legacy planar layout onto one surface layer', () => {
    const legacy = structuredClone(townState().environment) as unknown as Record<string, unknown>;
    delete legacy.layers;
    delete legacy.connectors;
    for (const area of legacy.areas as Array<Record<string, unknown>>) delete area.layerId;
    for (const location of legacy.locations as Array<Record<string, unknown>>) {
      delete location.layerId;
    }
    const migrated = parseEnvironmentLibrary({ environments: [legacy], schemaVersion: 1 });

    assert.deepEqual(migrated.environments[0]?.layers, [
      { elevationMeters: 0, id: 'surface', name: 'Surface' },
    ]);
    assert.deepEqual(migrated.environments[0]?.connectors, []);
    assert.equal(migrated.schemaVersion, 3);
    assert.ok(migrated.environments[0]?.areas.every(area => area.layerId === 'surface'));
    const building = migrated.environments[0]?.areas.find(area => area.kind === 'building');
    assert.equal(building?.enclosure, 'interior');
    assert.deepEqual(building?.cover, {
      hearingOcclusion: 0.7,
      overhead: 1,
      sightOcclusion: 1,
    });
    assert.ok(
      migrated.environments[0]?.locations.every(location => location.layerId === 'surface'),
    );
  });

  it('routes a resident from an upstairs home to the trade below through authored stairs', () => {
    const state = townState();
    const mara = state.agents.find(agent => agent.id === 'mara');
    assert.ok(mara);
    const route = findNavigationRoute(state.environment, mara.position, mara.destination);
    assert.ok(route);
    assert.ok(route.steps.some(step => step.connectorId === 'wayfarer-stairs'));

    const arrived = advanceSimulation(state, 4);
    const nextMara = arrived.agents.find(agent => agent.id === 'mara');
    assert.ok(nextMara);
    assert.equal(nextMara.position.layerId, 'surface');
    assert.equal(nextMara.currentLocationId, 'wayfarer-common-room');
  });

  it('does not treat vertically separated characters as co-present at the same plan coordinates', () => {
    const state = townState();
    const layered = {
      ...state,
      agents: state.agents.map(agent =>
        agent.id === 'mara'
          ? { ...agent, position: { layerId: 'upper', x: 100, y: 90 } }
          : agent.id === 'tomas'
            ? { ...agent, position: { layerId: 'surface', x: 100, y: 90 } }
            : agent,
      ),
    };

    const proximity = evaluateProximity(layered, 'mara', 'tomas');
    const perception = evaluateSpatialPerception(layered, 'mara', 'tomas');
    assert.equal(proximity.discomfort, 0);
    assert.equal(perception.sight.available, false);
    assert.equal(perception.hearing.available, false);
    assert.equal(perception.sight.occlusion, 1);
    assert.equal(perception.hearing.occlusion, 1);
  });

  it('preserves layer-bearing travel exactly across snapshot resume', () => {
    const advanced = advanceSimulation(townState(), 2);
    const resumed = createSimulationFromSnapshot({
      prepared: townScenario().prepared,
      snapshot: serializeSnapshot(advanced),
    });

    assert.deepEqual(resumed, advanced);
    assert.equal(serializeSnapshot(resumed).schemaVersion, 13);
  });

  it('rejects a floor that has no authored connection to the layout', () => {
    const input = BUILT_IN_RESOURCES.find(resource =>
      resource.source.endsWith('/alders-edge-town.json'),
    );
    assert.ok(input);
    const malformed = structuredClone(input.value) as EnvironmentLayoutResourceFile;
    malformed.layout.connectors = malformed.layout.connectors.filter(
      connector => connector.from.layerId !== 'cellars' && connector.to.layerId !== 'cellars',
    );

    assert.throws(
      () => parseResourceFile(malformed, 'town-layout.json'),
      /town-layout\.json: .*layer "cellars" is not connected/,
    );
  });

  it('rejects malformed authored cover at its area path', () => {
    const input = BUILT_IN_RESOURCES.find(resource =>
      resource.source.endsWith('/alders-edge-town.json'),
    );
    assert.ok(input);
    const malformed = structuredClone(input.value) as EnvironmentLayoutResourceFile;
    const awning = malformed.layout.areas.find(area => area.id === 'market-cloth-awning');
    assert.ok(awning);
    awning.cover.overhead = 1.2;

    assert.throws(
      () => parseResourceFile(malformed, 'town-layout.json'),
      /town-layout\.json: .*areas\[.*\]\.cover\.overhead: expected a number from 0 through 1/,
    );
  });

  it('orders cutaway controls from exterior through the authored layers top down', () => {
    const state = townState();
    assert.deepEqual(
      environmentLayersTopDown(state.environment).map(layer => layer.id),
      ['upper', 'surface', 'cellars'],
    );
  });

  it('steps projections from the lowest floor through exterior without wrapping', () => {
    const environment = townState().environment;
    const cellar = { kind: 'layer' as const, layerId: 'cellars' };
    const surface = { kind: 'layer' as const, layerId: 'surface' };
    const upper = { kind: 'layer' as const, layerId: 'upper' };
    assert.deepEqual(projectionAfterVerticalStep(environment, cellar, 'lower'), cellar);
    assert.deepEqual(projectionAfterVerticalStep(environment, cellar, 'higher'), surface);
    assert.deepEqual(projectionAfterVerticalStep(environment, surface, 'higher'), upper);
    assert.deepEqual(
      projectionAfterVerticalStep(environment, upper, 'higher'),
      EXTERIOR_PROJECTION,
    );
    assert.deepEqual(
      projectionAfterVerticalStep(environment, EXTERIOR_PROJECTION, 'higher'),
      EXTERIOR_PROJECTION,
    );
    assert.deepEqual(projectionAfterVerticalStep(environment, EXTERIOR_PROJECTION, 'lower'), upper);
  });

  it('keeps inactive interior characters visible but dimmed with their relative level', () => {
    const state = townState();
    const mara = state.agents.find(agent => agent.id === 'mara');
    assert.ok(mara);
    assert.deepEqual(agentProjectionStyle(state.environment, mara, EXTERIOR_PROJECTION), {
      dimmed: true,
      level: 1,
    });
    assert.deepEqual(
      agentProjectionStyle(state.environment, mara, { kind: 'layer', layerId: 'upper' }),
      { dimmed: false, level: null },
    );
    assert.deepEqual(
      agentProjectionStyle(state.environment, mara, { kind: 'layer', layerId: 'cellars' }),
      { dimmed: true, level: 1 },
    );
  });

  it('keeps an awning exterior while composing its independent overhead cover', () => {
    const state = townState();
    const context = environmentSpatialContextAt(state.environment, {
      layerId: 'surface',
      x: 150,
      y: 80,
    });
    assert.equal(context.enclosure, 'exterior');
    assert.equal(context.overheadCover, 0.72);

    const beneathAwning = {
      ...state,
      agents: state.agents.map(agent =>
        agent.id === 'mara'
          ? { ...agent, position: { layerId: 'surface', x: 148, y: 80 } }
          : agent.id === 'tomas'
            ? { ...agent, position: { layerId: 'surface', x: 152, y: 80 } }
            : agent,
      ),
    };
    const inOpenMarket = {
      ...state,
      agents: state.agents.map(agent =>
        agent.id === 'mara'
          ? { ...agent, position: { layerId: 'surface', x: 110, y: 80 } }
          : agent.id === 'tomas'
            ? { ...agent, position: { layerId: 'surface', x: 114, y: 80 } }
            : agent,
      ),
    };
    const covered = evaluateSpatialPerception(beneathAwning, 'mara', 'tomas');
    const open = evaluateSpatialPerception(inOpenMarket, 'mara', 'tomas');
    assert.equal(covered.distanceMeters, open.distanceMeters);
    assert.equal(covered.sight.strength, open.sight.strength);
    assert.equal(covered.hearing.strength, open.hearing.strength);
  });
});
