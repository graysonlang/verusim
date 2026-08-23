import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { characters, environments } from './fixtures.js';
import narrativeScenario from '../scenarios/narrative-agency.json';
import {
  advanceSimulation,
  createSimulation,
  createSimulationFromSnapshot,
  describeAgent,
  evaluateRelationshipRequest,
  parseCharacterLibrary,
  parseScenario,
  promoteToInvoker,
  resolveNarrativeEvent,
  serializeSnapshot,
  setAgentResource,
  type AttributionEvent,
  type ScenarioFile,
} from '../src/index.js';

const YEAR_MINUTES = 365 * 24 * 60;

function createNarrativeSimulation(
  input: unknown = narrativeScenario,
  library: unknown = characters,
) {
  return createSimulation({
    characterLibrary: library,
    environmentLibrary: environments,
    scenario: input,
  });
}

function expressionScenario(valueId: 'belonging' | 'competence'): ScenarioFile {
  const scenario = parseScenario(narrativeScenario);
  const placement = scenario.characters.find(candidate => candidate.instanceId === 'invoker');
  assert.ok(placement);
  placement.initialValues = {
    belonging: {
      charge: valueId === 'belonging' ? -0.8 : 0.5,
      deficitIntegral: valueId === 'belonging' ? 1 : 0,
      variance: 0.1,
    },
    competence: {
      charge: valueId === 'competence' ? -0.8 : 0.5,
      deficitIntegral: valueId === 'competence' ? 1 : 0,
      variance: 0.1,
    },
  };
  scenario.behaviorOpportunities = [
    {
      actorId: 'invoker',
      atMinute: 1,
      candidates: [
        {
          claimExpressions: [{ claimId: 'claim-1', strength: 1, valueId: 'belonging' }],
          contractViolation: 0,
          id: 'express-belonging',
          impacts: [],
          label: 'Express care through presence',
          operation: 'express-belonging',
          repercussionSeverity: 0,
        },
        {
          claimExpressions: [{ claimId: 'claim-1', strength: 1, valueId: 'competence' }],
          contractViolation: 0,
          id: 'express-competence',
          impacts: [],
          label: 'Express care through skilled work',
          operation: 'express-competence',
          repercussionSeverity: 0,
        },
      ],
      context: {
        enforcementPresence: 0,
        networkConductivity: 0,
        perceivedThreat: 0,
        witnessIds: [],
      },
      id: 'expression-choice',
      targetId: null,
    },
  ];
  return scenario;
}

describe('narrative-driven agency', () => {
  it('separates four self-deprecation paths when another character agrees', () => {
    const resolved = advanceSimulation(createNarrativeSimulation(), 1);
    const dispositions = new Map(
      resolved.narrativeRecords.map(record => [record.actorId, record.disposition]),
    );

    assert.equal(dispositions.get('fishing'), 'fishing');
    assert.equal(dispositions.get('preemptive'), 'preemptive-shame');
    assert.equal(dispositions.get('genuine'), 'genuine');
    assert.equal(dispositions.get('lowering'), 'status-lowering');
    assert.ok(
      resolved.disclosureItems
        .find(item => item.id === 'shame-item')
        ?.knownByIds.includes('dominant'),
    );
  });

  it('chooses different expression channels for the same claim under different histories', () => {
    const belonging = advanceSimulation(
      createNarrativeSimulation(expressionScenario('belonging')),
      1,
    );
    const competence = advanceSimulation(
      createNarrativeSimulation(expressionScenario('competence')),
      1,
    );

    assert.equal(belonging.decisions.at(-1)?.selectedCandidateId, 'express-belonging');
    assert.equal(competence.decisions.at(-1)?.selectedCandidateId, 'express-competence');
  });

  it('reinterprets an adult contradiction by default but permits rare revision', () => {
    const ordinary = advanceSimulation(createNarrativeSimulation(), 1);
    assert.equal(
      ordinary.narrativeRecords.find(record => record.eventId === 'contradict-invoker')
        ?.disposition,
      'reinterpreted',
    );

    const library = parseCharacterLibrary(characters);
    const profile = library.characters.find(candidate => candidate.profileId === 'nessa-arden');
    assert.ok(profile);
    profile.physical.ageYears = 16;
    profile.formativeEvents = profile.formativeEvents.filter(event => event.age <= 16);
    const claim = profile.narrativeClaims[0];
    assert.ok(claim);
    claim.commitment = 0.1;
    claim.confidence = 0.1;
    const scenario = parseScenario(narrativeScenario);
    const placement = scenario.characters.find(candidate => candidate.instanceId === 'invoker');
    assert.ok(placement);
    placement.narrativeOverrides = [];
    scenario.narrativeEvents = scenario.narrativeEvents.filter(
      event => event.id === 'contradict-invoker',
    );
    const revised = advanceSimulation(createNarrativeSimulation(scenario, library), 1);
    assert.equal(revised.narrativeRecords[0]?.disposition, 'revised');
  });

  it('keeps a load-bearing validator non-substitutable despite negative history', () => {
    const state = createNarrativeSimulation();
    const responder = state.agents.find(agent => agent.id === 'responder');
    assert.ok(responder);
    const common = {
      behaviorVariance: 0,
      estimateConfidence: 0.8,
      estimatedDisclosure: 0.5,
      estimatedEmpathy: 0.5,
      exposureDebt: 0,
      features: { category: 0, familiarity: 0.8, kinship: 0, reciprocity: 0, similarity: 0.5 },
      integratedHistory: -0.8,
      mode: 'contesting' as const,
      observerId: 'responder',
      predictionError: 0,
      stance: -0.4,
      suspicion: 0,
    };
    const withDyads = {
      ...state,
      dyads: [
        ...state.dyads,
        { ...common, subjectId: 'dominant', validatorClaimIds: ['claim-1'] },
        { ...common, subjectId: 'lowering', validatorClaimIds: [] },
      ],
    };
    const validator = evaluateRelationshipRequest(withDyads, {
      atMinute: 1,
      id: 'validator-ask',
      label: 'request',
      magnitude: 0.5,
      requesterId: 'dominant',
      responderId: 'responder',
    });
    const substitute = evaluateRelationshipRequest(withDyads, {
      atMinute: 1,
      id: 'substitute-ask',
      label: 'request',
      magnitude: 0.5,
      requesterId: 'lowering',
      responderId: 'responder',
    });

    assert.equal(validator.outcome, 'accepted');
    assert.equal(substitute.outcome, 'refused');
  });

  it('accepts, resists, and only wears in an attribution across years', () => {
    const resolved = advanceSimulation(createNarrativeSimulation(), 1);
    assert.equal(
      resolved.narrativeRecords.find(record => record.eventId === 'guild-reliable')?.disposition,
      'accepted',
    );
    assert.equal(
      resolved.narrativeRecords.find(record => record.eventId === 'neighbors-unreliable')
        ?.disposition,
      'resisted',
    );
    const attributed = resolved.agents.find(agent => agent.id === 'invoker');
    assert.ok(attributed);
    assert.match(describeAgent(attributed).narrativeTell ?? '', /^resisted:/);

    let worn = setAgentResource(createNarrativeSimulation(), 'invoker', 'regulationReserve', 0.05);
    const event = (id: string, atMinute: number): AttributionEvent => ({
      atMinute,
      audienceId: 'neighbors',
      audienceType: 'group',
      claim: 'Persistently unreliable',
      compatibility: -1,
      confidence: 1,
      eventType: 'attribution',
      id,
      selfClaimId: 'claim-1',
      sourceId: 'dominant',
      subjectId: 'invoker',
      summary: 'The same hostile attribution persisted.',
    });
    worn = resolveNarrativeEvent(worn, event('wear-one', 1));
    worn = resolveNarrativeEvent(worn, event('wear-two', 2));
    const before = worn.agents.find(agent => agent.id === 'invoker')?.narrative?.claims[0]?.wearIn;
    worn = resolveNarrativeEvent(worn, event('wear-three', YEAR_MINUTES + 2));
    const after = worn.agents.find(agent => agent.id === 'invoker')?.narrative?.claims[0]?.wearIn;
    worn = resolveNarrativeEvent(worn, event('wear-four', YEAR_MINUTES + 2));
    const capped = worn.agents.find(agent => agent.id === 'invoker')?.narrative?.claims[0]?.wearIn;

    assert.equal(before, 0);
    assert.equal(
      worn.narrativeRecords.find(record => record.eventId === 'wear-three')?.disposition,
      'wore-in',
    );
    assert.ok((after ?? 0) > 0 && (after ?? 0) <= 0.021);
    assert.equal(capped, after);
  });

  it('keeps incompatible audience reputations without a privileged global score', () => {
    const resolved = advanceSimulation(createNarrativeSimulation(), 1);
    const claims = resolved.reputations
      .filter(reputation => reputation.subjectId === 'invoker')
      .map(reputation => [reputation.audienceId, reputation.claim]);

    assert.deepEqual(claims, [
      ['guild', 'Reliable under pressure'],
      ['neighbors', 'Unreliable under pressure'],
    ]);
  });

  it('promotes a responder without rewriting accumulated state and enables proactive goals', () => {
    const state = createNarrativeSimulation();
    const before = state.agents.find(agent => agent.id === 'responder');
    assert.ok(before);
    assert.equal(before.narrative, null);
    assert.ok(!state.agendaGoals.some(goal => goal.id === 'responder-help-square'));

    const promoted = promoteToInvoker(state, 'responder');
    const afterPromotion = promoted.agents.find(agent => agent.id === 'responder');
    assert.ok(afterPromotion?.narrative);
    assert.deepEqual({ ...afterPromotion, narrative: null }, before);
    const active = advanceSimulation(promoted, 1);
    assert.ok(active.agendaGoals.some(goal => goal.id === 'responder-help-square'));
  });

  it('resumes narrative and distributed reputation state exactly from a snapshot', () => {
    const paused = advanceSimulation(createNarrativeSimulation(), 1);
    const resumed = createSimulationFromSnapshot({
      characterLibrary: characters,
      environmentLibrary: environments,
      snapshot: serializeSnapshot(paused),
    });
    const continuous = advanceSimulation(paused, 15);
    const replayed = advanceSimulation(resumed, 15);

    assert.deepEqual(serializeSnapshot(replayed), serializeSnapshot(continuous));
  });
});
