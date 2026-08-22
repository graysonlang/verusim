import {
  SOCIAL_FEATURE_IDS,
  type DisclosureAudienceEvaluation,
  type DisclosureDecisionRecord,
  type DisclosureOpportunity,
  type DyadState,
  type RuntimeMemory,
  type SimulationState,
  type SocialFeatureMap,
  type TraceEntry,
} from '../model/types.js';
import { appendTrace, traceTerm } from './trace.js';

const MAX_DISCLOSURE_DECISIONS = 80;
const MAX_MEMORIES = 16;
const MAX_TRACE_ENTRIES = 240;

const DISTANT_FEATURES: SocialFeatureMap = {
  category: 0,
  familiarity: 0,
  kinship: 0,
  reciprocity: 0,
  similarity: 0,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function appendBounded<Item>(items: Item[], item: Item, maximum: number): Item[] {
  const next = [...items, item];
  return next.length <= maximum ? next : next.slice(next.length - maximum);
}

function dyadFor(state: SimulationState, observerId: string, subjectId: string): DyadState | null {
  return (
    state.dyads.find(dyad => dyad.observerId === observerId && dyad.subjectId === subjectId) ?? null
  );
}

function disclosureSafety(state: SimulationState, ownerId: string, audienceId: string): number {
  const owner = state.agents.find(agent => agent.id === ownerId);
  if (owner === undefined) throw new RangeError(`Unknown disclosure owner "${ownerId}"`);
  const features = dyadFor(state, ownerId, audienceId)?.features ?? DISTANT_FEATURES;
  const meanAffinity =
    SOCIAL_FEATURE_IDS.reduce((total, featureId) => total + features[featureId], 0) /
    SOCIAL_FEATURE_IDS.length;
  const distance = 1 - meanAffinity;
  const envelope = owner.profile.disclosure;
  const baseline = envelope.intimateSafety * (1 - distance) + envelope.strangerSafety * distance;
  const offset = (distance - envelope.troughPosition) / envelope.troughWidth;
  const trough = envelope.troughDepth * Math.exp(-0.5 * offset * offset);
  return clamp(baseline - trough, 0, 1);
}

function evaluateAudience(
  state: SimulationState,
  opportunity: DisclosureOpportunity,
  audienceId: string,
  shameCharge: number,
): DisclosureAudienceEvaluation {
  const dyad = dyadFor(state, opportunity.ownerId, audienceId);
  const features = dyad?.features ?? DISTANT_FEATURES;
  const embeddedness = clamp(
    (features.category + features.familiarity + features.reciprocity) / 3,
    0,
    1,
  );
  const estimatedEmpathy = dyad?.estimatedEmpathy ?? 0.5;
  const exposureRisk = opportunity.networkConductivity * embeddedness * (1 - estimatedEmpathy);
  const safety = disclosureSafety(state, opportunity.ownerId, audienceId);
  return {
    audienceId,
    disclosureSafety: safety,
    embeddedness,
    estimatedEmpathy,
    exposureRisk,
    subjectiveCost: shameCharge * (1 - safety + exposureRisk),
  };
}

export function evaluateDisclosureOpportunity(
  state: SimulationState,
  opportunity: DisclosureOpportunity,
): DisclosureDecisionRecord {
  const item = state.disclosureItems.find(candidate => candidate.id === opportunity.itemId);
  if (item === undefined) throw new RangeError(`Unknown disclosure item "${opportunity.itemId}"`);
  const audiences = opportunity.audienceIds.map(audienceId =>
    evaluateAudience(state, opportunity, audienceId, item.shameCharge),
  );
  let worstAudience = audiences[0] ?? null;
  for (const audience of audiences.slice(1)) {
    if (worstAudience === null || audience.subjectiveCost > worstAudience.subjectiveCost) {
      worstAudience = audience;
    }
  }
  const worstCost = worstAudience?.subjectiveCost ?? 0;
  const utility = opportunity.disclosureBenefit - worstCost;
  return {
    audiences,
    disclosureBenefit: opportunity.disclosureBenefit,
    id: `${state.tick}:${opportunity.id}`,
    itemId: opportunity.itemId,
    minute: state.minute,
    opportunityId: opportunity.id,
    outcome: utility > 0 ? 'disclose' : 'conceal',
    ownerId: opportunity.ownerId,
    tick: state.tick,
    utility,
    worstAudienceId: worstAudience?.audienceId ?? null,
    worstCost,
  };
}

function appraisalTrace(
  state: SimulationState,
  opportunity: DisclosureOpportunity,
  decision: DisclosureDecisionRecord,
): TraceEntry {
  return {
    agentId: opportunity.ownerId,
    id: `${state.tick}:${opportunity.id}:disclosure-appraisal`,
    kind: 'disclosure-appraisal',
    minute: state.minute,
    selection: null,
    summary: `Disclosure utility ${decision.utility.toFixed(4)}`,
    terms: [
      traceTerm(
        'benefit',
        decision.disclosureBenefit,
        `scenario.disclosureOpportunities.${opportunity.id}.disclosureBenefit`,
      ),
      traceTerm(
        'worst-cost',
        decision.worstCost,
        `disclosureDecisions.${decision.id}.audiences.${decision.worstAudienceId ?? 'none'}.subjectiveCost`,
      ),
      traceTerm(
        'worst-audience',
        decision.worstAudienceId,
        `disclosureDecisions.${decision.id}.audiences`,
      ),
      ...decision.audiences.flatMap(audience => [
        traceTerm(
          `disclosure-safety:${audience.audienceId}`,
          audience.disclosureSafety,
          `agents.${opportunity.ownerId}.profile.disclosure`,
          `dyads.${opportunity.ownerId}:${audience.audienceId}.features`,
        ),
        traceTerm(
          `estimated-empathy:${audience.audienceId}`,
          audience.estimatedEmpathy,
          `dyads.${opportunity.ownerId}:${audience.audienceId}.estimatedEmpathy`,
        ),
        traceTerm(
          `exposure-risk:${audience.audienceId}`,
          audience.exposureRisk,
          `scenario.disclosureOpportunities.${opportunity.id}.networkConductivity`,
          `dyads.${opportunity.ownerId}:${audience.audienceId}.features`,
        ),
      ]),
    ],
    tick: state.tick,
  };
}

export function resolveDisclosureOpportunity(
  state: SimulationState,
  opportunity: DisclosureOpportunity,
): SimulationState {
  const owner = state.agents.find(agent => agent.id === opportunity.ownerId);
  if (owner === undefined)
    throw new RangeError(`Unknown disclosure owner "${opportunity.ownerId}"`);
  const decision = evaluateDisclosureOpportunity(state, opportunity);
  const item = state.disclosureItems.find(candidate => candidate.id === opportunity.itemId);
  if (item === undefined) throw new RangeError(`Unknown disclosure item "${opportunity.itemId}"`);

  const disclosed = decision.outcome === 'disclose';
  const nextItem = disclosed
    ? { ...item, knownByIds: [...new Set([...item.knownByIds, ...opportunity.audienceIds])] }
    : item;
  const summary = disclosed
    ? `${owner.profile.name} disclosed ${item.summary.toLowerCase()}`
    : `${owner.profile.name} concealed ${item.summary.toLowerCase()}`;
  const memory: RuntimeMemory = {
    id: `${state.tick}:${opportunity.id}:disclosure`,
    minute: state.minute,
    summary,
    type: 'disclosure',
  };

  let trace = appendTrace(
    state.trace,
    appraisalTrace(state, opportunity, decision),
    MAX_TRACE_ENTRIES,
  );
  trace = appendTrace(
    trace,
    {
      agentId: opportunity.ownerId,
      id: `${state.tick}:${opportunity.id}:disclosure-decision`,
      kind: 'disclosure-decision',
      minute: state.minute,
      selection: { rule: 'positive-utility', selectedId: decision.outcome },
      summary,
      terms: [
        traceTerm(
          'opportunity',
          opportunity.id,
          `scenario.disclosureOpportunities.${opportunity.id}`,
        ),
        traceTerm('utility', decision.utility, `disclosureDecisions.${decision.id}.utility`),
        traceTerm(
          'worst-audience',
          decision.worstAudienceId,
          `disclosureDecisions.${decision.id}.worstAudienceId`,
        ),
      ],
      tick: state.tick,
    },
    MAX_TRACE_ENTRIES,
  );

  return {
    ...state,
    agents: state.agents.map(agent =>
      agent.id === owner.id
        ? { ...agent, memories: appendBounded(agent.memories, memory, MAX_MEMORIES) }
        : agent,
    ),
    disclosureDecisions: appendBounded(
      state.disclosureDecisions,
      decision,
      MAX_DISCLOSURE_DECISIONS,
    ),
    disclosureItems: state.disclosureItems.map(candidate =>
      candidate.id === nextItem.id ? nextItem : candidate,
    ),
    resolvedDisclosureOpportunityIds: [...state.resolvedDisclosureOpportunityIds, opportunity.id],
    trace,
  };
}
