import { downgradeSnapshotVocabulary } from './legacy.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import aldersEdge from '../content/scenarios/alders-edge-town.json';
import {
  advanceSimulation,
  createResourceCatalog,
  createSimulation,
  createSimulationFromSnapshot,
  parseSnapshot,
  parseScenario,
  prepareScenario,
  serializeSnapshot,
  type AuthoredResource,
  type DyadSeed,
  type NormAddress,
  type NormResourceFile,
  type ScenarioFile,
  type SimulationState,
  type SocialContractResourceFile,
} from '../src/index.js';

const statusNorm: NormAddress = {
  kind: 'norm',
  packageId: 'test',
  resourceId: 'austere-display',
};

const displayResources: AuthoredResource[] = [
  {
    source: 'test/norms/austere-display.json',
    value: {
      address: statusNorm,
      norm: {
        compatibilityTurns: {},
        interpretations: [
          {
            identityStake: 0.7,
            rootImpact: 'public-status-shift',
            turns: { respect: -1 },
          },
        ],
        label: 'Conspicuous display violates austere custom',
      },
      schemaVersion: 2,
    } satisfies NormResourceFile,
  },
  {
    source: 'test/contracts/austere-display.json',
    value: {
      address: { kind: 'social-contract', packageId: 'test', resourceId: 'austere-display' },
      contract: {
        enforcementSeverity: 0.4,
        label: 'Austere display custom',
        norms: [statusNorm],
        summary: 'Visible status claims are treated as vanity.',
      },
      schemaVersion: 2,
    } satisfies SocialContractResourceFile,
  },
];

function dyad(
  observerId: string,
  subjectId: string,
  similarity: number,
  familiarity: number,
): DyadSeed {
  return {
    behaviorVariance: 0.1,
    estimateConfidence: 0.8,
    estimatedDisclosure: 0.5,
    estimatedEmpathy: 0.8,
    exposureDebt: 0,
    features: {
      category: familiarity,
      familiarity,
      kinship: 0,
      reciprocity: familiarity,
      similarity,
    },
    integratedHistory: 0.4,
    mode: 'warm',
    observerId,
    predictionError: 0,
    stance: 0.4,
    subjectId,
    suspicion: 0,
    validatorClaimIds: [],
  };
}

function displayScenario(): ScenarioFile {
  const scenario = parseScenario(aldersEdge);
  const admirer = dyad('tomas', 'mara', 0.49, 1);
  admirer.features.kinship = 0.49;
  scenario.startSecond = 28200;
  scenario.observationEvents = [];
  scenario.incidentEvents = [];
  scenario.dyads = [
    admirer,
    dyad('nessa', 'mara', 1, 1),
    dyad('elian', 'mara', 0, 0),
    dyad('sera', 'mara', 0.1, 1),
  ];
  scenario.socialContractPlacements = [
    {
      contract: { kind: 'social-contract', packageId: 'test', resourceId: 'austere-display' },
      enforcementPresence: 0.5,
      id: 'austere-market-display',
      scope: { kind: 'location', locationId: 'market-square' },
    },
  ];
  for (const placement of scenario.characters) {
    placement.initialValues = {
      ...placement.initialValues,
      respect: { charge: 0, deficitIntegral: 0, variance: 0 },
    };
    placement.position = { layerId: 'surface', x: 138, y: 91 };
    placement.schedule = [
      {
        activity: 'Watching the market display',
        locationId: 'market-square',
        maskingDemand: null,
        recoveryMode: 'none',
        resourceDrainsPerHour: {},
        startSecond: 0,
      },
    ];
    placement.normPerspectives = [
      {
        affiliated: placement.instanceId === 'elian',
        internalization: placement.instanceId === 'elian' ? 1 : 0,
        legibility: 1,
        norm: statusNorm,
      },
    ];
  }
  scenario.displayEvents = [471 * 60, 472 * 60].map((atSecond, index) => ({
    atSecond,
    context: { groupIds: [], institutionIds: [], locationId: 'market-square' },
    displayId: 'silver-brooch',
    domainContested: true,
    habituationPerExposure: 0.5,
    id: `silver-brooch-${index + 1}`,
    magnitude: 0.8,
    observerIds: ['tomas', 'nessa', 'elian', 'sera'],
    statusMarker: 'craft-status',
    summary: 'Mara presents a newly commissioned silver brooch',
    visualProminence: 1,
    wearerId: 'mara',
  }));
  return scenario;
}

function preparedDisplay(scenario: ScenarioFile = displayScenario()) {
  const catalog = createResourceCatalog([...BUILT_IN_RESOURCES, ...displayResources]);
  return prepareScenario({ catalog, scenario });
}

function initialDisplayState(scenario: ScenarioFile = displayScenario()): SimulationState {
  const state = createSimulation(preparedDisplay(scenario));
  return {
    ...state,
    characters: state.characters.map(agent => {
      const identity =
        agent.id === 'sera'
          ? [{ centrality: 1, marker: 'unrelated-status' }]
          : agent.id === 'mara'
            ? null
            : [{ centrality: 1, marker: 'craft-status' }];
      return {
        ...agent,
        history: {
          ...agent.history,
          overrides: {
            ...agent.history.overrides,
            ...(identity === null ? {} : { identity }),
          },
        },
      };
    }),
  };
}

describe('status displays and positional respect', () => {
  it('derives admiration, envy, disdain, and indifference from one display', () => {
    const next = advanceSimulation(initialDisplayState(), 1);
    const appraisals = new Map(
      next.displayRecords[0]?.appraisals.map(appraisal => [appraisal.observerId, appraisal]),
    );
    assert.equal(appraisals.get('tomas')?.outcome, 'admiration');
    assert.equal(appraisals.get('nessa')?.outcome, 'envy');
    assert.equal(appraisals.get('elian')?.outcome, 'disdain');
    assert.equal(appraisals.get('sera')?.outcome, 'indifference');
    assert.ok((appraisals.get('tomas')?.admirationTurn ?? 0) > 0);
    assert.ok((appraisals.get('nessa')?.positionalTurn ?? 0) < 0);
    assert.ok((appraisals.get('elian')?.contractTerms[0]?.conventionalTurns.respect ?? 0) < 0);
    assert.deepEqual(appraisals.get('sera')?.subjectiveTurns, {});
  });

  it('habituates observer response and wearer yield, then replays exactly', () => {
    const initial = initialDisplayState();
    const first = advanceSimulation(initial, 1);
    const second = advanceSimulation(first, 1);
    const firstRecord = first.displayRecords[0];
    const secondRecord = second.displayRecords[1];
    assert.ok(firstRecord);
    assert.ok(secondRecord);
    assert.ok(firstRecord.wearerYield > secondRecord.wearerYield);
    assert.ok(
      (firstRecord.appraisals.find(item => item.observerId === 'tomas')?.admirationTurn ?? 0) >
        (secondRecord.appraisals.find(item => item.observerId === 'tomas')?.admirationTurn ?? 0),
    );
    assert.equal(
      second.displayExposures.find(
        exposure => exposure.observerId === 'tomas' && exposure.displayId === 'silver-brooch',
      )?.exposures,
      2,
    );

    const snapshot = serializeSnapshot(first);
    const resumed = createSimulationFromSnapshot({ prepared: preparedDisplay(), snapshot });
    assert.deepEqual(advanceSimulation(resumed, 1), second);
  });

  it('keeps five exact positional references and deadbands smaller propagation', () => {
    const scenario = displayScenario();
    const observer = scenario.characters.find(placement => placement.instanceId === 'nessa');
    const wearer = scenario.characters.find(placement => placement.instanceId === 'mara');
    assert.ok(observer);
    assert.ok(wearer);
    scenario.characters = [observer, wearer];
    scenario.dyads = [];
    scenario.displayEvents = [];
    for (let index = 0; index < 6; index += 1) {
      const wearerId = `wearer-${index + 1}`;
      scenario.characters.push({ ...structuredClone(wearer), instanceId: wearerId });
      scenario.dyads.push(dyad('nessa', wearerId, 1, 1));
      scenario.displayEvents.push({
        atSecond: 28260 + index * 60,
        context: { groupIds: [], institutionIds: [], locationId: 'market-square' },
        displayId: `rank-display-${index + 1}`,
        domainContested: true,
        habituationPerExposure: 0,
        id: `rank-display-${index + 1}`,
        magnitude: index === 0 ? 0.001 : 0.8,
        observerIds: ['nessa'],
        statusMarker: 'craft-status',
        summary: `Wearer ${index + 1} presents a rank display`,
        visualProminence: 1,
        wearerId,
      });
    }
    const result = advanceSimulation(initialDisplayState(scenario), 6);
    const positional = result.characters.find(agent => agent.id === 'nessa')?.positionalRespect;
    assert.equal(result.displayRecords[0]?.appraisals[0]?.positionalTurn, 0);
    assert.equal(positional?.references.length, 5);
    assert.equal(positional?.ambientCount, 1);
  });

  it('migrates pre-display snapshots to neutral persisted state', () => {
    const snapshot = serializeSnapshot(initialDisplayState());
    const legacy = structuredClone(snapshot) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 14;
    downgradeSnapshotVocabulary(legacy);
    delete legacy.displayExposures;
    delete legacy.displayRecords;
    delete legacy.resolvedDisplayEventIds;
    const scenario = legacy.scenario as Record<string, unknown>;
    scenario.schemaVersion = 15;
    delete scenario.displayEvents;
    for (const agent of legacy.characters as Array<Record<string, unknown>>) {
      delete agent.positionalRespect;
    }

    const migrated = parseSnapshot(legacy);
    assert.equal(migrated.schemaVersion, 19);
    assert.deepEqual(migrated.scenario.displayEvents, []);
    assert.deepEqual(migrated.displayExposures, []);
    assert.deepEqual(migrated.displayRecords, []);
    assert.ok(
      migrated.characters.every(
        agent =>
          agent.positionalRespect.ambientCount === 0 &&
          agent.positionalRespect.references.length === 0,
      ),
    );
  });

  it('rejects a wearer listed as its own observer at the authored path', () => {
    const malformed = displayScenario();
    const event = malformed.displayEvents[0];
    assert.ok(event);
    event.observerIds.push(event.wearerId);
    assert.throws(
      () => preparedDisplay(malformed),
      /scenario\.displayEvents\[0\]\.observerIds\[4\]: the wearer cannot observe its own display/,
    );
  });
});
