import { clamp, recordWindows, retainCharacterRecord } from '../model/retention.js';
import {
  VALUE_IDS,
  type IncidentAppraisalRecord,
  type IncidentContractTerm,
  type IncidentEvent,
  type IncidentPerceivedAttribution,
  type CharacterInstance,
  type SimulationState,
  type TraceEntryInput,
  type ValueMap,
} from '../model/types.js';
import { effectiveIdentity } from './history.js';
import { evaluateEmpathy } from './empathy.js';
import { effectiveValueWeights } from './salience.js';
import { evaluateSpatialPerception } from './spatial.js';
import { activeSocialInterpretationTerms } from './social-context.js';
import { appendTrace, traceTerm } from './trace.js';
import { applyCharacterValueTurns } from './value-turn.js';

function agentFor(state: SimulationState, instanceId: string): CharacterInstance {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown incident agent "${instanceId}"`);
  return agent;
}

function baselineTurns(
  state: SimulationState,
  event: IncidentEvent,
  observerId: string,
): Partial<ValueMap<number>> {
  const empathy = evaluateEmpathy(state, observerId, event.affectedInstanceId).empathy;
  const magnitude = event.magnitude * empathy;
  switch (event.rootImpact) {
    case 'accidental-disclosure':
      return { autonomy: -magnitude, respect: -magnitude * 0.5, safety: -magnitude * 0.4 };
    case 'material-gain':
      return { competence: magnitude, safety: magnitude * 0.35 };
    case 'material-loss':
      return { competence: -magnitude, safety: -magnitude * 0.35 };
    case 'obligation-created':
      return { autonomy: -magnitude };
    case 'physical-harm-risk':
      return { safety: -magnitude };
    case 'public-status-shift':
      return { respect: magnitude };
    case 'norm-violation':
      return {};
  }
}

function perceivedAttribution(
  state: SimulationState,
  event: IncidentEvent,
  observerId: string,
): IncidentPerceivedAttribution {
  if (event.attribution !== 'ambiguous') return event.attribution;
  if (event.actorId === null) return 'nobody';
  const model = state.dyads.find(
    dyad => dyad.observerId === observerId && dyad.subjectId === event.actorId,
  );
  if (model === undefined) return 'nobody';
  const benign =
    model.estimatedEmpathy +
    Math.max(0, model.stance) * 0.3 -
    model.suspicion * 0.5 -
    model.predictionError * 0.2;
  return benign >= 0.45 ? 'nobody' : 'other';
}

function estimatedAudienceAppraisal(state: SimulationState, event: IncidentEvent): number {
  if (event.actorId === null) return 0;
  const estimates = event.observerIds
    .filter(observerId => observerId !== event.actorId)
    .map(observerId =>
      state.dyads.find(dyad => dyad.observerId === event.actorId && dyad.subjectId === observerId),
    )
    .filter(dyad => dyad !== undefined)
    .map(dyad => dyad.estimatedEmpathy * dyad.estimateConfidence);
  return estimates.length === 0
    ? 0
    : estimates.reduce((total, estimate) => total + estimate, 0) / estimates.length;
}

function shameTurn(
  state: SimulationState,
  event: IncidentEvent,
  observer: CharacterInstance,
  terms: readonly IncidentContractTerm[],
): number {
  if (
    observer.id !== event.actorId ||
    event.rootImpact !== 'norm-violation' ||
    event.volition !== 'involuntary'
  ) {
    return 0;
  }
  const centrality = effectiveIdentity(observer).reduce(
    (maximum, marker) => Math.max(maximum, marker.centrality),
    0,
  );
  const identityStake = terms.reduce((total, term) => total + term.identityStake, 0);
  const amount = clamp(
    event.magnitude * centrality * identityStake * estimatedAudienceAppraisal(state, event),
    0,
    1,
  );
  return amount === 0 ? 0 : -amount;
}

function combinedTurns(
  baseline: Partial<ValueMap<number>>,
  terms: readonly IncidentContractTerm[],
  shame: number,
): Partial<ValueMap<number>> {
  const turns: Partial<ValueMap<number>> = {};
  for (const valueId of VALUE_IDS) {
    const conventional = terms.reduce(
      (total, term) => total + (term.conventionalTurns[valueId] ?? 0),
      0,
    );
    const turn = clamp(
      (baseline[valueId] ?? 0) + conventional + (valueId === 'respect' ? shame : 0),
      -1,
      1,
    );
    if (turn !== 0) turns[valueId] = turn;
  }
  return turns;
}

function appraisalTrace(
  state: SimulationState,
  event: IncidentEvent,
  record: IncidentAppraisalRecord,
): TraceEntryInput {
  const observer = agentFor(state, record.observerId);
  const weighted = VALUE_IDS.reduce(
    (total, valueId) =>
      total + (record.subjectiveTurns[valueId] ?? 0) * effectiveValueWeights(observer)[valueId],
    0,
  );
  return {
    instanceId: observer.id,
    id: `${record.id}:trace`,
    kind: 'incident-appraisal',
    minute: state.minute,
    selection: null,
    summary: `${observer.profile.name} appraised ${event.summary.toLowerCase()}`,
    terms: [
      traceTerm('incident', event.id, `scenario.incidentEvents.${event.id}`),
      traceTerm('root-impact', event.rootImpact, `scenario.incidentEvents.${event.id}.rootImpact`),
      traceTerm('perceived', record.outcome === 'appraised', `incidentRecords.${record.id}`),
      traceTerm(
        'perceived-attribution',
        record.perceivedAttribution,
        `incidentRecords.${record.id}`,
      ),
      ...record.contractTerms.flatMap((term, index) => [
        traceTerm(
          `contract:${index}`,
          term.contractId,
          `incidentRecords.${record.id}.contractTerms.${index}`,
        ),
        traceTerm(
          `affiliated:${index}`,
          term.affiliated,
          `scenario.characters.${observer.id}.normPerspectives`,
        ),
        traceTerm(
          `internalization:${index}`,
          term.internalization,
          `characters.${observer.id}.history.overrides.normInternalizations.${term.normId}`,
        ),
        traceTerm(
          `legibility:${index}`,
          term.legibility,
          `scenario.characters.${observer.id}.normPerspectives`,
        ),
        traceTerm(
          `enforcement:${index}`,
          term.enforcementPressure,
          `incidentRecords.${record.id}.contractTerms.${index}`,
        ),
      ]),
      traceTerm('shame-turn', record.shameTurn, `incidentRecords.${record.id}.shameTurn`),
      traceTerm('weighted-turn', weighted, `incidentRecords.${record.id}.subjectiveTurns`),
    ],
    tick: state.tick,
  };
}

function applyAttributionInference(
  state: SimulationState,
  event: IncidentEvent,
  observerId: string,
  attribution: IncidentPerceivedAttribution,
): SimulationState {
  if (event.attribution !== 'ambiguous' || event.actorId === null) return state;
  return {
    ...state,
    dyads: state.dyads.map(dyad => {
      if (dyad.observerId !== observerId || dyad.subjectId !== event.actorId) return dyad;
      const direction = attribution === 'other' ? 1 : -1;
      return {
        ...dyad,
        predictionError: clamp(dyad.predictionError + direction * event.magnitude * 0.08, 0, 1),
        suspicion: clamp(dyad.suspicion + direction * event.magnitude * 0.12, 0, 1),
      };
    }),
  };
}

function resolveForObserver(
  state: SimulationState,
  event: IncidentEvent,
  observerId: string,
): SimulationState {
  const perception =
    observerId === event.affectedInstanceId
      ? null
      : evaluateSpatialPerception(state, observerId, event.affectedInstanceId, {
          audibleRadiusMeters: event.audibleRadiusMeters,
          visualProminence: event.visualProminence,
        });
  const perceptionStrength =
    perception === null ? 1 : Math.max(perception.hearing.strength, perception.sight.strength);
  const perceived =
    perception === null || perception.hearing.available || perception.sight.available;
  const id = `${state.tick}:${event.id}:${observerId}`;
  if (!perceived) {
    const record: IncidentAppraisalRecord = {
      baselineTurns: {},
      contractTerms: [],
      eventId: event.id,
      id,
      minute: state.minute,
      observerId,
      outcome: 'missed',
      perceivedAttribution: null,
      perceptionStrength,
      shameTurn: 0,
      subjectiveTurns: {},
      tick: state.tick,
    };
    return {
      ...state,
      incidentRecords: retainCharacterRecord(
        state.incidentRecords,
        record,
        record => record.observerId,
        recordWindows(state.characters),
      ),
      trace: appendTrace(state.trace, appraisalTrace(state, event, record)),
    };
  }
  const observer = agentFor(state, observerId);
  const baseline = baselineTurns(state, event, observerId);
  const terms = activeSocialInterpretationTerms(state, {
    context: event.context,
    eventId: event.id,
    magnitude: event.magnitude,
    observer,
    rootImpact: event.rootImpact,
  });
  const shame = shameTurn(state, event, observer, terms);
  const turns = combinedTurns(baseline, terms, shame);
  const attribution = perceivedAttribution(state, event, observerId);
  const record: IncidentAppraisalRecord = {
    baselineTurns: baseline,
    contractTerms: terms,
    eventId: event.id,
    id,
    minute: state.minute,
    observerId,
    outcome: 'appraised',
    perceivedAttribution: attribution,
    perceptionStrength,
    shameTurn: shame,
    subjectiveTurns: turns,
    tick: state.tick,
  };
  const next = applyAttributionInference(
    {
      ...state,
      characters: state.characters.map(agent =>
        agent.id === observerId ? applyCharacterValueTurns(agent, turns) : agent,
      ),
      incidentRecords: retainCharacterRecord(
        state.incidentRecords,
        record,
        record => record.observerId,
        recordWindows(state.characters),
      ),
    },
    event,
    observerId,
    attribution,
  );
  return {
    ...next,
    trace: appendTrace(next.trace, appraisalTrace(next, event, record)),
  };
}

export function resolveIncidentEvent(
  state: SimulationState,
  event: IncidentEvent,
): SimulationState {
  let next = state;
  for (const observerId of event.observerIds) next = resolveForObserver(next, event, observerId);
  return {
    ...next,
    resolvedIncidentEventIds: [...next.resolvedIncidentEventIds, event.id],
  };
}
