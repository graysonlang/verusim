import { clamp } from '../model/retention.js';
import type {
  IncidentAttribution,
  IncidentContext,
  IncidentEvent,
  IncidentGenerationDraw,
  IncidentPublicity,
  IncidentRootImpact,
  IncidentVolition,
  CharacterInstance,
  SimulationState,
} from '../model/types.js';
import { allostaticLoadFor } from '../simulation/coping.js';
import { evaluateSpatialPerception } from '../simulation/spatial.js';
import {
  GenerationSampler,
  cloneGenerated,
  freezeGenerated,
  validateGenerationRange,
  validateGenerationSeed,
  validateSamplerPosition,
  type NumericGenerationRange,
} from './sampler.js';

const INCIDENT_GENERATOR_ALGORITHM = 'verusim-incident-v1' as const;

export interface IncidentTemplate {
  affectedInstanceId: string | null;
  attribution: IncidentAttribution;
  contradictedClaimId: string | null;
  id: string;
  magnitude: NumericGenerationRange;
  publicity: IncidentPublicity;
  rootImpact: IncidentRootImpact;
  summary: string;
  volition: IncidentVolition;
  weight: number;
}

export interface IncidentGenerationRequest {
  atSecond: number;
  audibleRadiusMeters: number;
  baseRate: number;
  context: IncidentContext;
  id: string;
  interpretationDifficulty: number;
  referenceObserverId: string;
  samplerPosition?: number;
  seed: number;
  state: SimulationState;
  templates: IncidentTemplate[];
  visualProminence: number;
}

export interface IncidentSamplingProvenance {
  algorithm: typeof INCIDENT_GENERATOR_ALGORITHM;
  draws: IncidentGenerationDraw[];
  eligibleWeights: Array<{ instanceId: string; weight: number }>;
  occurred: boolean;
  samplerEnd: number;
  samplerStart: number;
  seed: number;
  templateId: string | null;
}

export interface GeneratedIncident {
  event: IncidentEvent | null;
  generation: IncidentSamplingProvenance;
}

function validateIdentifier(value: string, path: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new TypeError(`${path} must be a lowercase semantic identifier`);
  }
}

function validateRequest(request: IncidentGenerationRequest): void {
  validateGenerationSeed(request.seed);
  validateSamplerPosition(request.samplerPosition ?? 0);
  validateIdentifier(request.id, 'id');
  if (!Number.isInteger(request.atSecond) || request.atSecond < request.state.second) {
    throw new RangeError('atSecond must be an integer at or after the current state second');
  }
  for (const [field, value] of [
    ['baseRate', request.baseRate],
    ['interpretationDifficulty', request.interpretationDifficulty],
    ['visualProminence', request.visualProminence],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`${field} must be between 0 and 1`);
    }
  }
  if (!Number.isFinite(request.audibleRadiusMeters) || request.audibleRadiusMeters < 0) {
    throw new RangeError('audibleRadiusMeters must be a non-negative finite number');
  }
  if (!request.state.characters.some(agent => agent.id === request.referenceObserverId)) {
    throw new RangeError(`Unknown reference observer "${request.referenceObserverId}"`);
  }
  if (request.templates.length === 0) throw new TypeError('templates must not be empty');
  let totalWeight = 0;
  request.templates.forEach((template, index) => {
    validateIdentifier(template.id, `templates[${index}].id`);
    validateGenerationRange(template.magnitude, `templates[${index}].magnitude`, {
      maximum: 1,
      minimum: 0.001,
    });
    if (!Number.isFinite(template.weight) || template.weight <= 0) {
      throw new RangeError(`templates[${index}].weight must be positive`);
    }
    if (
      template.affectedInstanceId !== null &&
      !request.state.characters.some(agent => agent.id === template.affectedInstanceId)
    ) {
      throw new RangeError(
        `templates[${index}].affectedInstanceId names unknown agent "${template.affectedInstanceId}"`,
      );
    }
    totalWeight += template.weight;
  });
  if (!Number.isFinite(totalWeight))
    throw new RangeError('template weights must have a finite sum');
}

function visibleAgents(request: IncidentGenerationRequest): CharacterInstance[] {
  return request.state.characters.filter(agent => {
    if (agent.id === request.referenceObserverId) return true;
    const perception = evaluateSpatialPerception(
      request.state,
      request.referenceObserverId,
      agent.id,
      {
        audibleRadiusMeters: request.audibleRadiusMeters,
        visualProminence: request.visualProminence,
      },
    );
    return perception.hearing.available || perception.sight.available;
  });
}

function depletionWeight(agent: CharacterInstance): number {
  const resourceDepletion =
    (1 -
      agent.resources.executiveBudget +
      (1 - agent.resources.physicalStamina) +
      (1 - agent.resources.regulationReserve) +
      (1 - agent.resources.socialBattery)) /
    4;
  return 0.25 + resourceDepletion + allostaticLoadFor(agent);
}

function narrativeWeight(agent: CharacterInstance, template: IncidentTemplate): number {
  if (template.contradictedClaimId === null) return 1;
  const claim = agent.narrative?.claims.find(
    candidate => candidate.id === template.contradictedClaimId,
  );
  return claim === undefined ? 1 : 1 + claim.commitment * claim.confidence;
}

function weightedIndex(draw: number, weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = draw * total;
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) return index;
  }
  return weights.length - 1;
}

function generationDraws(sampler: GenerationSampler): IncidentGenerationDraw[] {
  return sampler.draws.map(draw => ({
    label: draw.id,
    maximum: draw.maximum,
    minimum: draw.minimum,
    position: draw.position,
    unit: draw.unit,
    value: draw.value,
  }));
}

export function generateIncident(request: IncidentGenerationRequest): GeneratedIncident {
  validateRequest(request);
  const samplerStart = request.samplerPosition ?? 0;
  const sampler = new GenerationSampler(request.seed, samplerStart);
  const eligible = visibleAgents(request);
  if (eligible.length === 0) throw new RangeError('observation shell contains no eligible agents');
  const baseWeights = eligible.map(depletionWeight);
  const averageWeight = baseWeights.reduce((total, weight) => total + weight, 0) / eligible.length;
  const probability = clamp(request.baseRate * (0.5 + averageWeight * 0.5), 0, 1);
  const occurrence = sampler.number('incident.occurrence', { maximum: 1, minimum: 0 });
  if (occurrence.value > probability) {
    return freezeGenerated({
      event: null,
      generation: {
        algorithm: INCIDENT_GENERATOR_ALGORITHM,
        draws: generationDraws(sampler),
        eligibleWeights: eligible.map((agent, index) => ({
          instanceId: agent.id,
          weight: baseWeights[index] ?? 0,
        })),
        occurred: false,
        samplerEnd: sampler.position,
        samplerStart,
        seed: request.seed,
        templateId: null,
      },
    });
  }
  const templateDraw = sampler.number('incident.template', { maximum: 1, minimum: 0 });
  const templateIndex = weightedIndex(
    templateDraw.unit,
    request.templates.map(template => template.weight),
  );
  const template = request.templates[templateIndex];
  if (template === undefined) throw new Error('Validated incident pool selects one template');
  const subjectWeights = eligible.map(
    agent => depletionWeight(agent) * narrativeWeight(agent, template),
  );
  const subjectDraw = sampler.number('incident.subject', { maximum: 1, minimum: 0 });
  const actor = eligible[weightedIndex(subjectDraw.unit, subjectWeights)];
  if (actor === undefined) throw new Error('Validated observation shell selects one subject');
  const magnitudeUnit = sampler.number('incident.magnitude', { maximum: 1, minimum: 0 });
  const magnitude =
    template.magnitude.minimum +
    (template.magnitude.maximum - template.magnitude.minimum) * magnitudeUnit.unit ** 3;
  const draws = generationDraws(sampler);
  const eligibleWeights = eligible.map((agent, index) => ({
    instanceId: agent.id,
    weight: subjectWeights[index] ?? 0,
  }));
  const metadata = {
    algorithm: INCIDENT_GENERATOR_ALGORITHM,
    draws,
    eligibleWeights,
    samplerEnd: sampler.position,
    samplerStart,
    seed: request.seed,
    templateId: template.id,
  } as const;
  const event: IncidentEvent = {
    actorId: actor.id,
    affectedInstanceId: template.affectedInstanceId ?? actor.id,
    atSecond: request.atSecond,
    attribution: template.attribution,
    audibleRadiusMeters: request.audibleRadiusMeters,
    context: cloneGenerated(request.context),
    generation: metadata,
    id: request.id,
    interpretationDifficulty: request.interpretationDifficulty,
    magnitude,
    observerIds: eligible.map(agent => agent.id),
    publicity: template.publicity,
    rootImpact: template.rootImpact,
    summary: template.summary,
    visualProminence: request.visualProminence,
    volition: template.volition,
  };
  return freezeGenerated({
    event,
    generation: { ...metadata, occurred: true },
  });
}
