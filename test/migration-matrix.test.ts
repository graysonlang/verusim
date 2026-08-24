import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import { BUILT_IN_SCENARIOS } from '../app/scenarios.js';
import {
  createResourceCatalog,
  createSimulation,
  parseResourceFile,
  parseScenario,
  prepareScenario,
  serializeSnapshot,
  advanceSimulation,
} from '../src/index.js';
import { LEGACY_SCENARIO_VERSIONS, downgradeScenario } from './legacy.js';

const catalog = createResourceCatalog(BUILT_IN_RESOURCES);

// A current-schema scenario whose every migratable field holds the value the
// corresponding migration gate would reinstate, so a downgrade to any legacy
// version must migrate back to exactly this parsed value.
const minimalScenario = {
  schemaVersion: 17,
  id: 'migration-matrix',
  title: 'Migration matrix',
  summary: 'A minimal scenario whose legacy downgrades migrate back to itself.',
  startMinute: 600,
  tickMinutes: 1,
  environmentConditions: { season: 'spring', temperatureCelsius: 15, weather: 'clear' },
  dyads: [],
  disclosureItems: [],
  disclosureOpportunities: [],
  observationEvents: [],
  relationshipEvents: [],
  relationshipRequests: [],
  appraisalEvents: [],
  worldFacts: [],
  agendaGoals: [],
  taskOperators: [],
  behaviorOpportunities: [],
  characters: [
    {
      instanceId: 'mara',
      normPerspectives: [],
      position: { x: 50, y: 40, layerId: 'surface' },
      schedule: [
        {
          startMinute: 0,
          locationId: 'common-room',
          activity: 'Holding the common room together',
          recoveryMode: 'none',
          resourceDrainsPerHour: {},
          maskingDemand: null,
        },
      ],
      agency: 'responder',
      narrativeOverrides: [],
      profile: { kind: 'character-profile', packageId: 'verusim', resourceId: 'mara-under-load' },
      initialSomaticSources: [],
    },
  ],
  aspirationOpportunities: [],
  narrativeEvents: [],
  reputationGroups: [],
  environment: { kind: 'environment-layout', packageId: 'verusim', resourceId: 'coping-inn' },
  socialContractPlacements: [],
  legacyLocalNorms: [],
  incidentEvents: [],
  displayEvents: [],
  ambientSomaticSources: [],
  somaticEvents: [],
};

function resource(suffix: string): Record<string, unknown> {
  const entry = BUILT_IN_RESOURCES.find(candidate => candidate.source.endsWith(suffix));
  assert.ok(entry, `missing built-in resource ${suffix}`);
  return structuredClone(entry.value) as Record<string, unknown>;
}

describe('migration matrix', () => {
  it('migrates every supported legacy scenario version back to the current value', () => {
    const current = parseScenario(minimalScenario);
    const prepared = prepareScenario({ catalog, scenario: minimalScenario });
    for (const version of LEGACY_SCENARIO_VERSIONS) {
      const legacy = downgradeScenario(minimalScenario, version);
      assert.equal(legacy.schemaVersion, version);
      assert.deepEqual(parseScenario(legacy), current, `scenario schema version ${version}`);
      assert.deepEqual(
        prepareScenario({ catalog, scenario: legacy }),
        prepared,
        `prepared scenario from schema version ${version}`,
      );
    }
  });

  it('carries every built-in scenario through every legacy version to the same first tick', () => {
    for (const entry of BUILT_IN_SCENARIOS) {
      const currentTick = serializeSnapshot(advanceSimulation(createSimulation(entry.prepared), 1));
      for (const version of LEGACY_SCENARIO_VERSIONS) {
        const legacy = downgradeScenario(entry.scenario, version);
        const migrated = parseScenario(legacy);
        assert.equal(migrated.schemaVersion, 17, `${entry.id} from version ${version}`);
        const prepared = prepareScenario({ catalog, scenario: legacy });
        const tick = serializeSnapshot(advanceSimulation(createSimulation(prepared), 1));
        // Versions before 8 cannot represent norm-typed observation events,
        // and older versions drop authored collections entirely, so only
        // versions that retain every collection must reproduce the tick.
        if (version >= 14) {
          assert.deepEqual(tick, currentTick, `${entry.id} first tick from version ${version}`);
        }
      }
    }
  });

  it('migrates legacy environment, norm, and social-contract resources to their current values', () => {
    const currentLayout = resource('/old-king-road.json');
    const layout = currentLayout.layout as Record<string, unknown>;
    const versionTwo = structuredClone(currentLayout);
    const versionTwoLayout = versionTwo.layout as Record<string, unknown>;
    for (const area of versionTwoLayout.areas as Record<string, unknown>[]) {
      delete area.enclosure;
      delete area.cover;
    }
    versionTwo.schemaVersion = 2;
    const versionOne = structuredClone(versionTwo);
    const versionOneLayout = versionOne.layout as Record<string, unknown>;
    delete versionOneLayout.layers;
    delete versionOneLayout.connectors;
    for (const area of versionOneLayout.areas as Record<string, unknown>[]) delete area.layerId;
    for (const location of versionOneLayout.locations as Record<string, unknown>[]) {
      delete location.layerId;
    }
    versionOne.schemaVersion = 1;
    assert.equal(layout.layoutId, 'old-king-road');
    assert.deepEqual(parseResourceFile(versionTwo), parseResourceFile(currentLayout));
    assert.deepEqual(parseResourceFile(versionOne), parseResourceFile(currentLayout));

    const currentNorm = resource('/market-courtesy.json');
    const legacyNorm = structuredClone(currentNorm);
    delete (legacyNorm.norm as Record<string, unknown>).interpretations;
    legacyNorm.schemaVersion = 1;
    assert.deepEqual(parseResourceFile(legacyNorm), parseResourceFile(currentNorm));

    const currentContract = resource('/market-customs.json');
    const legacyContract = structuredClone(currentContract);
    delete (legacyContract.contract as Record<string, unknown>).enforcementSeverity;
    legacyContract.schemaVersion = 1;
    assert.deepEqual(parseResourceFile(legacyContract), parseResourceFile(currentContract));
  });

  it('reports malformed legacy elements at their indexed authored paths', () => {
    const withBadBlock = downgradeScenario(minimalScenario, 4);
    const placements = withBadBlock.characters as Record<string, unknown>[];
    placements.push(structuredClone(placements[0]) as Record<string, unknown>);
    (placements[1] as Record<string, unknown>).instanceId = 'second';
    (placements[1] as Record<string, unknown>).schedule = ['not a block'];
    assert.throws(() => parseScenario(withBadBlock), /scenario\.characters\[1\]\.schedule\[0\]/);

    const withBadNorm = downgradeScenario(minimalScenario, 13);
    withBadNorm.localNorms = [{ label: 'Nameless', compatibilityTurns: { fairness: 0.2 } }];
    assert.throws(() => parseScenario(withBadNorm), /scenario\.localNorms\[0\]\.id/);

    const withBadArea = resource('/old-king-road.json');
    (withBadArea.layout as Record<string, unknown>).areas = [
      ...((withBadArea.layout as Record<string, unknown>).areas as unknown[]),
      42,
    ];
    withBadArea.schemaVersion = 1;
    for (const area of (withBadArea.layout as Record<string, unknown>).areas as unknown[]) {
      if (typeof area === 'object' && area !== null) {
        delete (area as Record<string, unknown>).layerId;
        delete (area as Record<string, unknown>).enclosure;
        delete (area as Record<string, unknown>).cover;
      }
    }
    assert.throws(() => parseResourceFile(withBadArea), /areas\[\d+\]/);
  });
});
