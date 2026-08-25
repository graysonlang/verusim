import {
  appendBounded,
  clamp,
  memoryWindow,
  recordWindows,
  retainCharacterRecord,
} from '../model/retention.js';
import type {
  ActionCandidate,
  BehaviorOpportunity,
  CandidateEvaluation,
  DecisionRecord,
  RepercussionEvaluation,
  RuntimeMemory,
  CharacterInstance,
  SimulationState,
  TraceEntryInput,
} from '../model/types.js';
import { appraiseAction } from './appraisal.js';
import { evaluateEmpathy } from './empathy.js';
import { effectiveContractAdherence } from './history.js';
import { claimExpressionPayoff } from './narrative.js';
import { effectiveValueWeights } from './salience.js';
import { somaticActionAvailable } from './somatic.js';
import { appendTrace, traceTerm } from './trace.js';
import { applyCharacterValueTurns } from './value-turn.js';

function findAgent(state: SimulationState, instanceId: string): CharacterInstance {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown decision agent "${instanceId}"`);
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
  const actor = findAgent(state, opportunity.actorId);
  const available = opportunity.candidates.filter(candidate =>
    somaticActionAvailable(actor, candidate.somaticDemand),
  );
  if (available.length === 0) {
    throw new RangeError('Somatic state leaves no ordinary candidate to evaluate');
  }
  const candidates = available.map(candidate => evaluateCandidate(state, opportunity, candidate));
  let selected = candidates[0];
  if (selected === undefined) throw new Error('Validated opportunities always contain a candidate');
  for (const candidate of candidates.slice(1)) {
    if (candidate.appraisal.utility > selected.appraisal.utility) selected = candidate;
  }
  return {
    actorId: opportunity.actorId,
    candidates,
    id: `${state.tick}:${opportunity.id}`,
    second: state.second,
    opportunityId: opportunity.id,
    selectedCandidateId: selected.candidateId,
    targetId: opportunity.targetId,
    tick: state.tick,
  };
}

function somaticGateTrace(
  state: SimulationState,
  opportunity: BehaviorOpportunity,
  selectedId: string | null,
  removedIds: readonly string[],
): TraceEntryInput {
  const actor = findAgent(state, opportunity.actorId);
  return {
    instanceId: actor.id,
    id: `${state.tick}:${opportunity.id}:somatic-gate`,
    kind: 'gate',
    second: state.second,
    selection: { rule: 'preempt-gate', selectedId },
    summary: `${actor.profile.name}'s somatic state restricted ${opportunity.id}`,
    terms: [
      traceTerm('somatic-level', actor.somatic.level, `characters.${actor.id}.somatic.level`),
      traceTerm(
        'somatic-impairment',
        actor.somatic.impairment,
        `characters.${actor.id}.somatic.impairment`,
      ),
      ...removedIds.map((candidateId, index) =>
        traceTerm(
          `removed:${index}`,
          candidateId,
          `scenario.behaviorOpportunities.${opportunity.id}.candidates.${candidateId}.somaticDemand`,
        ),
      ),
    ],
    tick: state.tick,
  };
}

function resolvePreemptedOpportunity(
  state: SimulationState,
  opportunity: BehaviorOpportunity,
): SimulationState {
  const actor = findAgent(state, opportunity.actorId);
  const selected =
    actor.somatic.level === 3
      ? (opportunity.candidates.find(candidate => candidate.selfDirected) ?? null)
      : null;
  let agents = state.characters;
  if (selected !== null) {
    for (const impact of selected.impacts) {
      agents = agents.map(agent =>
        agent.id === impact.subjectId ? applyCharacterValueTurns(agent, impact.turns) : agent,
      );
    }
    agents = agents.map(agent =>
      agent.id === actor.id ? { ...agent, currentActivity: selected.label } : agent,
    );
  }
  return {
    ...state,
    characters: agents,
    resolvedOpportunityIds: [...state.resolvedOpportunityIds, opportunity.id],
    trace: appendTrace(
      state.trace,
      somaticGateTrace(
        state,
        opportunity,
        selected?.id ?? null,
        opportunity.candidates
          .filter(candidate => candidate.id !== selected?.id)
          .map(candidate => candidate.id),
      ),
    ),
  };
}

function appraisalTrace(
  state: SimulationState,
  opportunity: BehaviorOpportunity,
  candidate: CandidateEvaluation,
): TraceEntryInput {
  const appraisal = candidate.appraisal;
  const candidateSource = `scenario.behaviorOpportunities.${opportunity.id}.candidates.${candidate.candidateId}`;
  const actorSource = `characters.${opportunity.actorId}`;
  return {
    instanceId: opportunity.actorId,
    id: `${state.tick}:${opportunity.id}:appraisal:${candidate.candidateId}`,
    kind: 'appraisal',
    second: state.second,
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
          `characters.${evaluation.subjectId}.profile.identity`,
          `characters.${evaluation.subjectId}.history.overrides.identity`,
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
  const actor = findAgent(state, opportunity.actorId);
  if (actor.somatic.level >= 3) return resolvePreemptedOpportunity(state, opportunity);
  const availableCandidates = opportunity.candidates.filter(candidate =>
    somaticActionAvailable(actor, candidate.somaticDemand),
  );
  if (availableCandidates.length === 0) return resolvePreemptedOpportunity(state, opportunity);
  const restricted = { ...opportunity, candidates: availableCandidates };
  const decision = evaluateOpportunity(state, restricted);
  const selectedEvaluation = decision.candidates.find(
    candidate => candidate.candidateId === decision.selectedCandidateId,
  );
  const selectedCandidate = availableCandidates.find(
    candidate => candidate.id === decision.selectedCandidateId,
  );
  if (selectedEvaluation === undefined || selectedCandidate === undefined) {
    throw new Error('Selected candidate must belong to the evaluated opportunity');
  }

  let agents = state.characters;
  for (const impact of selectedCandidate.impacts) {
    agents = agents.map(agent =>
      agent.id === impact.subjectId ? applyCharacterValueTurns(agent, impact.turns) : agent,
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
      second: state.second,
      summary: `Remorse followed ${selectedCandidate.label.toLowerCase()}`,
      type: 'aftermath',
    };
  }
  agents = agents.map(agent => {
    if (agent.id !== opportunity.actorId) return agent;
    const withRemorse =
      remorse === 0
        ? agent
        : applyCharacterValueTurns(agent, { fairness: -remorse, respect: -remorse * 0.35 });
    return {
      ...withRemorse,
      currentActivity: selectedCandidate.label,
      memories:
        aftermathMemory === null
          ? withRemorse.memories
          : appendBounded(withRemorse.memories, aftermathMemory, memoryWindow(withRemorse.tier)),
    };
  });

  let trace = state.trace;
  const removedIds = opportunity.candidates
    .filter(candidate => !availableCandidates.includes(candidate))
    .map(candidate => candidate.id);
  if (removedIds.length > 0) {
    trace = appendTrace(
      trace,
      somaticGateTrace(state, opportunity, selectedCandidate.id, removedIds),
    );
  }
  for (const candidate of decision.candidates) {
    trace = appendTrace(trace, appraisalTrace(state, opportunity, candidate));
  }
  trace = appendTrace(trace, {
    instanceId: opportunity.actorId,
    id: `${state.tick}:${opportunity.id}:decision`,
    kind: 'decision',
    second: state.second,
    selection: {
      rule: 'highest-utility-then-authored-order',
      selectedId: selectedCandidate.id,
    },
    summary: `${findAgent(state, opportunity.actorId).profile.name}: ${selectedCandidate.label}`,
    terms: [
      traceTerm('opportunity', opportunity.id, `scenario.behaviorOpportunities.${opportunity.id}`),
      traceTerm(
        'selected-utility',
        selectedEvaluation.appraisal.utility,
        `decisions.${decision.id}.candidates.${selectedCandidate.id}.appraisal.utility`,
      ),
    ],
    tick: state.tick,
  });
  if (remorse >= 0.05) {
    trace = appendTrace(trace, {
      instanceId: opportunity.actorId,
      id: `${state.tick}:${opportunity.id}:aftermath`,
      kind: 'aftermath',
      second: state.second,
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
    });
  }

  return {
    ...state,
    characters: agents,
    decisions: retainCharacterRecord(
      state.decisions,
      decision,
      record => record.actorId,
      recordWindows(state.characters),
    ),
    resolvedOpportunityIds: [...state.resolvedOpportunityIds, opportunity.id],
    trace,
  };
}
