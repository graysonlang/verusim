import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import pottsfield from '../content/scenarios/pottsfield.json';
import {
  advanceSimulation,
  createResourceCatalog,
  createSimulation,
  createSimulationFromSnapshot,
  evaluateOpportunity,
  generateIncident,
  parseScenario,
  prepareScenario,
  serializeSnapshot,
  type AuthoredResource,
  type IncidentEvent,
  type NormAddress,
  type NormResourceFile,
  type ScenarioFile,
  type SocialContractResourceFile,
} from '../src/index.js';

const welcomeAddress: NormAddress = {
  kind: 'norm',
  packageId: 'test',
  resourceId: 'welcome-breakage',
};
const austerityAddress: NormAddress = {
  kind: 'norm',
  packageId: 'test',
  resourceId: 'austere-breakage',
};

const socialResources: AuthoredResource[] = [
  {
    source: 'test/norms/welcome-breakage.json',
    value: {
      address: welcomeAddress,
      norm: {
        compatibilityTurns: {},
        interpretations: [
          {
            identityStake: 0.8,
            rootImpact: 'norm-violation',
            turns: { belonging: 0.5, fairness: 0.7 },
          },
        ],
        label: 'Accidents should be met with communal grace',
      },
      schemaVersion: 2,
    } satisfies NormResourceFile,
  },
  {
    source: 'test/norms/austere-breakage.json',
    value: {
      address: austerityAddress,
      norm: {
        compatibilityTurns: {},
        interpretations: [
          {
            identityStake: 0.6,
            rootImpact: 'norm-violation',
            turns: { fairness: -0.6, respect: -0.5 },
          },
        ],
        label: 'Public carelessness dishonors the market',
      },
      schemaVersion: 2,
    } satisfies NormResourceFile,
  },
  {
    source: 'test/contracts/welcome.json',
    value: {
      address: { kind: 'social-contract', packageId: 'test', resourceId: 'welcome' },
      contract: {
        enforcementSeverity: 0.2,
        label: 'Welcoming custom',
        norms: [welcomeAddress],
        summary: 'Accidents receive a generous reading.',
      },
      schemaVersion: 2,
    } satisfies SocialContractResourceFile,
  },
  {
    source: 'test/contracts/austerity.json',
    value: {
      address: { kind: 'social-contract', packageId: 'test', resourceId: 'austerity' },
      contract: {
        enforcementSeverity: 0.9,
        label: 'Austere custom',
        norms: [austerityAddress],
        summary: 'Carelessness in public is censured.',
      },
      schemaVersion: 2,
    } satisfies SocialContractResourceFile,
  },
];

function incidentEvent(): IncidentEvent {
  return {
    actorId: 'reeve',
    affectedInstanceId: 'resident',
    atSecond: 36060,
    attribution: 'ambiguous',
    audibleRadiusMeters: 20,
    context: { groupIds: [], institutionIds: [], locationId: 'market-square' },
    generation: null,
    id: 'broken-vessel',
    interpretationDifficulty: 0.3,
    magnitude: 0.8,
    observerIds: ['resident', 'visitor', 'reeve'],
    publicity: 'public',
    rootImpact: 'norm-violation',
    summary: 'the reeve dropped a ceremonial vessel beside the resident',
    visualProminence: 1,
    volition: 'involuntary',
  };
}

function incidentScenario(): ScenarioFile {
  const scenario = parseScenario(pottsfield);
  scenario.observationEvents = [];
  scenario.incidentEvents = [incidentEvent()];
  scenario.socialContractPlacements = [
    {
      contract: { kind: 'social-contract', packageId: 'test', resourceId: 'welcome' },
      enforcementPresence: 0.2,
      id: 'welcome-market',
      scope: { kind: 'location', locationId: 'market-square' },
    },
    {
      contract: { kind: 'social-contract', packageId: 'test', resourceId: 'austerity' },
      enforcementPresence: 0.8,
      id: 'austere-market',
      scope: { eventId: 'broken-vessel', kind: 'event' },
    },
  ];
  const resident = scenario.characters.find(placement => placement.instanceId === 'resident');
  const visitor = scenario.characters.find(placement => placement.instanceId === 'visitor');
  const reeve = scenario.characters.find(placement => placement.instanceId === 'reeve');
  assert.ok(resident);
  assert.ok(visitor);
  assert.ok(reeve);
  resident.normPerspectives = [
    { affiliated: true, internalization: 1, legibility: 0, norm: welcomeAddress },
    { affiliated: true, internalization: 1, legibility: 1, norm: austerityAddress },
  ];
  visitor.normPerspectives = [
    { affiliated: false, internalization: 0, legibility: 1, norm: welcomeAddress },
    { affiliated: false, internalization: 0, legibility: 1, norm: austerityAddress },
  ];
  reeve.normPerspectives = [
    { affiliated: true, internalization: 0, legibility: 1, norm: welcomeAddress },
    { affiliated: true, internalization: 0, legibility: 1, norm: austerityAddress },
  ];
  scenario.dyads.push(
    {
      behaviorVariance: 0.1,
      estimateConfidence: 0.8,
      estimatedDisclosure: 0.5,
      estimatedEmpathy: 0.8,
      exposureDebt: 0,
      features: { category: 1, familiarity: 0.8, kinship: 0, reciprocity: 0.7, similarity: 0.7 },
      integratedHistory: 0.4,
      mode: 'warm',
      observerId: 'reeve',
      predictionError: 0,
      stance: 0.5,
      subjectId: 'visitor',
      suspicion: 0,
      validatorClaimIds: [],
    },
    {
      behaviorVariance: 0.1,
      estimateConfidence: 0.8,
      estimatedDisclosure: 0.5,
      estimatedEmpathy: 0.8,
      exposureDebt: 0,
      features: { category: 1, familiarity: 0.8, kinship: 0, reciprocity: 0.7, similarity: 0.7 },
      integratedHistory: 0.4,
      mode: 'warm',
      observerId: 'reeve',
      predictionError: 0,
      stance: 0.5,
      subjectId: 'resident',
      suspicion: 0,
      validatorClaimIds: [],
    },
  );
  return scenario;
}

function incidentState(input: ScenarioFile = incidentScenario()) {
  const catalog = createResourceCatalog([...BUILT_IN_RESOURCES, ...socialResources]);
  return createSimulation(prepareScenario({ catalog, scenario: input }));
}

function preparedIncident(input: ScenarioFile = incidentScenario()) {
  const catalog = createResourceCatalog([...BUILT_IN_RESOURCES, ...socialResources]);
  return prepareScenario({ catalog, scenario: input });
}

describe('objective incidents and social interpretation', () => {
  it('lets friend and rival models resolve one ambiguous event differently', () => {
    const next = advanceSimulation(incidentState(), 1);
    const resident = next.incidentRecords.find(record => record.observerId === 'resident');
    const visitor = next.incidentRecords.find(record => record.observerId === 'visitor');
    assert.equal(resident?.perceivedAttribution, 'nobody');
    assert.equal(visitor?.perceivedAttribution, 'other');
    assert.ok(
      (next.dyads.find(dyad => dyad.observerId === 'visitor' && dyad.subjectId === 'reeve')
        ?.suspicion ?? 0) > 0.35,
    );
  });

  it('keeps affiliation, internalization, legibility, and enforcement separate', () => {
    const next = advanceSimulation(incidentState(), 1);
    const resident = next.incidentRecords.find(record => record.observerId === 'resident');
    const visitor = next.incidentRecords.find(record => record.observerId === 'visitor');
    const dissenter = next.incidentRecords.find(record => record.observerId === 'reeve');
    assert.ok(resident);
    assert.ok(visitor);
    assert.ok(dissenter);

    assert.equal(resident.contractTerms[0]?.affiliated, true);
    assert.equal(resident.contractTerms[0]?.legibility, 0);
    assert.ok((resident.contractTerms[0]?.internalization ?? 0) > 0);
    assert.deepEqual(
      visitor.contractTerms.flatMap(term => Object.values(term.conventionalTurns)),
      [],
    );
    assert.equal(visitor.contractTerms[0]?.affiliated, false);
    assert.equal(visitor.contractTerms[0]?.legibility, 1);
    assert.equal(dissenter.contractTerms[0]?.affiliated, true);
    assert.equal(dissenter.contractTerms[0]?.internalization, 0);
    assert.notDeepEqual(
      resident.contractTerms[0]?.conventionalTurns,
      dissenter.contractTerms[0]?.conventionalTurns,
    );
    assert.ok((visitor.contractTerms[1]?.enforcementPressure ?? 0) > 0);
  });

  it('lets anticipated enforcement produce compliance without agreement', () => {
    const state = incidentState();
    const opportunity = {
      actorId: 'visitor',
      atSecond: state.second,
      candidates: [
        {
          claimExpressions: [],
          contractViolation: 0,
          id: 'comply',
          impacts: [],
          label: 'Comply without agreement',
          operation: 'comply',
          repercussionSeverity: 0,
          selfDirected: false,
          somaticDemand: 0,
        },
        {
          claimExpressions: [],
          contractViolation: 0,
          id: 'violate',
          impacts: [{ subjectId: 'visitor', turns: { competence: 0.1 } }],
          label: 'Violate the convention',
          operation: 'violate',
          repercussionSeverity: 1,
          selfDirected: false,
          somaticDemand: 0,
        },
      ],
      context: {
        enforcementPresence: 0,
        networkConductivity: 1,
        perceivedThreat: 0,
        witnessIds: ['resident'],
      },
      id: 'public-compliance',
      targetId: null,
    };
    const withoutEnforcement = evaluateOpportunity(state, opportunity);
    const withEnforcement = evaluateOpportunity(state, {
      ...opportunity,
      context: { ...opportunity.context, enforcementPresence: 1 },
    });
    const enforcedViolation = withEnforcement.candidates.find(
      candidate => candidate.candidateId === 'violate',
    );

    assert.equal(withoutEnforcement.selectedCandidateId, 'violate');
    assert.equal(withEnforcement.selectedCandidateId, 'comply');
    assert.equal(enforcedViolation?.appraisal.contractViolationCost, 0);
    assert.ok((enforcedViolation?.repercussion.cost ?? 0) > 0);
  });

  it('preserves conflicting contracts and derives shame only for identity-bound audience appraisal', () => {
    const next = advanceSimulation(incidentState(), 1);
    const resident = next.incidentRecords.find(record => record.observerId === 'resident');
    const reeve = next.incidentRecords.find(record => record.observerId === 'reeve');
    assert.ok(resident);
    assert.ok(reeve);
    assert.equal(resident.contractTerms.length, 2);
    assert.ok((resident.contractTerms[0]?.conventionalTurns.fairness ?? 0) > 0);
    assert.ok((resident.contractTerms[1]?.conventionalTurns.fairness ?? 0) < 0);
    assert.equal(reeve.shameTurn, 0);

    const identityBound = incidentScenario();
    const actor = identityBound.characters.find(placement => placement.instanceId === 'reeve');
    assert.ok(actor);
    actor.normPerspectives = actor.normPerspectives.map(perspective => ({
      ...perspective,
      internalization: 1,
    }));
    const shamed = advanceSimulation(incidentState(identityBound), 1).incidentRecords.find(
      record => record.observerId === 'reeve',
    );
    assert.ok((shamed?.shameTurn ?? 0) < 0);
  });

  it('changes pressure with active context and replays incident aftermath exactly', () => {
    const active = advanceSimulation(incidentState(), 1);
    const inactiveScenario = incidentScenario();
    const inactiveEvent = inactiveScenario.incidentEvents[0];
    assert.ok(inactiveEvent);
    inactiveEvent.context.locationId = 'iron-yard';
    inactiveScenario.socialContractPlacements = inactiveScenario.socialContractPlacements.filter(
      placement => placement.scope.kind === 'location',
    );
    const inactive = advanceSimulation(incidentState(inactiveScenario), 1);
    const activeRecord = active.incidentRecords[0];
    const inactiveRecord = inactive.incidentRecords[0];
    assert.ok(activeRecord);
    assert.ok(inactiveRecord);
    assert.ok(activeRecord.contractTerms.length > inactiveRecord.contractTerms.length);

    const snapshot = serializeSnapshot(active);
    const resumed = createSimulationFromSnapshot({ prepared: preparedIncident(), snapshot });
    assert.deepEqual(snapshot.incidentRecords, active.incidentRecords);
    assert.deepEqual(serializeSnapshot(resumed), snapshot);
  });
});

describe('seeded incident sampling', () => {
  it('uses the perceptual shell, depletion weights, and a replayable long-tail draw', () => {
    const state = incidentState();
    const depleted = {
      ...state,
      characters: state.characters.map(agent =>
        agent.id === 'resident'
          ? {
              ...agent,
              resources: {
                executiveBudget: 0,
                physicalStamina: 0,
                regulationReserve: 0,
                socialBattery: 0,
              },
            }
          : agent,
      ),
    };
    const request = {
      atSecond: 36060,
      audibleRadiusMeters: 20,
      baseRate: 1,
      context: { groupIds: [], institutionIds: [], locationId: 'market-square' },
      id: 'seeded-incident',
      interpretationDifficulty: 0.2,
      referenceObserverId: 'reeve',
      seed: 41,
      state: depleted,
      templates: [
        {
          affectedInstanceId: null,
          attribution: 'ambiguous' as const,
          contradictedClaimId: null,
          id: 'spill',
          magnitude: { maximum: 0.9, minimum: 0.1 },
          publicity: 'public' as const,
          rootImpact: 'material-loss' as const,
          summary: 'a vessel slipped from an unsteady hand',
          volition: 'careless' as const,
          weight: 1,
        },
      ],
      visualProminence: 1,
    };
    const first = generateIncident(request);
    const second = generateIncident(request);
    assert.deepEqual(second, first);
    assert.ok(first.event);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.event));
    const weights = new Map(
      first.generation.eligibleWeights.map(item => [item.instanceId, item.weight]),
    );
    assert.ok((weights.get('resident') ?? 0) > (weights.get('visitor') ?? 0));
    assert.equal(first.event.generation?.samplerEnd, first.generation.samplerEnd);

    const scenario = incidentScenario();
    scenario.incidentEvents = [first.event];
    assert.deepEqual(parseScenario(scenario).incidentEvents[0], first.event);
  });
});
