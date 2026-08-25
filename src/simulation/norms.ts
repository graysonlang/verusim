import { MAX_TRACE_ENTRIES, appendBounded, clamp } from '../model/retention.js';
import {
  VALUE_IDS,
  type NormAddress,
  type NormDefinition,
  type NormObservationEvent,
  type NormObservationRecord,
  type NormPerspective,
  type SensoryAssessment,
  type CharacterInstance,
  type SimulationState,
  type TraceEntry,
  type ValueMap,
} from '../model/types.js';
import { resolveCharacterCapabilityCheck } from './capability.js';
import { effectiveValueWeights } from './salience.js';
import { effectiveNormInternalization } from './history.js';
import { evaluateSpatialPerception } from './spatial.js';
import { appendTrace, traceTerm } from './trace.js';
import { applyCharacterValueTurns } from './value-turn.js';

const MAX_OBSERVATIONS = 120;

function agentFor(state: SimulationState, instanceId: string): CharacterInstance {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown norm observer "${instanceId}"`);
  return agent;
}

function normKey(address: NormAddress): string {
  return `${address.packageId}:${address.kind}:${address.resourceId}`;
}

function normFor(state: SimulationState, address: NormAddress): NormDefinition {
  const key = normKey(address);
  const resource = state.norms.find(candidate => normKey(candidate.address) === key);
  if (resource === undefined) throw new RangeError(`Unknown norm resource "${key}"`);
  return resource.norm;
}

function perspectiveFor(
  state: SimulationState,
  observerId: string,
  norm: NormAddress,
): NormPerspective {
  const placement = state.scenario.characters.find(
    candidate => candidate.instanceId === observerId,
  );
  const key = normKey(norm);
  const perspective = placement?.normPerspectives.find(
    candidate => normKey(candidate.norm) === key,
  );
  if (perspective === undefined) {
    throw new RangeError(`Missing norm perspective for "${observerId}" and "${key}"`);
  }
  return perspective;
}

function sensoryFor(event: NormObservationEvent, state: SimulationState, observerId: string) {
  const perception = evaluateSpatialPerception(state, observerId, event.subjectId, {
    audibleRadiusMeters: event.audibleRadiusMeters,
    visualProminence: event.visualProminence,
  });
  const sensory: SensoryAssessment =
    event.channel === 'hearing' ? perception.hearing : perception.sight;
  return { perception, sensory };
}

function subjectiveTurns(
  event: NormObservationEvent,
  norm: NormDefinition,
  internalization: number,
): {
  compatibilityTurns: Partial<ValueMap<number>>;
  subjectiveTurns: Partial<ValueMap<number>>;
} {
  const compatibilityTurns: Partial<ValueMap<number>> = {};
  const resolvedTurns: Partial<ValueMap<number>> = {};
  for (const valueId of VALUE_IDS) {
    const baseline = event.baselineTurns[valueId] ?? 0;
    const compatibilityTurn =
      (norm.compatibilityTurns[valueId] ?? 0) * event.compatibility * internalization;
    const subjectiveTurn = clamp(baseline + compatibilityTurn, -1, 1);
    if (compatibilityTurn !== 0) compatibilityTurns[valueId] = compatibilityTurn;
    if (subjectiveTurn !== 0) resolvedTurns[valueId] = subjectiveTurn;
  }
  return { compatibilityTurns, subjectiveTurns: resolvedTurns };
}

function weightedTurn(agent: CharacterInstance, turns: Partial<ValueMap<number>>): number {
  const weights = effectiveValueWeights(agent);
  return VALUE_IDS.reduce((total, valueId) => total + weights[valueId] * (turns[valueId] ?? 0), 0);
}

function observationTrace(
  state: SimulationState,
  event: NormObservationEvent,
  observer: CharacterInstance,
  sensory: SensoryAssessment,
  perceptionTerms: TraceEntry['terms'],
): TraceEntry {
  const perceived = sensory.available;
  const key = normKey(event.norm);
  return {
    instanceId: observer.id,
    id: `${state.tick}:${event.id}:${observer.id}:observation`,
    kind: 'observation',
    minute: state.minute,
    selection: null,
    summary: perceived
      ? `${observer.profile.name} observed ${event.summary.toLowerCase()}`
      : `${observer.profile.name} missed ${event.summary.toLowerCase()}`,
    terms: [
      traceTerm('event', event.id, `scenario.observationEvents.${event.id}`),
      traceTerm('event-type', event.eventType, `scenario.observationEvents.${event.id}.eventType`),
      traceTerm('norm', key, `scenario.observationEvents.${event.id}.norm`),
      traceTerm('channel', event.channel, `scenario.observationEvents.${event.id}.channel`),
      ...perceptionTerms,
      traceTerm('perception-strength', sensory.strength, `simulation.spatial.${event.channel}`),
      traceTerm('perceived', perceived, `simulation.spatial.${event.channel}.available`),
    ],
    tick: state.tick,
  };
}

function missedRecord(
  state: SimulationState,
  event: NormObservationEvent,
  observerId: string,
  perspective: NormPerspective,
  perceptionStrength: number,
): NormObservationRecord {
  const key = normKey(event.norm);
  return {
    affiliated: perspective.affiliated,
    baselineTurns: { ...event.baselineTurns },
    channel: event.channel,
    compatibilityTurns: {},
    eventId: event.id,
    eventType: 'norm',
    id: `${state.tick}:${event.id}:${observerId}`,
    legibility: perspective.legibility,
    legibilityBand: null,
    legibilityMargin: null,
    internalization: effectiveNormInternalization(agentFor(state, observerId), event.norm),
    minute: state.minute,
    normId: key,
    observerId,
    outcome: 'missed',
    perceptionStrength,
    subjectId: event.subjectId,
    subjectiveTurn: null,
    subjectiveTurns: {},
    tick: state.tick,
  };
}

function appraisalTrace(
  state: SimulationState,
  event: NormObservationEvent,
  record: NormObservationRecord,
  capabilityTerms: TraceEntry['terms'],
): TraceEntry {
  const observer = agentFor(state, record.observerId);
  const direction =
    record.subjectiveTurn === null || Math.abs(record.subjectiveTurn) < 0.0001
      ? 'neutral'
      : record.subjectiveTurn > 0
        ? 'positive'
        : 'negative';
  const key = normKey(event.norm);
  const perspectiveSource = `scenario.characters.${record.observerId}.normPerspectives.${key}`;
  return {
    instanceId: record.observerId,
    id: `${state.tick}:${event.id}:${record.observerId}:norm-appraisal`,
    kind: 'norm-appraisal',
    minute: state.minute,
    selection: null,
    summary: `${observer.profile.name} derived a ${direction} turn from ${event.summary.toLowerCase()}`,
    terms: [
      traceTerm('norm', key, `resources.${key}.norm`),
      traceTerm('affiliated', record.affiliated, `${perspectiveSource}.affiliated`),
      traceTerm(
        'internalization',
        record.internalization,
        `characters.${record.observerId}.history.overrides.normInternalizations.${key}`,
      ),
      traceTerm('legibility', record.legibility, `${perspectiveSource}.legibility`),
      ...capabilityTerms,
      traceTerm('legibility-band', record.legibilityBand, `observations.${record.id}`),
      traceTerm(
        'event-compatibility',
        event.compatibility,
        `scenario.observationEvents.${event.id}`,
      ),
      ...VALUE_IDS.flatMap(valueId => {
        const terms = [];
        const baseline = record.baselineTurns[valueId] ?? 0;
        const compatibility = record.compatibilityTurns[valueId] ?? 0;
        const subjective = record.subjectiveTurns[valueId] ?? 0;
        if (baseline !== 0) {
          terms.push(
            traceTerm(
              `baseline:${valueId}`,
              baseline,
              `scenario.observationEvents.${event.id}.baselineTurns.${valueId}`,
            ),
          );
        }
        if (compatibility !== 0) {
          terms.push(
            traceTerm(
              `compatibility:${valueId}`,
              compatibility,
              `resources.${key}.norm.compatibilityTurns.${valueId}`,
              `characters.${record.observerId}.history.overrides.normInternalizations.${key}`,
            ),
          );
        }
        if (subjective !== 0) {
          terms.push(traceTerm(`subjective:${valueId}`, subjective, `observations.${record.id}`));
        }
        return terms;
      }),
      traceTerm('subjective-turn', record.subjectiveTurn, `observations.${record.id}`),
    ],
    tick: state.tick,
  };
}

function resolveForObserver(
  state: SimulationState,
  event: NormObservationEvent,
  observerId: string,
): SimulationState {
  const observer = agentFor(state, observerId);
  const perspective = perspectiveFor(state, observerId, event.norm);
  const { perception, sensory } = sensoryFor(event, state, observerId);
  let trace = appendTrace(
    state.trace,
    observationTrace(state, event, observer, sensory, perception.terms),
    MAX_TRACE_ENTRIES,
  );
  if (!sensory.available) {
    return {
      ...state,
      observations: appendBounded(
        state.observations,
        missedRecord(state, event, observerId, perspective, sensory.strength),
        MAX_OBSERVATIONS,
      ),
      trace,
    };
  }

  const norm = normFor(state, event.norm);
  const key = normKey(event.norm);
  const legibility = resolveCharacterCapabilityCheck(observer, {
    applicable: true,
    capabilityId: 'evidenceCalibration',
    difficulty: event.interpretationDifficulty,
    difficultySource: `scenario.observationEvents.${event.id}.interpretationDifficulty`,
    known: perspective.legibility > 0,
    modifiers: [
      {
        id: 'local-norm-legibility',
        source: `scenario.characters.${observerId}.normPerspectives.${key}.legibility`,
        value: perspective.legibility * 0.6,
      },
    ],
  });
  const internalization = effectiveNormInternalization(observer, event.norm);
  const turns = subjectiveTurns(event, norm, internalization);
  const subjectiveTurn = weightedTurn(observer, turns.subjectiveTurns);
  const record: NormObservationRecord = {
    affiliated: perspective.affiliated,
    baselineTurns: { ...event.baselineTurns },
    channel: event.channel,
    compatibilityTurns: turns.compatibilityTurns,
    eventId: event.id,
    eventType: 'norm',
    id: `${state.tick}:${event.id}:${observerId}`,
    legibility: perspective.legibility,
    legibilityBand: legibility.band,
    legibilityMargin: legibility.margin,
    internalization,
    minute: state.minute,
    normId: key,
    observerId,
    outcome: 'appraised',
    perceptionStrength: sensory.strength,
    subjectId: event.subjectId,
    subjectiveTurn,
    subjectiveTurns: turns.subjectiveTurns,
    tick: state.tick,
  };
  trace = appendTrace(
    trace,
    appraisalTrace(state, event, record, legibility.terms),
    MAX_TRACE_ENTRIES,
  );
  return {
    ...state,
    characters: state.characters.map(candidate =>
      candidate.id === observerId
        ? applyCharacterValueTurns(candidate, turns.subjectiveTurns)
        : candidate,
    ),
    observations: appendBounded(state.observations, record, MAX_OBSERVATIONS),
    trace,
  };
}

export function resolveNormObservationEvent(
  state: SimulationState,
  event: NormObservationEvent,
): SimulationState {
  let next = state;
  for (const observerId of event.observerIds) next = resolveForObserver(next, event, observerId);
  return {
    ...next,
    resolvedObservationEventIds: [...next.resolvedObservationEventIds, event.id],
  };
}
