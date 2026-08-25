import { appendBounded, clamp, recordWindows, retainCharacterRecord } from '../model/retention.js';
import type {
  DyadState,
  MindModelObservationEvent,
  MindModelDimension,
  MindModelObservationRecord,
  ObservationEvent,
  SensoryAssessment,
  CharacterInstance,
  SimulationState,
  TraceEntryInput,
} from '../model/types.js';
import { resolveCharacterCapabilityCheck } from './capability.js';
import { evaluateSpatialPerception } from './spatial.js';
import { appendTrace, traceTerm } from './trace.js';
import { resolveNormObservationEvent } from './norms.js';
import { projectedDyad, repriceExposureFor } from './relationship.js';

const CONFIRMATION_ERROR = 0.08;
const MAX_OBSERVATIONS = 120;

function agentFor(state: SimulationState, instanceId: string): CharacterInstance {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown observation agent "${instanceId}"`);
  return agent;
}

function predictedValue(dyad: DyadState, dimension: MindModelDimension): number {
  return dimension === 'empathy' ? dyad.estimatedEmpathy : dyad.estimatedDisclosure;
}

function withEstimate(dyad: DyadState, dimension: MindModelDimension, estimate: number): DyadState {
  return dimension === 'empathy'
    ? { ...dyad, estimatedEmpathy: estimate }
    : { ...dyad, estimatedDisclosure: estimate };
}

function sensoryFor(event: MindModelObservationEvent, state: SimulationState, observerId: string) {
  const perception = evaluateSpatialPerception(state, observerId, event.subjectId, {
    audibleRadiusMeters: event.audibleRadiusMeters,
    visualProminence: event.visualProminence,
  });
  const sensory: SensoryAssessment =
    event.channel === 'hearing' ? perception.hearing : perception.sight;
  return { perception, sensory };
}

function observationTrace(
  state: SimulationState,
  event: MindModelObservationEvent,
  observer: CharacterInstance,
  sensory: SensoryAssessment,
  perceptionTerms: TraceEntryInput['terms'],
): TraceEntryInput {
  const subject = agentFor(state, event.subjectId);
  const perceived = sensory.available;
  return {
    instanceId: observer.id,
    id: `${state.tick}:${event.id}:${observer.id}:observation`,
    kind: 'observation',
    second: state.second,
    selection: null,
    summary: perceived
      ? `${observer.profile.name} observed ${subject.profile.name}'s ${event.dimension} signal`
      : `${observer.profile.name} missed ${subject.profile.name}'s ${event.dimension} signal`,
    terms: [
      traceTerm('event', event.id, `scenario.observationEvents.${event.id}`),
      traceTerm('channel', event.channel, `scenario.observationEvents.${event.id}.channel`),
      traceTerm(
        'observed-value',
        event.observedValue,
        `scenario.observationEvents.${event.id}.observedValue`,
      ),
      traceTerm(
        'diagnosticity',
        event.diagnosticity,
        `scenario.observationEvents.${event.id}.diagnosticity`,
      ),
      ...perceptionTerms,
      traceTerm('perception-strength', sensory.strength, `simulation.spatial.${event.channel}`),
      traceTerm('perceived', perceived, `simulation.spatial.${event.channel}.available`),
    ],
    tick: state.tick,
  };
}

function missedRecord(
  state: SimulationState,
  event: MindModelObservationEvent,
  observerId: string,
  perceptionStrength: number,
): MindModelObservationRecord {
  return {
    calibrationBand: null,
    calibrationMargin: null,
    channel: event.channel,
    diagnosticity: event.diagnosticity,
    dimension: event.dimension,
    effectiveEvidence: 0,
    evidenceStrength: 0,
    eventId: event.id,
    eventType: 'mind-model',
    gateThreshold: null,
    id: `${state.tick}:${event.id}:${observerId}`,
    second: state.second,
    newConfidence: null,
    newEstimate: null,
    newPredictionError: null,
    newSuspicion: null,
    observedValue: event.observedValue,
    observerId,
    outcome: 'missed',
    perceptionStrength,
    predictedValue: null,
    previousConfidence: null,
    previousEstimate: null,
    previousPredictionError: null,
    previousSuspicion: null,
    rawError: null,
    subjectId: event.subjectId,
    tick: state.tick,
  };
}

function predictionTrace(
  state: SimulationState,
  event: MindModelObservationEvent,
  record: MindModelObservationRecord,
  capabilityTerms: TraceEntryInput['terms'],
): TraceEntryInput {
  const observer = agentFor(state, record.observerId);
  const subject = agentFor(state, record.subjectId);
  return {
    instanceId: record.observerId,
    id: `${state.tick}:${event.id}:${record.observerId}:prediction`,
    kind: 'prediction',
    second: state.second,
    selection: null,
    summary:
      record.outcome === 'corrected'
        ? `${observer.profile.name} corrected the model of ${subject.profile.name}`
        : record.outcome === 'confirmed'
          ? `${observer.profile.name}'s model of ${subject.profile.name} was confirmed`
          : `${observer.profile.name} grew more suspicious of ${subject.profile.name}`,
    terms: [
      traceTerm('dimension', record.dimension, `scenario.observationEvents.${event.id}.dimension`),
      traceTerm(
        'predicted-value',
        record.predictedValue,
        `dyads.${record.observerId}:${record.subjectId}.estimated${record.dimension === 'empathy' ? 'Empathy' : 'Disclosure'}`,
      ),
      traceTerm(
        'observed-value',
        record.observedValue,
        `scenario.observationEvents.${event.id}.observedValue`,
      ),
      traceTerm('raw-error', record.rawError, `observations.${record.id}.rawError`),
      ...capabilityTerms,
      traceTerm('evidence-strength', record.evidenceStrength, `observations.${record.id}`),
      traceTerm('effective-evidence', record.effectiveEvidence, `observations.${record.id}`),
      traceTerm('correction-gate', record.gateThreshold, 'simulation.prediction.correctionGate'),
      traceTerm('outcome', record.outcome, `observations.${record.id}.outcome`),
      traceTerm(
        'previous-estimate',
        record.previousEstimate,
        `dyads.${record.observerId}:${record.subjectId}`,
      ),
      traceTerm(
        'new-estimate',
        record.newEstimate,
        `dyads.${record.observerId}:${record.subjectId}`,
      ),
      traceTerm(
        'previous-confidence',
        record.previousConfidence,
        `dyads.${record.observerId}:${record.subjectId}.estimateConfidence`,
      ),
      traceTerm(
        'new-confidence',
        record.newConfidence,
        `dyads.${record.observerId}:${record.subjectId}.estimateConfidence`,
      ),
      traceTerm(
        'previous-error',
        record.previousPredictionError,
        `dyads.${record.observerId}:${record.subjectId}.predictionError`,
      ),
      traceTerm(
        'new-error',
        record.newPredictionError,
        `dyads.${record.observerId}:${record.subjectId}.predictionError`,
      ),
      traceTerm(
        'previous-suspicion',
        record.previousSuspicion,
        `dyads.${record.observerId}:${record.subjectId}.suspicion`,
      ),
      traceTerm(
        'new-suspicion',
        record.newSuspicion,
        `dyads.${record.observerId}:${record.subjectId}.suspicion`,
      ),
    ],
    tick: state.tick,
  };
}

function resolveForObserver(
  state: SimulationState,
  event: MindModelObservationEvent,
  observerId: string,
): SimulationState {
  const observer = agentFor(state, observerId);
  const { perception, sensory } = sensoryFor(event, state, observerId);
  let trace = appendTrace(
    state.trace,
    observationTrace(state, event, observer, sensory, perception.terms),
  );
  if (!sensory.available) {
    return {
      ...state,
      observations: appendBounded(
        state.observations,
        missedRecord(state, event, observerId, sensory.strength),
        MAX_OBSERVATIONS,
      ),
      trace,
    };
  }

  const existingDyad = state.dyads.find(
    dyad => dyad.observerId === observerId && dyad.subjectId === event.subjectId,
  );
  const dyad = existingDyad ?? projectedDyad(observer, event.subjectId);
  const prediction = predictedValue(dyad, event.dimension);
  const rawError = Math.abs(event.observedValue - prediction);
  const calibration = resolveCharacterCapabilityCheck(observer, {
    applicable: true,
    capabilityId: 'evidenceCalibration',
    difficulty: event.interpretationDifficulty,
    difficultySource: `scenario.observationEvents.${event.id}.interpretationDifficulty`,
    known: true,
    modifiers: [],
  });
  const calibrationQuality = clamp(((calibration.margin ?? -1) + 1) / 2, 0, 1);
  const evidenceStrength = clamp(
    sensory.strength * event.diagnosticity * (0.5 + calibrationQuality * 0.5),
    0,
    1,
  );
  const effectiveEvidence = rawError * evidenceStrength;
  const gateThreshold = 0.24 + dyad.estimateConfidence * 0.28;

  let outcome: MindModelObservationRecord['outcome'];
  let nextEstimate = prediction;
  let nextConfidence = dyad.estimateConfidence;
  let nextPredictionError = dyad.predictionError;
  let nextSuspicion = dyad.suspicion;
  if (rawError <= CONFIRMATION_ERROR) {
    outcome = 'confirmed';
    nextConfidence = clamp(
      dyad.estimateConfidence + evidenceStrength * (1 - dyad.estimateConfidence) * 0.12,
      0,
      1,
    );
    nextPredictionError = clamp(dyad.predictionError * (1 - evidenceStrength * 0.45), 0, 1);
    nextSuspicion = clamp(dyad.suspicion * (1 - evidenceStrength * 0.25), 0, 1);
  } else if (effectiveEvidence >= gateThreshold) {
    outcome = 'corrected';
    const correctionWeight = clamp(effectiveEvidence * (0.65 + calibrationQuality * 0.35), 0, 0.85);
    nextEstimate = clamp(prediction + (event.observedValue - prediction) * correctionWeight, 0, 1);
    nextConfidence = clamp(
      dyad.estimateConfidence +
        (evidenceStrength - dyad.estimateConfidence) * correctionWeight * 0.5,
      0,
      1,
    );
    nextPredictionError = clamp(dyad.predictionError * (1 - correctionWeight) * 0.4, 0, 1);
    nextSuspicion = clamp(dyad.suspicion * (1 - correctionWeight) * 0.5, 0, 1);
  } else {
    outcome = 'suspected';
    nextPredictionError = clamp(dyad.predictionError * 0.8 + effectiveEvidence * 0.55, 0, 1);
    nextSuspicion = clamp(
      dyad.suspicion + effectiveEvidence * (0.2 + dyad.estimateConfidence * 0.3),
      0,
      1,
    );
  }

  const updatedDyad = {
    ...withEstimate(dyad, event.dimension, nextEstimate),
    estimateConfidence: nextConfidence,
    predictionError: nextPredictionError,
    suspicion: nextSuspicion,
  };
  const record: MindModelObservationRecord = {
    calibrationBand: calibration.band,
    calibrationMargin: calibration.margin,
    channel: event.channel,
    diagnosticity: event.diagnosticity,
    dimension: event.dimension,
    effectiveEvidence,
    evidenceStrength,
    eventId: event.id,
    eventType: 'mind-model',
    gateThreshold,
    id: `${state.tick}:${event.id}:${observerId}`,
    second: state.second,
    newConfidence: nextConfidence,
    newEstimate: nextEstimate,
    newPredictionError: nextPredictionError,
    newSuspicion: nextSuspicion,
    observedValue: event.observedValue,
    observerId,
    outcome,
    perceptionStrength: sensory.strength,
    predictedValue: prediction,
    previousConfidence: dyad.estimateConfidence,
    previousEstimate: prediction,
    previousPredictionError: dyad.predictionError,
    previousSuspicion: dyad.suspicion,
    rawError,
    subjectId: event.subjectId,
    tick: state.tick,
  };
  trace = appendTrace(trace, predictionTrace(state, event, record, calibration.terms));
  const next: SimulationState = {
    ...state,
    dyads:
      existingDyad === undefined
        ? [...state.dyads, updatedDyad]
        : state.dyads.map(candidate =>
            candidate.observerId === observerId && candidate.subjectId === event.subjectId
              ? updatedDyad
              : candidate,
          ),
    observations: retainCharacterRecord(
      state.observations,
      record,
      record => record.observerId,
      recordWindows(state.characters),
    ),
    trace,
  };
  return repriceExposureFor(
    next,
    observerId,
    event.subjectId,
    `observations.${record.id}.newEstimate`,
  );
}

function resolveMindModelObservationEvent(
  state: SimulationState,
  event: MindModelObservationEvent,
): SimulationState {
  let next = state;
  for (const observerId of event.observerIds) {
    next = resolveForObserver(next, event, observerId);
  }
  return {
    ...next,
    resolvedObservationEventIds: [...next.resolvedObservationEventIds, event.id],
  };
}

export function resolveObservationEvent(
  state: SimulationState,
  event: ObservationEvent,
): SimulationState {
  return event.eventType === 'norm'
    ? resolveNormObservationEvent(state, event)
    : resolveMindModelObservationEvent(state, event);
}
