import { MAX_MEMORIES, MAX_TRACE_ENTRIES, appendBounded, clamp } from '../model/retention.js';
import type {
  DyadMode,
  DyadState,
  RelationshipDecisionRecord,
  RelationshipEvent,
  RelationshipRequestOpportunity,
  RuntimeMemory,
  CharacterInstance,
  SimulationState,
  SocialFeatureMap,
  TraceEntry,
} from '../model/types.js';
import { effectiveDisclosure, effectiveEmpathy } from './history.js';
import { appendTrace, traceTerm } from './trace.js';

const MAX_RELATIONSHIP_DECISIONS = 80;
const SEMANTIC_COLLAPSE_MINUTES = 720;

const DISTANT_FEATURES: SocialFeatureMap = {
  category: 0,
  familiarity: 0,
  kinship: 0,
  reciprocity: 0,
  similarity: 0,
};

function agentFor(state: SimulationState, instanceId: string): CharacterInstance {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown relationship agent "${instanceId}"`);
  return agent;
}

export function projectedDyad(observer: CharacterInstance, subjectId: string): DyadState {
  const empathy = effectiveEmpathy(observer);
  const disclosure = effectiveDisclosure(observer);
  return {
    behaviorVariance: 0,
    estimateConfidence: 0.1,
    estimatedDisclosure: clamp(
      (disclosure.intimateSafety + disclosure.strangerSafety - disclosure.troughDepth) / 2,
      0,
      1,
    ),
    estimatedEmpathy: clamp((empathy.floor + empathy.ceiling) / 2, 0, 1),
    exposureDebt: 0,
    features: { ...DISTANT_FEATURES },
    integratedHistory: 0,
    mode: 'courteous',
    observerId: observer.id,
    predictionError: 0,
    stance: 0,
    subjectId,
    suspicion: 0,
    validatorClaimIds: [],
  };
}

export function dyadFor(
  state: SimulationState,
  observerId: string,
  subjectId: string,
): DyadState | null {
  return (
    state.dyads.find(dyad => dyad.observerId === observerId && dyad.subjectId === subjectId) ?? null
  );
}

export function exposureDebtFor(
  state: SimulationState,
  observerId: string,
  subjectId: string,
  estimatedEmpathy: number,
): number {
  const stock = state.disclosureItems
    .filter(item => item.ownerId === observerId && item.knownByIds.includes(subjectId))
    .reduce((total, item) => total + item.shameCharge, 0);
  return clamp(stock * (1 - estimatedEmpathy), 0, 1);
}

function guardedLoad(dyad: DyadState): number {
  return Math.max(dyad.exposureDebt, dyad.suspicion, dyad.predictionError * 0.75);
}

export function resolveDyadMode(dyad: DyadState): DyadMode {
  if (dyad.mode === 'ruptured' && dyad.stance <= -0.5) return 'ruptured';
  if (dyad.stance <= -0.72) return 'ruptured';
  if (dyad.mode === 'contesting' && dyad.stance <= -0.1) return 'contesting';
  if (dyad.stance <= -0.35) return 'contesting';
  if (dyad.mode === 'guarded' && guardedLoad(dyad) >= 0.2) return 'guarded';
  if (guardedLoad(dyad) >= 0.45) return 'guarded';
  if (dyad.mode === 'warm' && dyad.stance >= 0.3) return 'warm';
  if (dyad.stance >= 0.55) return 'warm';
  return 'courteous';
}

export function repriceExposureDebt(state: SimulationState, dyad: DyadState): DyadState {
  const repriced = {
    ...dyad,
    exposureDebt: exposureDebtFor(state, dyad.observerId, dyad.subjectId, dyad.estimatedEmpathy),
  };
  return { ...repriced, mode: resolveDyadMode(repriced) };
}

export function turnDyad(dyad: DyadState, stanceTurn: number): DyadState {
  const stance =
    stanceTurn >= 0
      ? clamp(dyad.stance + stanceTurn * (1 - dyad.stance) * 0.18, -1, 1)
      : clamp(dyad.stance + stanceTurn * (1 + dyad.stance) * 0.72, -1, 1);
  const integratedHistory = clamp(dyad.integratedHistory + stanceTurn * 0.08, -1, 1);
  const updated = { ...dyad, integratedHistory, stance };
  return { ...updated, mode: resolveDyadMode(updated) };
}

function replaceDyad(state: SimulationState, dyad: DyadState): SimulationState {
  const exists = state.dyads.some(
    candidate => candidate.observerId === dyad.observerId && candidate.subjectId === dyad.subjectId,
  );
  return {
    ...state,
    dyads: exists
      ? state.dyads.map(candidate =>
          candidate.observerId === dyad.observerId && candidate.subjectId === dyad.subjectId
            ? dyad
            : candidate,
        )
      : [...state.dyads, dyad],
  };
}

export function repriceExposureFor(
  state: SimulationState,
  observerId: string,
  subjectId: string,
  source: string,
): SimulationState {
  const existing = dyadFor(state, observerId, subjectId);
  if (existing === null) return state;
  const repriced = repriceExposureDebt(state, existing);
  if (repriced.exposureDebt === existing.exposureDebt && repriced.mode === existing.mode) {
    return state;
  }
  const observer = agentFor(state, observerId);
  const subject = agentFor(state, subjectId);
  const entry: TraceEntry = {
    instanceId: observerId,
    id: `${state.tick}:${observerId}:${subjectId}:exposure-debt:${state.trace.entries.length}`,
    kind: 'relationship',
    minute: state.minute,
    selection: null,
    summary: `${observer.profile.name} repriced what ${subject.profile.name} knows`,
    terms: [
      traceTerm(
        'previous-exposure-debt',
        existing.exposureDebt,
        `dyads.${observerId}:${subjectId}.exposureDebt`,
      ),
      traceTerm('new-exposure-debt', repriced.exposureDebt, source),
      traceTerm(
        'estimated-empathy',
        repriced.estimatedEmpathy,
        `dyads.${observerId}:${subjectId}.estimatedEmpathy`,
      ),
      traceTerm('previous-mode', existing.mode, `dyads.${observerId}:${subjectId}.mode`),
      traceTerm('new-mode', repriced.mode, source),
    ],
    tick: state.tick,
  };
  const replaced = replaceDyad(state, repriced);
  return { ...replaced, trace: appendTrace(replaced.trace, entry, MAX_TRACE_ENTRIES) };
}

function relationshipMemory(
  state: SimulationState,
  observerId: string,
  subjectId: string,
  summary: string,
  emotionalTurn: number,
  suffix: string,
): RuntimeMemory {
  return {
    emotionalTurn,
    id: `${state.tick}:${observerId}:${subjectId}:${suffix}`,
    minute: state.minute,
    subjectId,
    summary,
    type: 'relationship',
  };
}

function addRelationshipMemory(
  state: SimulationState,
  observerId: string,
  memory: RuntimeMemory,
): SimulationState {
  return {
    ...state,
    characters: state.characters.map(agent =>
      agent.id === observerId
        ? { ...agent, memories: appendBounded(agent.memories, memory, MAX_MEMORIES) }
        : agent,
    ),
  };
}

export function resolveRelationshipEvent(
  state: SimulationState,
  event: RelationshipEvent,
): SimulationState {
  const observer = agentFor(state, event.observerId);
  const subject = agentFor(state, event.subjectId);
  const previous =
    dyadFor(state, event.observerId, event.subjectId) ?? projectedDyad(observer, event.subjectId);
  const updated = turnDyad(previous, event.stanceTurn);
  let next = replaceDyad(state, updated);
  next = addRelationshipMemory(
    next,
    event.observerId,
    relationshipMemory(
      state,
      event.observerId,
      event.subjectId,
      event.summary,
      event.stanceTurn,
      event.id,
    ),
  );
  const entry: TraceEntry = {
    instanceId: event.observerId,
    id: `${state.tick}:${event.id}:relationship`,
    kind: 'relationship',
    minute: state.minute,
    selection: null,
    summary: `${observer.profile.name} revised their stance toward ${subject.profile.name}`,
    terms: [
      traceTerm('event', event.id, `scenario.relationshipEvents.${event.id}`),
      traceTerm(
        'stance-turn',
        event.stanceTurn,
        `scenario.relationshipEvents.${event.id}.stanceTurn`,
      ),
      traceTerm(
        'previous-stance',
        previous.stance,
        `dyads.${event.observerId}:${event.subjectId}.stance`,
      ),
      traceTerm(
        'new-stance',
        updated.stance,
        `dyads.${event.observerId}:${event.subjectId}.stance`,
      ),
      traceTerm(
        'previous-mode',
        previous.mode,
        `dyads.${event.observerId}:${event.subjectId}.mode`,
      ),
      traceTerm('new-mode', updated.mode, `dyads.${event.observerId}:${event.subjectId}.mode`),
    ],
    tick: state.tick,
  };
  return {
    ...next,
    resolvedRelationshipEventIds: [...next.resolvedRelationshipEventIds, event.id],
    trace: appendTrace(next.trace, entry, MAX_TRACE_ENTRIES),
  };
}

export function evaluateRelationshipRequest(
  state: SimulationState,
  opportunity: RelationshipRequestOpportunity,
): RelationshipDecisionRecord {
  const responder = agentFor(state, opportunity.responderId);
  const dyad =
    dyadFor(state, opportunity.responderId, opportunity.requesterId) ??
    projectedDyad(responder, opportunity.requesterId);
  const validatorSupport = Math.min(0.3, dyad.validatorClaimIds.length * 0.2);
  const cooperationPosition = clamp(
    (dyad.stance + 1) / 2 - dyad.exposureDebt * 0.25 - dyad.suspicion * 0.15 + validatorSupport,
    0,
    1,
  );
  const outcome = opportunity.magnitude <= cooperationPosition ? 'accepted' : 'refused';
  const stanceTurn =
    outcome === 'accepted'
      ? 0.08 + opportunity.magnitude * 0.35
      : -(0.04 + opportunity.magnitude * 0.08);
  const updated = turnDyad(dyad, stanceTurn);
  return {
    cooperationPosition,
    id: `${state.tick}:${opportunity.id}`,
    magnitude: opportunity.magnitude,
    minute: state.minute,
    newStance: updated.stance,
    outcome,
    previousStance: dyad.stance,
    requesterId: opportunity.requesterId,
    responderId: opportunity.responderId,
    stanceTurn,
    tick: state.tick,
  };
}

export function resolveRelationshipRequest(
  state: SimulationState,
  opportunity: RelationshipRequestOpportunity,
): SimulationState {
  const requester = agentFor(state, opportunity.requesterId);
  const responder = agentFor(state, opportunity.responderId);
  const existing =
    dyadFor(state, opportunity.responderId, opportunity.requesterId) ??
    projectedDyad(responder, opportunity.requesterId);
  const decision = evaluateRelationshipRequest(state, opportunity);
  const updated = turnDyad(existing, decision.stanceTurn);
  const summary = `${responder.profile.name} ${decision.outcome} ${requester.profile.name}'s ${opportunity.label.toLowerCase()}`;
  let next = replaceDyad(state, updated);
  next = addRelationshipMemory(
    next,
    opportunity.responderId,
    relationshipMemory(
      state,
      opportunity.responderId,
      opportunity.requesterId,
      summary,
      decision.stanceTurn,
      opportunity.id,
    ),
  );
  const entry: TraceEntry = {
    instanceId: opportunity.responderId,
    id: `${state.tick}:${opportunity.id}:relationship-request`,
    kind: 'relationship',
    minute: state.minute,
    selection: { rule: 'positive-utility', selectedId: decision.outcome },
    summary,
    terms: [
      traceTerm('request', opportunity.id, `scenario.relationshipRequests.${opportunity.id}`),
      traceTerm(
        'request-magnitude',
        opportunity.magnitude,
        `scenario.relationshipRequests.${opportunity.id}.magnitude`,
      ),
      traceTerm(
        'cooperation-position',
        decision.cooperationPosition,
        `dyads.${opportunity.responderId}:${opportunity.requesterId}.stance`,
      ),
      traceTerm(
        'validator-support',
        Math.min(0.3, existing.validatorClaimIds.length * 0.2),
        `dyads.${opportunity.responderId}:${opportunity.requesterId}.validatorClaimIds`,
      ),
      traceTerm(
        'previous-stance',
        decision.previousStance,
        `dyads.${opportunity.responderId}:${opportunity.requesterId}.stance`,
      ),
      traceTerm(
        'stance-turn',
        decision.stanceTurn,
        `relationshipDecisions.${decision.id}.stanceTurn`,
      ),
      traceTerm(
        'new-stance',
        decision.newStance,
        `dyads.${opportunity.responderId}:${opportunity.requesterId}.stance`,
      ),
      traceTerm('outcome', decision.outcome, `relationshipDecisions.${decision.id}.outcome`),
    ],
    tick: state.tick,
  };
  return {
    ...next,
    relationshipDecisions: appendBounded(
      next.relationshipDecisions,
      decision,
      MAX_RELATIONSHIP_DECISIONS,
    ),
    resolvedRelationshipRequestIds: [...next.resolvedRelationshipRequestIds, opportunity.id],
    trace: appendTrace(next.trace, entry, MAX_TRACE_ENTRIES),
  };
}

function retainedRecentMemories(memories: RuntimeMemory[]): Set<string> {
  if (memories.length <= 2) return new Set(memories.map(memory => memory.id));
  const end = memories.reduce((latest, memory) =>
    memory.minute >= latest.minute ? memory : latest,
  );
  const peak = memories.reduce((strongest, memory) =>
    Math.abs(memory.emotionalTurn ?? 0) > Math.abs(strongest.emotionalTurn ?? 0)
      ? memory
      : strongest,
  );
  return new Set([peak.id, end.id]);
}

export function consolidateRelationshipMemories(
  state: SimulationState,
  sleepingAgentIds: string[],
): SimulationState {
  let trace = state.trace;
  const sleeping = new Set(sleepingAgentIds);
  const agents = state.characters.map(agent => {
    if (!sleeping.has(agent.id)) return agent;
    const relationshipMemories = agent.memories.filter(memory => memory.type === 'relationship');
    if (relationshipMemories.length === 0) return agent;
    const retained = new Set<string>();
    const subjectIds = new Set(
      relationshipMemories
        .map(memory => memory.subjectId)
        .filter(subjectId => subjectId !== undefined),
    );
    for (const subjectId of subjectIds) {
      const recent = relationshipMemories.filter(
        memory =>
          memory.subjectId === subjectId &&
          state.minute - memory.minute < SEMANTIC_COLLAPSE_MINUTES,
      );
      for (const memoryId of retainedRecentMemories(recent)) retained.add(memoryId);
    }
    const memories = agent.memories.filter(
      memory => memory.type !== 'relationship' || retained.has(memory.id),
    );
    const removed = agent.memories.length - memories.length;
    if (removed === 0) return agent;
    trace = appendTrace(
      trace,
      {
        instanceId: agent.id,
        id: `${state.tick}:${agent.id}:memory-consolidation`,
        kind: 'relationship',
        minute: state.minute,
        selection: null,
        summary: `${agent.profile.name} consolidated relationship memories during sleep`,
        terms: [
          traceTerm('removed-episodes', removed, `characters.${agent.id}.memories`),
          traceTerm('retained-episodes', retained.size, 'simulation.relationship.peakEndRetention'),
          traceTerm('semantic-dyads', subjectIds.size, `dyads.${agent.id}`),
        ],
        tick: state.tick,
      },
      MAX_TRACE_ENTRIES,
    );
    return { ...agent, memories };
  });
  return { ...state, characters: agents, trace };
}
