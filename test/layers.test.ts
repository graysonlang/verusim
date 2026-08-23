import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import { BUILT_IN_SCENARIOS } from '../app/scenarios.js';
import { agentsOnLayer } from '../app/world-view.js';
import {
  advanceSimulation,
  createSimulation,
  createSimulationFromSnapshot,
  evaluateProximity,
  evaluateSpatialPerception,
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
    assert.ok(migrated.environments[0]?.areas.every(area => area.layerId === 'surface'));
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
    assert.equal(serializeSnapshot(resumed).schemaVersion, 10);
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

  it('projects only characters on the selected workbench layer', () => {
    const state = townState();
    assert.deepEqual(
      agentsOnLayer(state.agents, 'upper').map(agent => agent.id),
      ['mara', 'tomas', 'nessa', 'elian', 'sera'],
    );
    assert.deepEqual(agentsOnLayer(state.agents, 'surface'), []);
  });
});
