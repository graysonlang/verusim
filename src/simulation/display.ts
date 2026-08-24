import {
  VALUE_IDS,
  type DisplayEvent,
  type DisplayExposureState,
  type DisplayObserverAppraisal,
  type DisplayResolutionRecord,
  type DisplayResponse,
  type IncidentContractTerm,
  type PositionalRespectReference,
  type PositionalRespectState,
  type SimulationAgent,
  type SimulationState,
  type TraceEntry,
  type ValueMap,
} from '../model/types.js';
import { evaluateEmpathy } from './empathy.js';
import { effectiveIdentity } from './history.js';
import { evaluateSpatialPerception } from './spatial.js';
import { activeSocialInterpretationTerms } from './social-context.js';
import { appendTrace, traceTerm } from './trace.js';
import { applyAgentValueTurns } from './value-turn.js';

const MAX_DISPLAY_RECORDS = 160;
const MAX_POSITIONAL_REFERENCES = 5;
const MAX_TRACE_ENTRIES = 240;
const POSITIONAL_DEADBAND = 0.02;
const STATUS_RELEVANCE_FLOOR = 0.25;
const ADMIRATION_EMPATHY_FLOOR = 0.55;

interface PerceptionResult {
  exposureAfter: number;
  exposureBefore: number;
  observer: SimulationAgent;
  perceived: boolean;
  perceptionStrength: number;
}

interface PositionalUpdate {
  observedStandingChange: number;
  state: PositionalRespectState;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function appendBounded<Item>(items: readonly Item[], item: Item, maximum: number): Item[] {
  const next = [...items, item];
  return next.length <= maximum ? next : next.slice(next.length - maximum);
}

function agentFor(state: SimulationState, agentId: string): SimulationAgent {
  const agent = state.agents.find(candidate => candidate.id === agentId);
  if (agent === undefined) throw new RangeError(`Unknown display agent "${agentId}"`);
  return agent;
}

function exposureFor(
  state: SimulationState,
  event: DisplayEvent,
  observerId: string,
): DisplayExposureState | null {
  return (
    state.displayExposures.find(
      exposure => exposure.displayId === event.displayId && exposure.observerId === observerId,
    ) ?? null
  );
}

function perceptionFor(
  state: SimulationState,
  event: DisplayEvent,
  observerId: string,
): PerceptionResult {
  const observer = agentFor(state, observerId);
  const perception = evaluateSpatialPerception(state, observerId, event.wearerId, {
    audibleRadiusMeters: 0,
    visualProminence: event.visualProminence,
  });
  const exposureBefore = exposureFor(state, event, observerId)?.habituation ?? 0;
  const perceived = perception.sight.available;
  return {
    exposureAfter: perceived
      ? clamp(exposureBefore + event.habituationPerExposure, 0, 1)
      : exposureBefore,
    exposureBefore,
    observer,
    perceived,
    perceptionStrength: perception.sight.strength,
  };
}

function markerCentrality(observer: SimulationAgent, marker: string): number {
  return effectiveIdentity(observer).reduce(
    (maximum, identity) =>
      identity.marker === marker ? Math.max(maximum, identity.centrality) : maximum,
    0,
  );
}

function comparability(state: SimulationState, observerId: string, wearerId: string): number {
  const dyad = state.dyads.find(
    candidate => candidate.observerId === observerId && candidate.subjectId === wearerId,
  );
  return dyad === undefined ? 0 : Math.max(dyad.features.kinship, dyad.features.similarity);
}

function rankSimilarity(observer: SimulationAgent, wearer: SimulationAgent): number {
  return clamp(
    1 - Math.abs(observer.values.respect.charge - wearer.values.respect.charge) / 2,
    0,
    1,
  );
}

function compareReferences(
  left: PositionalRespectReference,
  right: PositionalRespectReference,
): number {
  const relevance = right.relevance - left.relevance;
  if (relevance !== 0) return relevance;
  return left.subjectId < right.subjectId ? -1 : left.subjectId > right.subjectId ? 1 : 0;
}

function updatePositionalRespect(
  current: PositionalRespectState,
  input: {
    relevance: number;
    standingAfter: number;
    standingBefore: number;
    subjectId: string;
  },
): PositionalUpdate {
  const existing = current.references.find(reference => reference.subjectId === input.subjectId);
  if (existing !== undefined) {
    return {
      observedStandingChange: input.standingAfter - existing.standing,
      state: {
        ...current,
        references: current.references
          .map(reference =>
            reference.subjectId === input.subjectId
              ? {
                  relevance: Math.max(reference.relevance, input.relevance),
                  standing: input.standingAfter,
                  subjectId: input.subjectId,
                }
              : reference,
          )
          .sort(compareReferences),
      },
    };
  }

  const candidate = {
    relevance: input.relevance,
    standing: input.standingAfter,
    subjectId: input.subjectId,
  };
  const ranked = [...current.references, candidate].sort(compareReferences);
  const references = ranked.slice(0, MAX_POSITIONAL_REFERENCES);
  if (references.some(reference => reference.subjectId === input.subjectId)) {
    const evicted = ranked.slice(MAX_POSITIONAL_REFERENCES);
    const ambientCount = current.ambientCount + evicted.length;
    const ambientStanding =
      ambientCount === 0
        ? current.ambientStanding
        : (current.ambientStanding * current.ambientCount +
            evicted.reduce((total, reference) => total + reference.standing, 0)) /
          ambientCount;
    return {
      observedStandingChange: input.standingAfter - input.standingBefore,
      state: { ambientCount, ambientStanding, references },
    };
  }

  const ambientCount = current.ambientCount + 1;
  const ambientStanding =
    (current.ambientStanding * current.ambientCount + input.standingAfter) / ambientCount;
  return {
    observedStandingChange: ambientStanding - current.ambientStanding,
    state: { ambientCount, ambientStanding, references },
  };
}

function combineTurns(
  terms: readonly IncidentContractTerm[],
  admirationTurn: number,
  positionalTurn: number,
): Partial<ValueMap<number>> {
  const result: Partial<ValueMap<number>> = {};
  for (const valueId of VALUE_IDS) {
    const conventional = terms.reduce(
      (total, term) => total + (term.conventionalTurns[valueId] ?? 0),
      0,
    );
    const turn = clamp(
      conventional + (valueId === 'respect' ? admirationTurn + positionalTurn : 0),
      -1,
      1,
    );
    if (turn !== 0) result[valueId] = turn;
  }
  return result;
}

function responseFor(input: {
  admirationTurn: number;
  contractTerms: readonly IncidentContractTerm[];
  positionalTurn: number;
}): DisplayResponse {
  const disdain = -input.contractTerms.reduce(
    (total, term) => total + Math.min(0, term.conventionalTurns.respect ?? 0),
    0,
  );
  const envy = -Math.min(0, input.positionalTurn);
  const admiration = Math.max(0, input.admirationTurn);
  if (disdain > 0 && disdain >= envy && disdain >= admiration) return 'disdain';
  if (envy > 0 && envy >= admiration) return 'envy';
  if (admiration > 0) return 'admiration';
  return 'indifference';
}

function appraisalTrace(
  state: SimulationState,
  event: DisplayEvent,
  appraisal: DisplayObserverAppraisal,
): TraceEntry {
  return {
    agentId: appraisal.observerId,
    id: `${appraisal.id}:trace`,
    kind: 'display-appraisal',
    minute: state.minute,
    selection: null,
    summary: `${agentFor(state, appraisal.observerId).profile.name}: ${appraisal.outcome}`,
    terms: [
      traceTerm('display', event.displayId, `scenario.displayEvents.${event.id}.displayId`),
      traceTerm('response', appraisal.outcome, `displayRecords.${appraisal.id}`),
      traceTerm(
        'marker-centrality',
        appraisal.markerCentrality,
        `agents.${appraisal.observerId}.history.overrides.identity`,
        `agents.${appraisal.observerId}.profile.identity`,
      ),
      traceTerm('comparability', appraisal.comparability, `dyads.${appraisal.observerId}`),
      traceTerm(
        'rank-similarity',
        appraisal.rankSimilarity,
        `agents.${appraisal.observerId}.values`,
      ),
      traceTerm('exposure-before', appraisal.exposureBefore, `displayExposures.${event.displayId}`),
      traceTerm('admiration-turn', appraisal.admirationTurn, `displayRecords.${appraisal.id}`),
      traceTerm('positional-turn', appraisal.positionalTurn, `displayRecords.${appraisal.id}`),
      ...appraisal.contractTerms.map((term, index) =>
        traceTerm(
          `contract:${index}`,
          term.contractId,
          `displayRecords.${appraisal.id}.contractTerms.${index}`,
        ),
      ),
    ],
    tick: state.tick,
  };
}

function wearerTrace(
  state: SimulationState,
  event: DisplayEvent,
  record: DisplayResolutionRecord,
): TraceEntry {
  return {
    agentId: event.wearerId,
    id: `${record.id}:wearer`,
    kind: 'display-appraisal',
    minute: state.minute,
    selection: null,
    summary: `${agentFor(state, event.wearerId).profile.name}'s display yielded ${record.wearerYield.toFixed(4)}`,
    terms: [
      traceTerm('display', event.displayId, `scenario.displayEvents.${event.id}.displayId`),
      traceTerm(
        'perceived-audience-count',
        record.perceivedAudienceCount,
        `displayRecords.${record.id}.perceivedAudienceCount`,
      ),
      traceTerm('wearer-yield', record.wearerYield, `displayRecords.${record.id}.wearerYield`),
    ],
    tick: state.tick,
  };
}

export function resolveDisplayEvent(state: SimulationState, event: DisplayEvent): SimulationState {
  const wearer = agentFor(state, event.wearerId);
  const perceptions = event.observerIds.map(observerId => perceptionFor(state, event, observerId));
  const perceived = perceptions.filter(result => result.perceived);
  const wearerYield =
    perceived.length === 0
      ? 0
      : event.magnitude *
        (perceived.reduce((total, result) => total + (1 - result.exposureBefore), 0) /
          perceived.length);
  const wearerWithYield =
    wearerYield === 0 ? wearer : applyAgentValueTurns(wearer, { respect: wearerYield });
  const standingBefore = wearer.values.respect.charge;
  const standingAfter = wearerWithYield.values.respect.charge;

  const positionalByObserver = new Map<string, PositionalRespectState>();
  const appraisals = perceptions.map(result => {
    const id = `${state.tick}:${event.id}:${result.observer.id}`;
    if (!result.perceived) {
      return {
        admirationTurn: 0,
        comparability: 0,
        contractTerms: [],
        eventId: event.id,
        exposureAfter: result.exposureAfter,
        exposureBefore: result.exposureBefore,
        id,
        markerCentrality: 0,
        minute: state.minute,
        observerId: result.observer.id,
        outcome: 'missed',
        perceptionStrength: result.perceptionStrength,
        positionalTurn: 0,
        rankSimilarity: 0,
        subjectiveTurns: {},
        tick: state.tick,
      } satisfies DisplayObserverAppraisal;
    }

    const sensitivity = 1 - result.exposureBefore;
    const centrality = markerCentrality(result.observer, event.statusMarker);
    const comparable = comparability(state, result.observer.id, event.wearerId);
    const rank = rankSimilarity(result.observer, wearer);
    const reference = updatePositionalRespect(result.observer.positionalRespect, {
      relevance: centrality * comparable,
      standingAfter,
      standingBefore,
      subjectId: event.wearerId,
    });
    positionalByObserver.set(result.observer.id, reference.state);
    const competing = event.domainContested && comparable >= 0.5 && rank >= 0.5;
    const rawPositional = competing
      ? -reference.observedStandingChange * centrality * comparable * rank
      : 0;
    const positionalTurn =
      Math.abs(rawPositional) < POSITIONAL_DEADBAND ? 0 : clamp(rawPositional, -1, 0);
    const empathy = evaluateEmpathy(state, result.observer.id, event.wearerId).empathy;
    const noncompeting = !competing;
    const admirationTurn =
      centrality >= STATUS_RELEVANCE_FLOOR && empathy >= ADMIRATION_EMPATHY_FLOOR && noncompeting
        ? event.magnitude * centrality * empathy * sensitivity
        : 0;
    const contractTerms = activeSocialInterpretationTerms(state, {
      context: event.context,
      eventId: event.id,
      magnitude: event.magnitude * sensitivity,
      observer: result.observer,
      rootImpact: 'public-status-shift',
    });
    const subjectiveTurns = combineTurns(contractTerms, admirationTurn, positionalTurn);
    return {
      admirationTurn,
      comparability: comparable,
      contractTerms,
      eventId: event.id,
      exposureAfter: result.exposureAfter,
      exposureBefore: result.exposureBefore,
      id,
      markerCentrality: centrality,
      minute: state.minute,
      observerId: result.observer.id,
      outcome: responseFor({
        admirationTurn,
        contractTerms,
        positionalTurn,
      }),
      perceptionStrength: result.perceptionStrength,
      positionalTurn,
      rankSimilarity: rank,
      subjectiveTurns,
      tick: state.tick,
    } satisfies DisplayObserverAppraisal;
  });

  const agents = state.agents.map(agent => {
    if (agent.id === event.wearerId) return wearerWithYield;
    const appraisal = appraisals.find(candidate => candidate.observerId === agent.id);
    if (appraisal === undefined || appraisal.outcome === 'missed') return agent;
    return {
      ...applyAgentValueTurns(agent, appraisal.subjectiveTurns),
      positionalRespect: positionalByObserver.get(agent.id) ?? agent.positionalRespect,
    };
  });
  const displayExposures = [...state.displayExposures];
  for (const result of perceptions) {
    if (!result.perceived) continue;
    const index = displayExposures.findIndex(
      exposure =>
        exposure.displayId === event.displayId && exposure.observerId === result.observer.id,
    );
    const previous = index < 0 ? null : displayExposures[index];
    const exposure: DisplayExposureState = {
      displayId: event.displayId,
      exposures: (previous?.exposures ?? 0) + 1,
      habituation: result.exposureAfter,
      observerId: result.observer.id,
    };
    if (index < 0) displayExposures.push(exposure);
    else displayExposures[index] = exposure;
  }
  const record: DisplayResolutionRecord = {
    appraisals,
    eventId: event.id,
    id: `${state.tick}:${event.id}`,
    minute: state.minute,
    perceivedAudienceCount: perceived.length,
    tick: state.tick,
    wearerId: event.wearerId,
    wearerYield: standingAfter - standingBefore,
  };
  let trace = state.trace;
  for (const appraisal of appraisals) {
    trace = appendTrace(trace, appraisalTrace(state, event, appraisal), MAX_TRACE_ENTRIES);
  }
  trace = appendTrace(trace, wearerTrace(state, event, record), MAX_TRACE_ENTRIES);
  return {
    ...state,
    agents,
    displayExposures,
    displayRecords: appendBounded(state.displayRecords, record, MAX_DISPLAY_RECORDS),
    resolvedDisplayEventIds: [...state.resolvedDisplayEventIds, event.id],
    trace,
  };
}
