import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '../model/time.js';
import { clamp, recordWindows, retainCharacterRecord } from '../model/retention.js';
import type {
  CapabilityResolution,
  ResourceState,
  CharacterInstance,
  SimulationState,
  SomaticCrowdResponse,
  SomaticEvent,
  SomaticLevel,
  SomaticObservationRecord,
  SomaticResolutionRecord,
  SomaticSourceSeed,
  SomaticSourceState,
  SomaticState,
  TraceEntryInput,
} from '../model/types.js';
import { resolveCharacterCapabilityCheck } from './capability.js';
import { evaluateEmpathy } from './empathy.js';
import {
  effectiveCascadePrior,
  effectiveContractAdherence,
  effectiveSatisfierPreferences,
  effectiveValueWeight,
} from './history.js';
import { evaluateSpatialPerception } from './spatial.js';
import { appendTrace, traceTerm } from './trace.js';

const STEADY_HABITUATION_SECONDS = 120 * SECONDS_PER_MINUTE;

function compareSources(left: SomaticSourceState, right: SomaticSourceState): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function levelFor(sources: readonly SomaticSourceState[], attentionTax: number): SomaticLevel {
  if (sources.some(source => source.preemption === 'dead')) return 5;
  if (sources.some(source => source.preemption === 'incapacitated')) return 4;
  if (sources.some(source => source.preemption === 'emergency')) return 3;
  if (sources.some(source => source.impairment > 0)) return 2;
  if (attentionTax > 0 || sources.some(source => source.pain > 0)) return 1;
  return 0;
}

export function deriveSomaticState(sources: readonly SomaticSourceState[]): SomaticState {
  let attentionTax = 0;
  let impairment = 0;
  let pain = 0;
  let perceivedUrgency = 0;
  let threatContribution = 0;
  for (const source of sources) {
    const sensitivity = 1 - source.habituation;
    attentionTax += (source.attentionTax + source.pain * 0.35) * sensitivity;
    pain += source.pain * sensitivity;
    impairment = Math.max(impairment, source.impairment);
    perceivedUrgency = Math.max(perceivedUrgency, source.perceivedUrgency);
    threatContribution += source.attentionTax * (1 - source.copingPotential) * sensitivity;
  }
  attentionTax = clamp(attentionTax, 0, 1);
  pain = clamp(pain, 0, 1);
  threatContribution = clamp(threatContribution, 0, 1);
  const copied = sources.map(source => ({ ...source })).sort(compareSources);
  return {
    attentionTax,
    impairment,
    level: levelFor(copied, attentionTax),
    pain,
    perceivedUrgency,
    sources: copied,
    threatContribution,
  };
}

export function createSomaticState(sources: readonly SomaticSourceSeed[]): SomaticState {
  return deriveSomaticState(sources.map(source => ({ ...source, habituation: 0 })));
}

export function advanceSomaticState(state: SomaticState, elapsedSeconds: number): SomaticState {
  return deriveSomaticState(
    state.sources.map(source => ({
      ...source,
      habituation:
        source.cadence === 'steady'
          ? clamp(source.habituation + elapsedSeconds / STEADY_HABITUATION_SECONDS, 0, 1)
          : source.habituation,
    })),
  );
}

export function isDerivedSomaticState(state: SomaticState): boolean {
  const derived = deriveSomaticState(state.sources);
  if (
    state.attentionTax !== derived.attentionTax ||
    state.impairment !== derived.impairment ||
    state.level !== derived.level ||
    state.pain !== derived.pain ||
    state.perceivedUrgency !== derived.perceivedUrgency ||
    state.threatContribution !== derived.threatContribution ||
    state.sources.length !== derived.sources.length
  ) {
    return false;
  }
  return state.sources.every((source, index) => {
    const expected = derived.sources[index];
    return (
      expected !== undefined &&
      source.attentionTax === expected.attentionTax &&
      source.cadence === expected.cadence &&
      source.copingPotential === expected.copingPotential &&
      source.habituation === expected.habituation &&
      source.id === expected.id &&
      source.impairment === expected.impairment &&
      source.label === expected.label &&
      source.origin === expected.origin &&
      source.pain === expected.pain &&
      source.perceivedUrgency === expected.perceivedUrgency &&
      source.preemption === expected.preemption &&
      source.visible === expected.visible
    );
  });
}

export function applySomaticResourceTax(
  resources: ResourceState,
  somatic: SomaticState,
  elapsedSeconds: number,
): ResourceState {
  return {
    ...resources,
    executiveBudget: clamp(
      resources.executiveBudget - (somatic.attentionTax * elapsedSeconds) / SECONDS_PER_HOUR,
      0,
      1,
    ),
  };
}

export function somaticActionAvailable(agent: CharacterInstance, demand: number): boolean {
  if (agent.somatic.level >= 3) return false;
  if (agent.somatic.level < 2) return true;
  return demand <= 1 - agent.somatic.impairment;
}

function agentFor(state: SimulationState, instanceId: string): CharacterInstance {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown somatic agent "${instanceId}"`);
  return agent;
}

function applySourceEvent(state: SomaticState, event: SomaticEvent): SomaticState {
  if (event.operation === 'clear') {
    return deriveSomaticState(state.sources.filter(source => source.id !== event.sourceId));
  }
  if (event.source === null) throw new Error('Validated set event contains a source');
  const next = state.sources.filter(source => source.id !== event.sourceId);
  next.push({ ...event.source, habituation: 0 });
  return deriveSomaticState(next);
}

export function somaticActivityLabel(state: SomaticState): string | null {
  if (state.level === 5) return 'Dead';
  if (state.level === 4) return 'Incapacitated';
  if (state.level === 3) {
    return state.sources.find(source => source.preemption === 'emergency')?.label ?? 'Emergency';
  }
  return null;
}

function visibleEvidence(state: SomaticState): number {
  return state.sources.reduce(
    (maximum, source) =>
      Math.max(
        maximum,
        source.visible * Math.max(source.impairment, source.pain, source.perceivedUrgency),
      ),
    0,
  );
}

function calibrationFor(
  observer: CharacterInstance,
  event: SomaticEvent,
  evidence: number,
): CapabilityResolution {
  return resolveCharacterCapabilityCheck(observer, {
    applicable: true,
    capabilityId: 'evidenceCalibration',
    difficulty: 1 - evidence,
    difficultySource: `scenario.somaticEvents.${event.id}.source.visible`,
    known: true,
    modifiers: [],
  });
}

function competenceDrive(observer: CharacterInstance): number {
  const preference = effectiveSatisfierPreferences(observer).some(
    item => item.valueId === 'competence',
  );
  return preference ? 1 : clamp(effectiveValueWeight(observer, 'competence') / 2, 0, 1);
}

function crowdResponse(
  observer: CharacterInstance,
  empathy: number,
  witnessCount: number,
): { helpProbability: number; response: SomaticCrowdResponse } {
  const obligation = effectiveContractAdherence(observer) / Math.max(1, witnessCount);
  const freeze = effectiveCascadePrior(observer, 'freeze');
  const helpProbability = clamp(
    empathy * 0.45 + competenceDrive(observer) * 0.25 + obligation * 0.3 - freeze * 0.2,
    0,
    1,
  );
  if (freeze > helpProbability && freeze >= 0.5) return { helpProbability, response: 'freeze' };
  if (helpProbability >= 0.55) return { helpProbability, response: 'help' };
  if (empathy >= 0.4) return { helpProbability, response: 'concern' };
  if (empathy < 0.2) return { helpProbability, response: 'leave' };
  return { helpProbability, response: 'ignore' };
}

function observationFor(
  state: SimulationState,
  event: SomaticEvent,
  subject: CharacterInstance,
  somatic: SomaticState,
  observerId: string,
  witnessCount: number,
): SomaticObservationRecord {
  const observer = agentFor(state, observerId);
  const perception = evaluateSpatialPerception(state, observerId, subject.id, {
    audibleRadiusMeters: 0,
    visualProminence: event.visualProminence,
  });
  const id = `${state.tick}:${event.id}:${observerId}`;
  if (!perception.sight.available || somatic.level < 2) {
    return {
      calibrationBand: null,
      calibrationMargin: null,
      empathy: 0,
      eventId: event.id,
      helpProbability: 0,
      id,
      inferredSeverity: null,
      second: state.second,
      observerId,
      outcome: 'missed',
      perceptionStrength: perception.sight.strength,
      response: null,
      subjectId: subject.id,
      tick: state.tick,
      witnessCount,
    };
  }
  const evidence = visibleEvidence(somatic) * perception.sight.strength;
  const calibration = calibrationFor(observer, event, evidence);
  const inferredSeverity = clamp(evidence * (0.5 + calibration.effectiveCapability * 0.5), 0, 1);
  const empathy = evaluateEmpathy(state, observerId, subject.id).empathy;
  const crowd = somatic.level >= 4 ? crowdResponse(observer, empathy, witnessCount) : null;
  return {
    calibrationBand: calibration.band,
    calibrationMargin: calibration.margin,
    empathy,
    eventId: event.id,
    helpProbability: crowd?.helpProbability ?? 0,
    id,
    inferredSeverity,
    second: state.second,
    observerId,
    outcome: 'observed',
    perceptionStrength: perception.sight.strength,
    response: crowd?.response ?? null,
    subjectId: subject.id,
    tick: state.tick,
    witnessCount,
  };
}

function somaticTrace(
  state: SimulationState,
  event: SomaticEvent,
  record: SomaticResolutionRecord,
): TraceEntryInput {
  return {
    instanceId: event.instanceId,
    id: `${record.id}:trace`,
    kind: 'somatic',
    second: state.second,
    selection: null,
    summary: event.summary,
    terms: [
      traceTerm('source', event.sourceId, `scenario.somaticEvents.${event.id}`),
      traceTerm('operation', event.operation, `scenario.somaticEvents.${event.id}.operation`),
      traceTerm('level-before', record.levelBefore, `somaticRecords.${record.id}`),
      traceTerm('level-after', record.levelAfter, `somaticRecords.${record.id}`),
      ...record.observations.flatMap((observation, index) => [
        traceTerm(
          `observer:${index}`,
          observation.observerId,
          `somaticRecords.${record.id}.observations.${index}`,
        ),
        traceTerm(
          `response:${index}`,
          observation.response,
          `somaticRecords.${record.id}.observations.${index}.response`,
        ),
        traceTerm(
          `help-probability:${index}`,
          observation.helpProbability,
          `somaticRecords.${record.id}.observations.${index}.helpProbability`,
        ),
      ]),
    ],
    tick: state.tick,
  };
}

export function resolveSomaticEvent(state: SimulationState, event: SomaticEvent): SimulationState {
  const subject = agentFor(state, event.instanceId);
  const somatic = applySourceEvent(subject.somatic, event);
  const witnessCount = event.observerIds.length;
  const observations = event.observerIds.map(observerId =>
    observationFor(state, event, subject, somatic, observerId, witnessCount),
  );
  const record: SomaticResolutionRecord = {
    eventId: event.id,
    id: `${state.tick}:${event.id}`,
    levelAfter: somatic.level,
    levelBefore: subject.somatic.level,
    second: state.second,
    observations,
    subjectId: subject.id,
    tick: state.tick,
  };
  return {
    ...state,
    characters: state.characters.map(agent =>
      agent.id === subject.id
        ? {
            ...agent,
            currentActivity: somaticActivityLabel(somatic) ?? agent.currentActivity,
            somatic,
          }
        : agent,
    ),
    resolvedSomaticEventIds: [...state.resolvedSomaticEventIds, event.id],
    somaticRecords: retainCharacterRecord(
      state.somaticRecords,
      record,
      record => record.subjectId,
      recordWindows(state.characters),
    ),
    trace: appendTrace(state.trace, somaticTrace(state, event, record)),
  };
}
