import { downgradeSnapshotVocabulary } from './legacy.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import cascadeScenario from '../content/scenarios/cascade-room.json';
import {
  advanceSimulation,
  advanceSomaticState,
  createSimulation,
  createSimulationFromSnapshot,
  createSomaticState,
  effectiveValueWeights,
  evaluateEmpathy,
  parseSnapshot,
  parseScenario,
  serializeSnapshot,
  type ScenarioFile,
  type SimulationState,
  type SomaticSourceSeed,
} from '../src/index.js';
import { characters, environments } from './fixtures.js';

function somaticSource(id: string, overrides: Partial<SomaticSourceSeed> = {}): SomaticSourceSeed {
  return {
    attentionTax: 0,
    cadence: 'fluctuating',
    copingPotential: 1,
    id,
    impairment: 0,
    label: id,
    origin: 'event',
    pain: 0,
    perceivedUrgency: 0,
    preemption: 'none',
    visible: 0,
    ...overrides,
  };
}

function strippedScenario(): ScenarioFile {
  const scenario = parseScenario(cascadeScenario);
  scenario.appraisalEvents = [];
  scenario.behaviorOpportunities = [];
  scenario.relationshipRequests = [];
  scenario.somaticEvents = [];
  return scenario;
}

function createSomaticSimulation(scenario: ScenarioFile): SimulationState {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario,
  });
}

function setInitialSource(
  scenario: ScenarioFile,
  instanceId: string,
  source: SomaticSourceSeed,
): void {
  const placement = scenario.characters.find(character => character.instanceId === instanceId);
  assert.ok(placement);
  placement.initialSomaticSources = [{ ...source, origin: 'activity' }];
}

function crowdScenario(observerIds: string[]): ScenarioFile {
  const scenario = strippedScenario();
  scenario.somaticEvents = [
    {
      instanceId: 'witness',
      atSecond: 36060,
      id: 'witness-incapacitated',
      observerIds,
      operation: 'set',
      source: somaticSource('collapse', {
        impairment: 1,
        perceivedUrgency: 1,
        preemption: 'incapacitated',
        visible: 1,
      }),
      sourceId: 'collapse',
      summary: 'The witness collapses.',
      visualProminence: 1,
    },
  ];
  return scenario;
}

function conditionCrowdObservers(state: SimulationState): SimulationState {
  return {
    ...state,
    characters: state.characters.map(agent => {
      if (agent.id === 'therapist') {
        return {
          ...agent,
          history: {
            ...agent.history,
            overrides: {
              ...agent.history.overrides,
              cascadePriors: { freeze: 0 },
              contractAdherence: 1,
              empathy: { ceiling: 1, floor: 0.95, steepness: 0.01 },
              satisfierPreferences: [
                { flavor: 'practical aid', type: 'surplus', valueId: 'competence' },
              ],
            },
          },
        };
      }
      if (agent.id === 'abuser') {
        return {
          ...agent,
          history: {
            ...agent.history,
            overrides: {
              ...agent.history.overrides,
              cascadePriors: { freeze: 1 },
              contractAdherence: 0,
              empathy: { ceiling: 0.05, floor: 0, steepness: 12 },
              satisfierPreferences: [],
              valueWeights: { competence: 0 },
            },
          },
        };
      }
      return agent;
    }),
  };
}

describe('somatic state and preemption', () => {
  it('keeps pain and perceived urgency independent across four profiles', () => {
    const profiles = [
      createSomaticState([
        somaticSource('high-pain-low-urgency', { pain: 0.9, perceivedUrgency: 0.1 }),
      ]),
      createSomaticState([
        somaticSource('low-pain-high-urgency', { pain: 0.1, perceivedUrgency: 0.9 }),
      ]),
      createSomaticState([
        somaticSource('high-pain-high-urgency', { pain: 0.9, perceivedUrgency: 0.9 }),
      ]),
      createSomaticState([
        somaticSource('low-pain-low-urgency', { pain: 0.1, perceivedUrgency: 0.1 }),
      ]),
    ];

    assert.deepEqual(
      profiles.map(profile => [profile.pain, profile.perceivedUrgency]),
      [
        [0.9, 0.1],
        [0.1, 0.9],
        [0.9, 0.9],
        [0.1, 0.1],
      ],
    );
  });

  it('habituates a steady discomfort while retaining fluctuating discomfort', () => {
    const steady = createSomaticState([
      somaticSource('steady', { attentionTax: 0.8, cadence: 'steady' }),
    ]);
    const fluctuating = createSomaticState([
      somaticSource('fluctuating', { attentionTax: 0.8, cadence: 'fluctuating' }),
    ]);
    const advancedSteady = advanceSomaticState(steady, 60);
    const advancedFluctuating = advanceSomaticState(fluctuating, 60);

    assert.ok(advancedSteady.attentionTax < advancedFluctuating.attentionTax);
    assert.ok(
      (advancedSteady.sources[0]?.habituation ?? 0) >
        (advancedFluctuating.sources[0]?.habituation ?? 0),
    );
    assert.equal(advancedFluctuating.sources[0]?.habituation, fluctuating.sources[0]?.habituation);
  });

  it('lets ambient discomfort hasten cascade descent without changing empathy or value weights', () => {
    const baselineScenario = parseScenario(cascadeScenario);
    const event = baselineScenario.appraisalEvents[0];
    assert.ok(event);
    event.threat = 0.1;
    event.copingPotential = 0.8;
    const discomfortScenario = structuredClone(baselineScenario);
    discomfortScenario.ambientSomaticSources = [
      somaticSource('ambient-discomfort', {
        attentionTax: 1,
        copingPotential: 0,
        origin: 'environment',
      }),
    ];
    const baseline = createSomaticSimulation(baselineScenario);
    const discomfort = createSomaticSimulation(discomfortScenario);
    const baselineWitness = baseline.characters.find(agent => agent.id === 'witness');
    const discomfortWitness = discomfort.characters.find(agent => agent.id === 'witness');
    assert.ok(baselineWitness);
    assert.ok(discomfortWitness);

    assert.deepEqual(
      effectiveValueWeights(discomfortWitness),
      effectiveValueWeights(baselineWitness),
    );
    assert.equal(
      evaluateEmpathy(discomfort, 'witness', 'therapist').empathy,
      evaluateEmpathy(baseline, 'witness', 'therapist').empathy,
    );

    const baselineAfter = advanceSimulation(baseline, 1);
    const discomfortAfter = advanceSimulation(discomfort, 1);
    const baselineRecord = baselineAfter.appraisalRecords[0];
    const discomfortRecord = discomfortAfter.appraisalRecords[0];
    assert.ok(baselineRecord);
    assert.ok(discomfortRecord);
    assert.ok(discomfortRecord.cascadeLoad > baselineRecord.cascadeLoad);
    assert.equal(baselineRecord.nextCascade, 'none');
    assert.notEqual(discomfortRecord.nextCascade, 'none');
  });

  it('restricts level-two actions before ordinary appraisal', () => {
    const scenario = strippedScenario();
    setInitialSource(scenario, 'witness', somaticSource('impaired', { impairment: 0.6 }));
    scenario.behaviorOpportunities = [
      {
        actorId: 'witness',
        atSecond: 36060,
        candidates: [
          {
            claimExpressions: [],
            contractViolation: 0,
            id: 'demanding-action',
            impacts: [{ subjectId: 'witness', turns: { competence: 0.8 } }],
            label: 'Demanding action',
            operation: 'demanding-action',
            repercussionSeverity: 0,
            selfDirected: false,
            somaticDemand: 0.8,
          },
          {
            claimExpressions: [],
            contractViolation: 0,
            id: 'available-action',
            impacts: [{ subjectId: 'witness', turns: { competence: 0.1 } }],
            label: 'Available action',
            operation: 'available-action',
            repercussionSeverity: 0,
            selfDirected: false,
            somaticDemand: 0.2,
          },
        ],
        context: {
          enforcementPresence: 0,
          networkConductivity: 0,
          perceivedThreat: 0,
          witnessIds: [],
        },
        id: 'impaired-choice',
        targetId: null,
      },
    ];

    const result = advanceSimulation(createSomaticSimulation(scenario), 1);
    assert.deepEqual(
      result.decisions[0]?.candidates.map(candidate => candidate.candidateId),
      ['available-action'],
    );
    assert.equal(result.decisions[0]?.selectedCandidateId, 'available-action');
    assert.equal(
      result.trace.entries.find(entry => entry.id.endsWith('impaired-choice:somatic-gate'))
        ?.selection?.selectedId,
      'available-action',
    );
  });

  it('records graded impairment as observer-inferred evidence', () => {
    const scenario = strippedScenario();
    scenario.somaticEvents = [
      {
        instanceId: 'witness',
        atSecond: 36060,
        id: 'subtle-impairment',
        observerIds: ['therapist'],
        operation: 'set',
        source: somaticSource('impairment', { impairment: 0.4, visible: 0.4 }),
        sourceId: 'impairment',
        summary: 'The witness begins moving carefully.',
        visualProminence: 1,
      },
      {
        instanceId: 'witness',
        atSecond: 36120,
        id: 'marked-impairment',
        observerIds: ['therapist'],
        operation: 'set',
        source: somaticSource('impairment', { impairment: 0.8, visible: 1 }),
        sourceId: 'impairment',
        summary: 'The witness struggles to remain upright.',
        visualProminence: 1,
      },
    ];

    const result = advanceSimulation(createSomaticSimulation(scenario), 2);
    const subtle = result.somaticRecords[0]?.observations[0];
    const marked = result.somaticRecords[1]?.observations[0];
    assert.ok(subtle?.inferredSeverity !== null && subtle?.inferredSeverity !== undefined);
    assert.ok(marked?.inferredSeverity !== null && marked?.inferredSeverity !== undefined);
    assert.ok(marked.inferredSeverity > subtle.inferredSeverity);
    assert.equal('level' in marked, false);
    assert.equal(
      result.characters.find(agent => agent.id === 'witness')?.somatic.sources[0]?.impairment,
      0.8,
    );
  });

  it('preempts ordinary appraisal during an emergency', () => {
    const scenario = strippedScenario();
    scenario.somaticEvents = [
      {
        instanceId: 'witness',
        atSecond: 36060,
        id: 'acute-emergency',
        observerIds: [],
        operation: 'set',
        source: somaticSource('acute-emergency', {
          impairment: 0.8,
          perceivedUrgency: 1,
          preemption: 'emergency',
        }),
        sourceId: 'acute-emergency',
        summary: 'The witness faces an acute emergency.',
        visualProminence: 0,
      },
    ];
    scenario.behaviorOpportunities = [
      {
        actorId: 'witness',
        atSecond: 36060,
        candidates: [
          {
            claimExpressions: [],
            contractViolation: 0,
            id: 'social-response',
            impacts: [{ subjectId: 'therapist', turns: { respect: 0.5 } }],
            label: 'Attend to the therapist',
            operation: 'social-response',
            repercussionSeverity: 0,
            selfDirected: false,
            somaticDemand: 0,
          },
          {
            claimExpressions: [],
            contractViolation: 0,
            id: 'self-preservation',
            impacts: [{ subjectId: 'witness', turns: { safety: 0.1 } }],
            label: 'Protect self',
            operation: 'self-preservation',
            repercussionSeverity: 0,
            selfDirected: true,
            somaticDemand: 0,
          },
        ],
        context: {
          enforcementPresence: 1,
          networkConductivity: 1,
          perceivedThreat: 1,
          witnessIds: ['therapist'],
        },
        id: 'emergency-choice',
        targetId: 'therapist',
      },
    ];

    const result = advanceSimulation(createSomaticSimulation(scenario), 1);
    const gate = result.trace.entries.find(entry =>
      entry.id.endsWith('emergency-choice:somatic-gate'),
    );
    assert.equal(result.decisions.length, 0);
    assert.equal(gate?.selection?.selectedId, 'self-preservation');
    assert.deepEqual(
      gate?.terms.map(term => term.id),
      ['somatic-level', 'somatic-impairment', 'removed:0'],
    );
    assert.equal(
      result.trace.entries.some(entry => entry.id.includes('emergency-choice:appraisal')),
      false,
    );
  });

  it('turns incapacity into heterogeneous crowd response with diffusion and exact replay', () => {
    const single = advanceSimulation(
      conditionCrowdObservers(createSomaticSimulation(crowdScenario(['therapist']))),
      1,
    );
    const crowded = advanceSimulation(
      conditionCrowdObservers(createSomaticSimulation(crowdScenario(['therapist', 'abuser']))),
      1,
    );
    const singleTherapist = single.somaticRecords[0]?.observations.find(
      observation => observation.observerId === 'therapist',
    );
    const crowdedObservations = crowded.somaticRecords[0]?.observations ?? [];
    const crowdedTherapist = crowdedObservations.find(
      observation => observation.observerId === 'therapist',
    );
    assert.ok(singleTherapist);
    assert.ok(crowdedTherapist);
    assert.ok(singleTherapist.helpProbability > crowdedTherapist.helpProbability);
    assert.equal(new Set(crowdedObservations.map(observation => observation.response)).size, 2);
    const incapacitated = crowded.characters.find(agent => agent.id === 'witness');
    assert.ok(incapacitated);
    const withoutAgency = advanceSimulation(crowded, 1).characters.find(
      agent => agent.id === 'witness',
    );
    assert.equal(withoutAgency?.currentActivity, 'Incapacitated');
    assert.deepEqual(withoutAgency?.position, incapacitated.position);

    const snapshot = serializeSnapshot(crowded);
    const resumed = createSimulationFromSnapshot({
      characterLibrary: characters,
      environmentLibrary: environments,
      snapshot,
    });
    assert.deepEqual(serializeSnapshot(resumed), snapshot);
  });

  it('migrates neutral somatic state and rejects an inconsistent snapshot ledger', () => {
    const scenario = strippedScenario();
    const legacyScenario = structuredClone(scenario) as unknown as Record<string, unknown>;
    legacyScenario.schemaVersion = 16;
    delete legacyScenario.ambientSomaticSources;
    delete legacyScenario.somaticEvents;
    for (const characterValue of legacyScenario.characters as Array<Record<string, unknown>>) {
      delete characterValue.initialSomaticSources;
    }
    const migratedScenario = parseScenario(legacyScenario);
    assert.equal(migratedScenario.schemaVersion, 19);
    assert.deepEqual(migratedScenario.ambientSomaticSources, []);
    assert.ok(
      migratedScenario.characters.every(character => character.initialSomaticSources.length === 0),
    );

    const currentSnapshot = serializeSnapshot(createSomaticSimulation(scenario));
    const legacySnapshot = structuredClone(currentSnapshot) as unknown as Record<string, unknown>;
    legacySnapshot.schemaVersion = 15;
    downgradeSnapshotVocabulary(legacySnapshot);
    delete legacySnapshot.resolvedSomaticEventIds;
    delete legacySnapshot.somaticRecords;
    for (const agentValue of legacySnapshot.characters as Array<Record<string, unknown>>) {
      delete agentValue.somatic;
    }
    const migratedSnapshot = parseSnapshot(legacySnapshot);
    assert.equal(migratedSnapshot.schemaVersion, 21);
    assert.deepEqual(migratedSnapshot.somaticRecords, []);
    assert.ok(migratedSnapshot.characters.every(agent => agent.somatic.level === 0));

    const inconsistent = structuredClone(currentSnapshot);
    const witness = inconsistent.characters.find(agent => agent.id === 'witness');
    assert.ok(witness);
    witness.somatic.attentionTax = 0.5;
    assert.throws(
      () =>
        createSimulationFromSnapshot({
          characterLibrary: characters,
          environmentLibrary: environments,
          snapshot: inconsistent,
        }),
      /snapshot\.characters\[0\]\.somatic.*exact sorted somatic source ledger/,
    );
  });
});
