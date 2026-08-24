import type {
  ActionCandidate,
  BehaviorOpportunity,
  CandidateEvaluation,
  DecisionRecord,
  RepercussionEvaluation,
  RuntimeMemory,
  SimulationAgent,
  SimulationState,
  TraceEntry,
} from '../model/types.js';
import { appraiseAction } from './appraisal.js';
import { evaluateEmpathy } from './empathy.js';
import { effectiveContractAdherence } from './history.js';
import { claimExpressionPayoff } from './narrative.js';
import { effectiveValueWeights } from './salience.js';
import { appendTrace, traceTerm } from './trace.js';
import { applyAgentValueTurns } from './value-turn.js';

const MAX_DECISIONS = 80;
const MAX_MEMORIES = 16;
const MAX_TRACE_ENTRIES = 240;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function appendBounded<Item>(items: Item[], item: Item, maximum: number): Item[] {
  const next = [...items, item];
  return next.length <= maximum ? next : next.slice(next.length - maximum);
}

function findAgent(state: SimulationState, agentId: string): SimulationAgent {
  const agent = state.agents.find(candidate => candidate.id === agentId);
  if (agent === undefined) throw new RangeError(`Unknown decision agent "${agentId}"`);
  return agent;
}

function evaluateRepercussion(
  state: SimulationState,
  opportunity: BehaviorOpportunity,
  candidate: ActionCandidate,
): RepercussionEvaluation {
  const witnesses = opportunity.context.witnessIds.map(witnessId => {
    const actorEmpathy = evaluateEmpathy(
      state,
      witnessId,
      opportunity.actorId,
      opportunity.context.perceivedThreat,
    ).empathy;
    const targetEmpathy =
      opportunity.targetId === null
        ? actorEmpathy
        : evaluateEmpathy(
            state,
            witnessId,
            opportunity.targetId,
            opportunity.context.perceivedThreat,
          ).empathy;
    const reportProbability = clamp(0.5 + (targetEmpathy - actorEmpathy) * 0.75, 0, 1);
    return { actorEmpathy, reportProbability, targetEmpathy, witnessId };
  });
  const witnessProbability =
    witnesses.length === 0
      ? 0
      : 1 -
        witnesses.reduce((noneReport, witness) => noneReport * (1 - witness.reportProbability), 1);
  const probability =
    witnessProbability *
    opportunity.context.networkConductivity *
    opportunity.context.enforcementPresence;
  return {
    cost: probability * candidate.repercussionSeverity,
    probability,
    witnesses,
  };
}

function evaluateCandidate(
  state: SimulationState,
  opportunity: BehaviorOpportunity,
  candidate: ActionCandidate,
): CandidateEvaluation {
  const actor = findAgent(state, opportunity.actorId);
  const effectiveWeights = effectiveValueWeights(actor);
  const empathy = candidate.impacts.map(impact =>
    evaluateEmpathy(
      state,
      opportunity.actorId,
      impact.subjectId,
      opportunity.context.perceivedThreat,
    ),
  );
  const repercussion = evaluateRepercussion(state, opportunity, candidate);
  const appraisal = appraiseAction({
    contractViolationCost: effectiveContractAdherence(actor) * candidate.contractViolation,
    impacts: candidate.impacts.map((impact, index) => ({
      empathy: empathy[index]?.empathy ?? 0,
      subjectId: impact.subjectId,
      turns: impact.turns,
    })),
    narrativeExpression: claimExpressionPayoff(actor, candidate.claimExpressions),
    repercussionCost: repercussion.cost,
    valueWeights: effectiveWeights,
  });
  return {
    appraisal,
    candidateId: candidate.id,
    effectiveValueWeights: effectiveWeights,
    empathy,
    label: candidate.label,
    operation: candidate.operation,
    repercussion,
  };
}

export function evaluateOpportunity(
  state: SimulationState,
  opportunity: BehaviorOpportunity,
): DecisionRecord {
  const candidates = opportunity.candidates.map(candidate =>
    evaluateCandidate(state, opportunity, candidate),
  );
  let selected = candidates[0];
  if (selected === undefined) throw new Error('Validated opportunities always contain a candidate');
  for (const candidate of candidates.slice(1)) {
    if (candidate.appraisal.utility > selected.appraisal.utility) selected = candidate;
  }
  return {
    actorId: opportunity.actorId,
    candidates,
    id: `${state.tick}:${opportunity.id}`,
    minute: state.minute,
    opportunityId: opportunity.id,
    selectedCandidateId: selected.candidateId,
    targetId: opportunity.targetId,
    tick: state.tick,
  };
}

function appraisalTrace(
  state: SimulationState,
  opportunity: BehaviorOpportunity,
  candidate: CandidateEvaluation,
): TraceEntry {
  const appraisal = candidate.appraisal;
  const candidateSource = `scenario.behaviorOpportunities.${opportunity.id}.candidates.${candidate.candidateId}`;
  const actorSource = `agents.${opportunity.actorId}`;
  return {
    agentId: opportunity.actorId,
    id: `${state.tick}:${opportunity.id}:appraisal:${candidate.candidateId}`,
    kind: 'appraisal',
    minute: state.minute,
    selection: null,
    summary: `${candidate.label}: utility ${appraisal.utility.toFixed(4)}`,
    terms: [
      traceTerm(
        'turn-felt',
        appraisal.turnFelt,
        `${actorSource}.values`,
        `${actorSource}.profile.values`,
        `${actorSource}.history.overrides.valueWeights`,
        `${candidateSource}.impacts`,
        `${candidateSource}.empathy`,
      ),
      traceTerm(
        'repercussion-cost',
        appraisal.repercussionCost,
        `${candidateSource}.repercussionSeverity`,
        `scenario.behaviorOpportunities.${opportunity.id}.context`,
      ),
      traceTerm(
        'contract-violation-cost',
        appraisal.contractViolationCost,
        `${actorSource}.profile.contractAdherence`,
        `${actorSource}.history.overrides.contractAdherence`,
        `${candidateSource}.contractViolation`,
      ),
      traceTerm(
        'narrative-expression',
        appraisal.narrativeExpression,
        `${candidateSource}.claimExpressions`,
        `${actorSource}.narrative`,
      ),
      traceTerm('utility', appraisal.utility, `decisions.${state.tick}:${opportunity.id}`),
      traceTerm('candidate', candidate.candidateId, candidateSource),
      ...candidate.empathy.map(evaluation =>
        traceTerm(
          `empathy:${evaluation.subjectId}`,
          evaluation.empathy,
          `${actorSource}.profile.empathy`,
          `${actorSource}.history.overrides.empathy`,
          `${candidateSource}.impacts.${evaluation.subjectId}`,
          `agents.${evaluation.subjectId}.profile.identity`,
          `agents.${evaluation.subjectId}.history.overrides.identity`,
        ),
      ),
    ],
    tick: state.tick,
  };
}

export function resolveOpportunity(
  state: SimulationState,
  opportunity: BehaviorOpportunity,
): SimulationState {
  const decision = evaluateOpportunity(state, opportunity);
  const selectedEvaluation = decision.candidates.find(
    candidate => candidate.candidateId === decision.selectedCandidateId,
  );
  const selectedCandidate = opportunity.candidates.find(
    candidate => candidate.id === decision.selectedCandidateId,
  );
  if (selectedEvaluation === undefined || selectedCandidate === undefined) {
    throw new Error('Selected candidate must belong to the evaluated opportunity');
  }

  let agents = state.agents;
  for (const impact of selectedCandidate.impacts) {
    agents = agents.map(agent =>
      agent.id === impact.subjectId ? applyAgentValueTurns(agent, impact.turns) : agent,
    );
  }

  const negativeOtherTurn = selectedEvaluation.appraisal.contributions
    .filter(
      contribution => contribution.subjectId !== opportunity.actorId && contribution.amount < 0,
    )
    .reduce((total, contribution) => total - contribution.amount, 0);
  const remorse = clamp(
    negativeOtherTurn * 0.3 + selectedEvaluation.appraisal.contractViolationCost * 0.2,
    0,
    1,
  );
  let aftermathMemory: RuntimeMemory | null = null;
  if (remorse >= 0.05) {
    aftermathMemory = {
      id: `${state.tick}:${opportunity.id}:aftermath`,
      minute: state.minute,
      summary: `Remorse followed ${selectedCandidate.label.toLowerCase()}`,
      type: 'aftermath',
    };
  }
  agents = agents.map(agent => {
    if (agent.id !== opportunity.actorId) return agent;
    const withRemorse =
      remorse === 0
        ? agent
        : applyAgentValueTurns(agent, { fairness: -remorse, respect: -remorse * 0.35 });
    return {
      ...withRemorse,
      currentActivity: selectedCandidate.label,
      memories:
        aftermathMemory === null
          ? withRemorse.memories
          : appendBounded(withRemorse.memories, aftermathMemory, MAX_MEMORIES),
    };
  });

  let trace = state.trace;
  for (const candidate of decision.candidates) {
    trace = appendTrace(trace, appraisalTrace(state, opportunity, candidate), MAX_TRACE_ENTRIES);
  }
  trace = appendTrace(
    trace,
    {
      agentId: opportunity.actorId,
      id: `${state.tick}:${opportunity.id}:decision`,
      kind: 'decision',
      minute: state.minute,
      selection: {
        rule: 'highest-utility-then-authored-order',
        selectedId: selectedCandidate.id,
      },
      summary: `${findAgent(state, opportunity.actorId).profile.name}: ${selectedCandidate.label}`,
      terms: [
        traceTerm(
          'opportunity',
          opportunity.id,
          `scenario.behaviorOpportunities.${opportunity.id}`,
        ),
        traceTerm(
          'selected-utility',
          selectedEvaluation.appraisal.utility,
          `decisions.${decision.id}.candidates.${selectedCandidate.id}.appraisal.utility`,
        ),
      ],
      tick: state.tick,
    },
    MAX_TRACE_ENTRIES,
  );
  if (remorse >= 0.05) {
    trace = appendTrace(
      trace,
      {
        agentId: opportunity.actorId,
        id: `${state.tick}:${opportunity.id}:aftermath`,
        kind: 'aftermath',
        minute: state.minute,
        selection: null,
        summary: `${findAgent(state, opportunity.actorId).profile.name} carries remorse from ${selectedCandidate.label.toLowerCase()}`,
        terms: [
          traceTerm(
            'other-harm-felt',
            negativeOtherTurn,
            `decisions.${decision.id}.candidates.${selectedCandidate.id}.appraisal.contributions`,
          ),
          traceTerm(
            'contract-cost',
            selectedEvaluation.appraisal.contractViolationCost,
            `decisions.${decision.id}.candidates.${selectedCandidate.id}.appraisal.contractViolationCost`,
          ),
        ],
        tick: state.tick,
      },
      MAX_TRACE_ENTRIES,
    );
  }

  return {
    ...state,
    agents,
    decisions: appendBounded(state.decisions, decision, MAX_DECISIONS),
    resolvedOpportunityIds: [...state.resolvedOpportunityIds, opportunity.id],
    trace,
  };
}
