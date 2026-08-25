import { SECONDS_PER_YEAR } from '../model/time.js';
import { appendBounded, clamp, recordWindows, retainCharacterRecord } from '../model/retention.js';
import type {
  AspirationOpportunity,
  AttributedNarrative,
  ClaimExpression,
  NarrativeClaimState,
  NarrativeDisposition,
  NarrativeEvent,
  NarrativeRecord,
  NarrativeState,
  CharacterInstance,
  SimulationState,
} from '../model/types.js';
import { effectiveValueWeights } from './salience.js';
import { appendTrace, traceTerm } from './trace.js';
import { applyCharacterValueTurns } from './value-turn.js';

const MAX_REPUTATIONS = 160;
const ADULT_WEAR_IN_RATE_PER_YEAR = 0.02;

function agentFor(state: SimulationState, instanceId: string): CharacterInstance {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown narrative agent "${instanceId}"`);
  return agent;
}

export function createNarrativeState(
  agent: CharacterInstance,
  promotedSecond: number,
): NarrativeState {
  return {
    claims: agent.profile.narrativeClaims.map(claim => ({
      ...claim,
      confirmations: 0,
      reinterpretations: 0,
      revisions: 0,
      wearIn: 0,
    })),
    promotedSecond,
  };
}

export function claimExpressionPayoff(
  agent: CharacterInstance,
  expressions: ClaimExpression[],
): number {
  if (agent.narrative === null) return 0;
  const weights = effectiveValueWeights(agent);
  return clamp(
    expressions.reduce((total, expression) => {
      const claim = agent.narrative?.claims.find(candidate => candidate.id === expression.claimId);
      if (claim === undefined) return total;
      return (
        total +
        expression.strength *
          claim.commitment *
          claim.confidence *
          weights[expression.valueId] *
          0.3
      );
    }, 0),
    -2,
    2,
  );
}

function replaceAgent(state: SimulationState, agent: CharacterInstance): SimulationState {
  return {
    ...state,
    characters: state.characters.map(candidate => (candidate.id === agent.id ? agent : candidate)),
  };
}

function replaceClaim(agent: CharacterInstance, claim: NarrativeClaimState): CharacterInstance {
  if (agent.narrative === null) return agent;
  return {
    ...agent,
    narrative: {
      ...agent.narrative,
      claims: agent.narrative.claims.map(candidate =>
        candidate.id === claim.id ? claim : candidate,
      ),
    },
  };
}

function addRecord(
  state: SimulationState,
  event: NarrativeEvent,
  actorId: string,
  claimId: string,
  disposition: NarrativeDisposition,
  regulationCost: number,
): SimulationState {
  const actor = agentFor(state, actorId);
  const record: NarrativeRecord = {
    actorId,
    claimId,
    disposition,
    eventId: event.id,
    id: `${state.tick}:${event.id}:narrative`,
    second: state.second,
    regulationCost,
    summary: event.summary,
    tick: state.tick,
  };
  return {
    ...state,
    characters: state.characters.map(agent =>
      agent.id === actorId
        ? {
            ...agent,
            memories: appendBounded(
              agent.memories,
              {
                id: record.id,
                second: state.second,
                summary: `${disposition}: ${event.summary}`,
                type: 'narrative',
              },
              16,
            ),
          }
        : agent,
    ),
    narrativeRecords: retainCharacterRecord(
      state.narrativeRecords,
      record,
      record => record.actorId,
      recordWindows(state.characters),
    ),
    resolvedNarrativeEventIds: [...state.resolvedNarrativeEventIds, event.id],
    trace: appendTrace(state.trace, {
      instanceId: actorId,
      id: record.id,
      kind: event.eventType === 'attribution' ? 'reputation' : 'narrative',
      second: state.second,
      selection: null,
      summary: `${actor.profile.name}: ${disposition}`,
      terms: [
        traceTerm('event', event.id, `scenario.narrativeEvents.${event.id}`),
        traceTerm('claim', claimId, `characters.${actorId}.narrative.claims.${claimId}`),
        traceTerm('disposition', disposition, `narrativeRecords.${record.id}.disposition`),
        traceTerm('regulation-cost', regulationCost, `characters.${actorId}.resources`),
      ],
      tick: state.tick,
    }),
  };
}

function claimFor(agent: CharacterInstance, claimId: string): NarrativeClaimState {
  const claim = agent.narrative?.claims.find(candidate => candidate.id === claimId);
  if (claim === undefined) throw new RangeError(`Unknown narrative claim "${claimId}"`);
  return claim;
}

function plasticityFor(agent: CharacterInstance): number {
  if (agent.profile.physical.ageYears < 18) return 0.8;
  return clamp(0.08 - (agent.profile.physical.ageYears - 18) * 0.0015, 0.015, 0.08);
}

function resolveClaimEvidence(state: SimulationState, event: NarrativeEvent): SimulationState {
  if (event.eventType !== 'claim-evidence') return state;
  const agent = agentFor(state, event.actorId);
  const claim = claimFor(agent, event.claimId);
  const plasticity = plasticityFor(agent);
  let disposition: NarrativeDisposition;
  let regulationCost = 0;
  let updated = claim;
  if (event.alignment > 0) {
    disposition = 'confirmed';
    updated = {
      ...claim,
      confidence: clamp(claim.confidence + event.alignment * plasticity * 0.05, 0, 1),
      confirmations: claim.confirmations + 1,
    };
  } else {
    const validatorSupport = state.dyads.some(
      dyad => dyad.observerId === agent.id && dyad.validatorClaimIds.includes(claim.id),
    )
      ? 0.2
      : 0;
    const conviction = (claim.commitment + claim.confidence) / 2 + validatorSupport;
    const revisionPressure = -event.alignment * plasticity;
    if (revisionPressure > conviction * 0.75) {
      disposition = 'revised';
      regulationCost = clamp(-event.alignment * 0.15, 0, 1);
      updated = {
        ...claim,
        confidence: clamp(claim.confidence - revisionPressure * 0.25, 0, 1),
        revisions: claim.revisions + 1,
      };
    } else {
      disposition = 'reinterpreted';
      regulationCost = clamp(-event.alignment * 0.03, 0, 1);
      updated = { ...claim, reinterpretations: claim.reinterpretations + 1 };
    }
  }
  let next = replaceAgent(state, replaceClaim(agent, updated));
  if (regulationCost > 0) {
    const current = agentFor(next, agent.id);
    next = replaceAgent(next, {
      ...current,
      resources: {
        ...current.resources,
        regulationReserve: clamp(current.resources.regulationReserve - regulationCost, 0, 1),
      },
    });
  }
  return addRecord(next, event, agent.id, claim.id, disposition, regulationCost);
}

function resolveSelfDeprecation(state: SimulationState, event: NarrativeEvent): SimulationState {
  if (event.eventType !== 'self-deprecation-agreement') return state;
  let agent = agentFor(state, event.actorId);
  const claim = claimFor(agent, event.claimId);
  let disposition: NarrativeDisposition;
  if (agent.cascade === 'fawn' && agent.cascadeTargetId === event.responderId) {
    disposition = 'status-lowering';
    agent = {
      ...agent,
      resources: {
        ...agent.resources,
        regulationReserve: clamp(agent.resources.regulationReserve + 0.04, 0, 1),
      },
    };
  } else if (event.disclosureItemId !== null) {
    disposition = 'preemptive-shame';
    agent = {
      ...agent,
      resources: {
        ...agent.resources,
        regulationReserve: clamp(agent.resources.regulationReserve + 0.04, 0, 1),
      },
    };
  } else if (agent.values.respect.deficitIntegral >= 0.45 || claim.confidence > 0.5) {
    disposition = 'fishing';
    agent = applyCharacterValueTurns(agent, {
      respect: -0.25 * agent.profile.constitution.reactivity,
    });
  } else {
    disposition = 'genuine';
  }
  let next = replaceAgent(state, agent);
  if (event.disclosureItemId !== null) {
    next = {
      ...next,
      disclosureItems: next.disclosureItems.map(item =>
        item.id === event.disclosureItemId && !item.knownByIds.includes(event.responderId)
          ? { ...item, knownByIds: [...item.knownByIds, event.responderId] }
          : item,
      ),
    };
  }
  return addRecord(next, event, agent.id, claim.id, disposition, 0);
}

function reputationKey(reputation: AttributedNarrative): string {
  return `${reputation.audienceType}:${reputation.audienceId}:${reputation.subjectId}:${reputation.claim}`;
}

function resolveAttribution(state: SimulationState, event: NarrativeEvent): SimulationState {
  if (event.eventType !== 'attribution') return state;
  const subject = agentFor(state, event.subjectId);
  const claim = claimFor(subject, event.selfClaimId);
  const key = `${event.audienceType}:${event.audienceId}:${event.subjectId}:${event.claim}`;
  const existing = state.reputations.find(candidate => reputationKey(candidate) === key);
  const reputation: AttributedNarrative =
    existing === undefined
      ? {
          audienceId: event.audienceId,
          audienceType: event.audienceType,
          claim: event.claim,
          confidence: event.confidence,
          firstSecond: event.atSecond,
          lastSecond: event.atSecond,
          repetitions: 1,
          sourceIds: [event.sourceId],
          subjectId: event.subjectId,
        }
      : {
          ...existing,
          confidence: clamp(
            existing.confidence + (1 - existing.confidence) * event.confidence * 0.25,
            0,
            1,
          ),
          lastSecond: event.atSecond,
          repetitions: existing.repetitions + 1,
          sourceIds: existing.sourceIds.includes(event.sourceId)
            ? existing.sourceIds
            : [...existing.sourceIds, event.sourceId],
        };
  let next: SimulationState = {
    ...state,
    reputations: appendBounded(
      state.reputations.filter(candidate => reputationKey(candidate) !== key),
      reputation,
      MAX_REPUTATIONS,
    ),
  };
  const validator =
    state.dyads
      .find(dyad => dyad.observerId === subject.id && dyad.subjectId === event.sourceId)
      ?.validatorClaimIds.includes(claim.id) ?? false;
  if (event.compatibility >= 0 || validator) {
    return addRecord(next, event, subject.id, claim.id, 'accepted', 0);
  }
  const spanYears = (reputation.lastSecond - reputation.firstSecond) / SECONDS_PER_YEAR;
  const remainingWearInAllowance = Math.max(
    0,
    ADULT_WEAR_IN_RATE_PER_YEAR * spanYears - claim.wearIn,
  );
  const mayWearIn =
    subject.profile.physical.ageYears >= 18 &&
    reputation.repetitions >= 3 &&
    spanYears >= 1 &&
    remainingWearInAllowance > 1e-9 &&
    subject.resources.regulationReserve < 0.2;
  if (mayWearIn) {
    const wearIn = Math.min(remainingWearInAllowance, -event.compatibility * 0.1);
    const current = agentFor(next, subject.id);
    next = replaceAgent(
      next,
      replaceClaim(current, {
        ...claim,
        confidence: clamp(claim.confidence - wearIn, 0, 1),
        wearIn: claim.wearIn + wearIn,
      }),
    );
    return addRecord(next, event, subject.id, claim.id, 'wore-in', 0);
  }
  const regulationCost = clamp(-event.compatibility * event.confidence * 0.08, 0, 1);
  const current = agentFor(next, subject.id);
  next = replaceAgent(next, {
    ...current,
    resources: {
      ...current.resources,
      regulationReserve: clamp(current.resources.regulationReserve - regulationCost, 0, 1),
    },
  });
  return addRecord(next, event, subject.id, claim.id, 'resisted', regulationCost);
}

export function resolveNarrativeEvent(
  state: SimulationState,
  event: NarrativeEvent,
): SimulationState {
  if (event.eventType === 'claim-evidence') return resolveClaimEvidence(state, event);
  if (event.eventType === 'self-deprecation-agreement') {
    return resolveSelfDeprecation(state, event);
  }
  return resolveAttribution(state, event);
}

function aspirationGoal(state: SimulationState, opportunity: AspirationOpportunity) {
  return {
    activationSecond: state.second,
    actorId: opportunity.actorId,
    claimExpressions: opportunity.claimExpressions,
    commitment: opportunity.commitment,
    deadlineSecond: opportunity.deadlineSecond,
    desired: opportunity.desired,
    failureTurns: opportunity.failureTurns,
    id: opportunity.id,
    label: opportunity.label,
    lastPlannedWorldRevision: null,
    resolvedSecond: null,
    source: 'aspiration' as const,
    status: 'active' as const,
    successTurns: opportunity.successTurns,
    urgencyHorizonSeconds: opportunity.urgencyHorizonSeconds,
  };
}

export function prepareNarrativeAgency(state: SimulationState): SimulationState {
  let next = state;
  for (const opportunity of state.scenario.aspirationOpportunities) {
    if (
      opportunity.atSecond > state.second ||
      next.resolvedAspirationOpportunityIds.includes(opportunity.id)
    ) {
      continue;
    }
    const agent = agentFor(next, opportunity.actorId);
    if (agent.narrative === null) continue;
    const claim = agent.narrative.claims.find(candidate => candidate.id === opportunity.claimId);
    if (claim === undefined || claim.commitment * claim.confidence < 0.1) continue;
    const goal = aspirationGoal(next, opportunity);
    next = {
      ...next,
      agendaGoals: [...next.agendaGoals, goal],
      resolvedAspirationOpportunityIds: [...next.resolvedAspirationOpportunityIds, opportunity.id],
      trace: appendTrace(next.trace, {
        instanceId: agent.id,
        id: `${next.tick}:${opportunity.id}:aspiration`,
        kind: 'narrative',
        second: next.second,
        selection: { rule: 'positive-utility', selectedId: goal.id },
        summary: `${agent.profile.name} formed an aspiration goal: ${goal.label}`,
        terms: [
          traceTerm('claim', claim.id, `characters.${agent.id}.narrative.claims.${claim.id}`),
          traceTerm(
            'commitment',
            claim.commitment,
            `characters.${agent.id}.narrative.claims.${claim.id}`,
          ),
          traceTerm(
            'confidence',
            claim.confidence,
            `characters.${agent.id}.narrative.claims.${claim.id}`,
          ),
          traceTerm('goal', goal.id, `agendaGoals.${goal.id}`),
        ],
        tick: next.tick,
      }),
    };
  }
  return next;
}

export function promoteToInvoker(state: SimulationState, instanceId: string): SimulationState {
  const agent = agentFor(state, instanceId);
  if (agent.narrative !== null) return state;
  return replaceAgent(state, { ...agent, narrative: createNarrativeState(agent, state.second) });
}
