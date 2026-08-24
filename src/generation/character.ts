import {
  CAPABILITY_IDS,
  OUTLET_OPERATIONS,
  SOCIAL_FEATURE_IDS,
  VALUE_IDS,
  type CapabilityId,
  type CascadePosition,
  type CharacterDefinition,
  type CharacterProfileResourceFile,
  type Constitution,
  type DisclosureEnvelope,
  type EmpathyEnvelope,
  type FormativeEvent,
  type IdentityMarker,
  type OutletOperation,
  type SatisfierPreference,
  type SocialFeatureId,
  type ValueId,
} from '../model/types.js';
import { parseResourceFile } from '../scenario/parse.js';
import { initializeHistoryDerivedState } from '../simulation/history.js';

const GENERATOR_ALGORITHM = 'verusim-character-v1' as const;
const UINT32_RANGE = 0x1_0000_0000;
const UINT32_MAX = UINT32_RANGE - 1;
const CASCADE_POSITIONS = ['freeze', 'fight', 'flight', 'fawn', 'flop'] as const;
const CONSTITUTION_FIELDS = [
  'baselineArousal',
  'habituationRate',
  'reactivity',
  'recoveryRate',
  'socialValence',
  'threshold',
] as const;
const DISCLOSURE_FIELDS = [
  'intimateSafety',
  'strangerSafety',
  'troughDepth',
  'troughPosition',
  'troughWidth',
] as const;
const EMPATHY_FIELDS = [
  'ceiling',
  'floor',
  'selfPosition',
  'steepness',
  'threatSensitivity',
] as const;

export interface NumericGenerationRange {
  maximum: number;
  minimum: number;
}

export interface IntegerGenerationRange extends NumericGenerationRange {}

type PartialRanges<Shape> = Partial<Record<keyof Shape, NumericGenerationRange>>;

export interface RoleIdentityMarker {
  centrality: NumericGenerationRange;
  marker: string;
}

export interface RoleOutletPreference {
  operation: OutletOperation;
  rank: NumericGenerationRange;
}

export interface RoleFormativeEventTemplate {
  age: IntegerGenerationRange;
  attribution: string | null;
  copingPotential: NumericGenerationRange;
  id: string;
  summary: string;
  turn: NumericGenerationRange;
  value: ValueId;
  weight: number;
}

export interface CharacterRoleBundle {
  formativeEventCount: IntegerGenerationRange;
  formativeEventPool: RoleFormativeEventTemplate[];
  id: string;
  identity?: RoleIdentityMarker[];
  label: string;
  outletPreferences?: RoleOutletPreference[];
  ranges: {
    capabilities?: Partial<Record<CapabilityId, NumericGenerationRange>>;
    cascadePriors?: Partial<Record<Exclude<CascadePosition, 'none'>, NumericGenerationRange>>;
    comeliness?: NumericGenerationRange;
    constitution?: PartialRanges<Constitution>;
    contractAdherence?: NumericGenerationRange;
    disclosure?: PartialRanges<DisclosureEnvelope>;
    empathy?: PartialRanges<Omit<EmpathyEnvelope, 'featureWeights'>> & {
      featureWeights?: Partial<Record<SocialFeatureId, NumericGenerationRange>>;
    };
    valueWeights?: Partial<Record<ValueId, NumericGenerationRange>>;
  };
  satisfierPreferences?: SatisfierPreference[];
}

export interface CharacterGenerationRequest {
  packageId: string;
  profile: CharacterDefinition;
  role: CharacterRoleBundle;
}

export interface RealizedGenerationDraw {
  id: string;
  maximum: number;
  minimum: number;
  position: number;
  unit: number;
  value: number;
}

export interface GeneratedFormativeEventProvenance {
  dispositionEventId: string;
  event: FormativeEvent;
  eventIndex: number;
  memoryId: string;
  selectionDrawPosition: number;
  templateId: string;
}

export interface CharacterGenerationProvenance {
  algorithm: typeof GENERATOR_ALGORITHM;
  draws: RealizedGenerationDraw[];
  formativeEvents: GeneratedFormativeEventProvenance[];
  roleBundleId: string;
  samplerEnd: number;
  samplerStart: number;
  seed: number;
}

export interface GeneratedCharacterProfile {
  generation: CharacterGenerationProvenance;
  resource: CharacterProfileResourceFile;
}

export interface CohortGenerationRequest {
  maximumAttemptsPerMember?: number;
  members: CharacterGenerationRequest[];
  minimumSeparation: number;
  samplerPosition?: number;
  seed: number;
}

export interface CohortGenerationAttempt {
  accepted: boolean;
  attempt: number;
  draws: RealizedGenerationDraw[];
  nearestDistance: number | null;
  profileId: string;
  samplerEnd: number;
  samplerStart: number;
}

export interface GeneratedCharacterCohort {
  attempts: CohortGenerationAttempt[];
  minimumSeparation: number;
  profiles: GeneratedCharacterProfile[];
  samplerEnd: number;
  samplerStart: number;
  seed: number;
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function validateIdentifier(value: string, path: string): void {
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value)) {
    throw new TypeError(`${path} must be a lowercase semantic identifier`);
  }
}

function validateSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new RangeError(`seed must be an integer from 0 through ${UINT32_MAX}`);
  }
}

function validateSamplerPosition(position: number): void {
  if (!Number.isInteger(position) || position < 0 || position > UINT32_MAX) {
    throw new RangeError(`samplerPosition must be an integer from 0 through ${UINT32_MAX}`);
  }
}

function validateRange(
  range: NumericGenerationRange,
  path: string,
  bounds: NumericGenerationRange,
  integer = false,
): void {
  if (!Number.isFinite(range.minimum) || !Number.isFinite(range.maximum)) {
    throw new TypeError(`${path} bounds must be finite numbers`);
  }
  if (range.minimum > range.maximum) {
    throw new RangeError(`${path}.minimum must not exceed ${path}.maximum`);
  }
  if (range.minimum < bounds.minimum || range.maximum > bounds.maximum) {
    throw new RangeError(`${path} must stay within ${bounds.minimum} through ${bounds.maximum}`);
  }
  if (integer && (!Number.isInteger(range.minimum) || !Number.isInteger(range.maximum))) {
    throw new TypeError(`${path} bounds must be integers`);
  }
}

function unitFor(seed: number, position: number): number {
  let value = (seed + Math.imul(position + 1, 0x9e3779b9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x21f0aaad);
  value ^= value >>> 15;
  value = Math.imul(value, 0x735a2d97);
  value ^= value >>> 15;
  return (value >>> 0) / UINT32_RANGE;
}

class GenerationSampler {
  readonly draws: RealizedGenerationDraw[] = [];
  position: number;

  constructor(
    readonly seed: number,
    position: number,
  ) {
    this.position = position;
  }

  number(id: string, range: NumericGenerationRange): RealizedGenerationDraw {
    if (this.position > UINT32_MAX) throw new RangeError('generation sampler position overflow');
    const position = this.position;
    const unit = unitFor(this.seed, position);
    const draw = {
      id,
      maximum: range.maximum,
      minimum: range.minimum,
      position,
      unit,
      value: range.minimum + (range.maximum - range.minimum) * unit,
    };
    this.position += 1;
    this.draws.push(draw);
    return draw;
  }

  integer(id: string, range: IntegerGenerationRange): RealizedGenerationDraw {
    const draw = this.number(id, range);
    draw.value = Math.min(
      range.maximum,
      range.minimum + Math.floor(draw.unit * (range.maximum - range.minimum + 1)),
    );
    return draw;
  }
}

function validateRole(role: CharacterRoleBundle, ageYears: number): void {
  validateIdentifier(role.id, 'role.id');
  if (role.label.trim() === '') throw new TypeError('role.label must not be empty');
  validateRange(
    role.formativeEventCount,
    'role.formativeEventCount',
    { minimum: 1, maximum: 40 },
    true,
  );
  if (role.formativeEventPool.length === 0) {
    throw new TypeError('role.formativeEventPool must contain at least one template');
  }
  const templateIds = new Set<string>();
  for (const [index, template] of role.formativeEventPool.entries()) {
    const path = `role.formativeEventPool[${index}]`;
    validateIdentifier(template.id, `${path}.id`);
    if (templateIds.has(template.id)) throw new TypeError(`${path}.id must be unique`);
    templateIds.add(template.id);
    if (!(template.weight > 0) || !Number.isFinite(template.weight)) {
      throw new RangeError(`${path}.weight must be a positive finite number`);
    }
    validateRange(template.age, `${path}.age`, { minimum: 0, maximum: ageYears }, true);
    validateRange(template.turn, `${path}.turn`, { minimum: -1, maximum: 1 });
    validateRange(template.copingPotential, `${path}.copingPotential`, {
      minimum: 0,
      maximum: 1,
    });
    if (template.summary.trim() === '') throw new TypeError(`${path}.summary must not be empty`);
  }

  const ranges = role.ranges;
  for (const capabilityId of CAPABILITY_IDS) {
    const range = ranges.capabilities?.[capabilityId];
    if (range !== undefined) {
      validateRange(range, `role.ranges.capabilities.${capabilityId}`, {
        minimum: 0,
        maximum: 1,
      });
    }
  }
  for (const position of CASCADE_POSITIONS) {
    const range = ranges.cascadePriors?.[position];
    if (range !== undefined) {
      validateRange(range, `role.ranges.cascadePriors.${position}`, {
        minimum: 0,
        maximum: 1,
      });
    }
  }
  for (const field of CONSTITUTION_FIELDS) {
    const range = ranges.constitution?.[field];
    if (range !== undefined) {
      validateRange(range, `role.ranges.constitution.${field}`, {
        minimum: field === 'socialValence' ? -1 : 0,
        maximum: 1,
      });
    }
  }
  if (ranges.contractAdherence !== undefined) {
    validateRange(ranges.contractAdherence, 'role.ranges.contractAdherence', {
      minimum: 0,
      maximum: 1,
    });
  }
  if (ranges.comeliness !== undefined) {
    validateRange(ranges.comeliness, 'role.ranges.comeliness', { minimum: 0, maximum: 1 });
  }
  for (const field of DISCLOSURE_FIELDS) {
    const range = ranges.disclosure?.[field];
    if (range !== undefined) {
      validateRange(range, `role.ranges.disclosure.${field}`, {
        minimum: field === 'troughWidth' ? 0.01 : 0,
        maximum: 1,
      });
    }
  }
  for (const field of EMPATHY_FIELDS) {
    const range = ranges.empathy?.[field];
    if (range !== undefined) {
      validateRange(range, `role.ranges.empathy.${field}`, {
        minimum: field === 'steepness' ? 0.01 : 0,
        maximum: field === 'steepness' ? 12 : 1,
      });
    }
  }
  const floor = ranges.empathy?.floor;
  const ceiling = ranges.empathy?.ceiling;
  if (floor !== undefined && ceiling !== undefined && floor.maximum > ceiling.minimum) {
    throw new RangeError('role empathy floor range must remain at or below its ceiling range');
  }
  for (const featureId of SOCIAL_FEATURE_IDS) {
    const range = ranges.empathy?.featureWeights?.[featureId];
    if (range !== undefined) {
      validateRange(range, `role.ranges.empathy.featureWeights.${featureId}`, {
        minimum: 0,
        maximum: 4,
      });
    }
  }
  for (const valueId of VALUE_IDS) {
    const range = ranges.valueWeights?.[valueId];
    if (range !== undefined) {
      validateRange(range, `role.ranges.valueWeights.${valueId}`, {
        minimum: 0,
        maximum: 2,
      });
    }
  }

  if (role.identity !== undefined) {
    const markers = new Set<string>();
    for (const [index, marker] of role.identity.entries()) {
      const path = `role.identity[${index}]`;
      if (marker.marker.trim() === '') throw new TypeError(`${path}.marker must not be empty`);
      if (markers.has(marker.marker)) throw new TypeError(`${path}.marker must be unique`);
      markers.add(marker.marker);
      validateRange(marker.centrality, `${path}.centrality`, { minimum: 0, maximum: 1 });
    }
  }
  if (role.outletPreferences !== undefined) {
    if (role.outletPreferences.length === 0) {
      throw new TypeError('role.outletPreferences must contain at least one operation');
    }
    const operations = new Set<OutletOperation>();
    for (const [index, preference] of role.outletPreferences.entries()) {
      const path = `role.outletPreferences[${index}]`;
      if (operations.has(preference.operation)) {
        throw new TypeError(`${path}.operation must be unique`);
      }
      operations.add(preference.operation);
      validateRange(preference.rank, `${path}.rank`, { minimum: 0, maximum: 1 });
    }
  }
}

function applyNumericRanges(
  profile: CharacterDefinition,
  role: CharacterRoleBundle,
  sampler: GenerationSampler,
): void {
  for (const capabilityId of CAPABILITY_IDS) {
    const range = role.ranges.capabilities?.[capabilityId];
    if (range !== undefined) {
      profile.capabilities[capabilityId] = sampler.number(
        `role.${role.id}.capabilities.${capabilityId}`,
        range,
      ).value;
    }
  }
  for (const position of CASCADE_POSITIONS) {
    const range = role.ranges.cascadePriors?.[position];
    if (range !== undefined) {
      profile.cascadePriors[position] = sampler.number(
        `role.${role.id}.cascadePriors.${position}`,
        range,
      ).value;
    }
  }
  for (const field of CONSTITUTION_FIELDS) {
    const range = role.ranges.constitution?.[field];
    if (range !== undefined) {
      profile.constitution[field] = sampler.number(
        `role.${role.id}.constitution.${field}`,
        range,
      ).value;
    }
  }
  if (role.ranges.contractAdherence !== undefined) {
    profile.contractAdherence = sampler.number(
      `role.${role.id}.contractAdherence`,
      role.ranges.contractAdherence,
    ).value;
  }
  if (role.ranges.comeliness !== undefined) {
    profile.physical.comeliness = sampler.number(
      `role.${role.id}.physical.comeliness`,
      role.ranges.comeliness,
    ).value;
  }
  for (const field of DISCLOSURE_FIELDS) {
    const range = role.ranges.disclosure?.[field];
    if (range !== undefined) {
      profile.disclosure[field] = sampler.number(
        `role.${role.id}.disclosure.${field}`,
        range,
      ).value;
    }
  }
  for (const field of EMPATHY_FIELDS) {
    const range = role.ranges.empathy?.[field];
    if (range !== undefined) {
      profile.empathy[field] = sampler.number(`role.${role.id}.empathy.${field}`, range).value;
    }
  }
  for (const featureId of SOCIAL_FEATURE_IDS) {
    const range = role.ranges.empathy?.featureWeights?.[featureId];
    if (range !== undefined) {
      profile.empathy.featureWeights[featureId] = sampler.number(
        `role.${role.id}.empathy.featureWeights.${featureId}`,
        range,
      ).value;
    }
  }
  for (const valueId of VALUE_IDS) {
    const range = role.ranges.valueWeights?.[valueId];
    if (range !== undefined) {
      profile.values[valueId].weight = sampler.number(
        `role.${role.id}.values.${valueId}.weight`,
        range,
      ).value;
    }
  }
}

function weightedTemplate(
  role: CharacterRoleBundle,
  sampler: GenerationSampler,
  eventDrawIndex: number,
): { draw: RealizedGenerationDraw; template: RoleFormativeEventTemplate } {
  const totalWeight = role.formativeEventPool.reduce((total, item) => total + item.weight, 0);
  const draw = sampler.number(`role.${role.id}.formativeEvents[${eventDrawIndex}].template`, {
    minimum: 0,
    maximum: totalWeight,
  });
  let cumulative = 0;
  for (const template of role.formativeEventPool) {
    cumulative += template.weight;
    if (draw.value < cumulative) return { draw, template };
  }
  const template = role.formativeEventPool.at(-1);
  if (template === undefined) throw new TypeError('formative event pool must not be empty');
  return { draw, template };
}

function generateFormativeEvents(
  role: CharacterRoleBundle,
  sampler: GenerationSampler,
): Array<{
  event: FormativeEvent;
  selectionDrawPosition: number;
  templateId: string;
}> {
  const eventCount = sampler.integer(
    `role.${role.id}.formativeEventCount`,
    role.formativeEventCount,
  ).value;
  const events = [];
  for (let index = 0; index < eventCount; index += 1) {
    const { draw, template } = weightedTemplate(role, sampler, index);
    events.push({
      event: {
        age: sampler.integer(
          `role.${role.id}.formativeEvents[${index}].${template.id}.age`,
          template.age,
        ).value,
        attribution: template.attribution,
        copingPotential: sampler.number(
          `role.${role.id}.formativeEvents[${index}].${template.id}.copingPotential`,
          template.copingPotential,
        ).value,
        summary: template.summary,
        turn: sampler.number(
          `role.${role.id}.formativeEvents[${index}].${template.id}.turn`,
          template.turn,
        ).value,
        value: template.value,
      },
      selectionDrawPosition: draw.position,
      templateId: template.id,
    });
  }
  return events.sort(
    (left, right) =>
      left.event.age - right.event.age || left.selectionDrawPosition - right.selectionDrawPosition,
  );
}

function generatedResource(
  request: CharacterGenerationRequest,
  sampler: GenerationSampler,
): {
  eventProvenance: GeneratedFormativeEventProvenance[];
  resource: CharacterProfileResourceFile;
} {
  validateRole(request.role, request.profile.physical.ageYears);
  const profile = clone(request.profile);
  profile.role = request.role.label;
  applyNumericRanges(profile, request.role, sampler);
  if (request.role.identity !== undefined) {
    profile.identity = request.role.identity.map(
      (item, index): IdentityMarker => ({
        centrality: sampler.number(
          `role.${request.role.id}.identity[${index}].centrality`,
          item.centrality,
        ).value,
        marker: item.marker,
      }),
    );
  }
  if (request.role.outletPreferences !== undefined) {
    profile.outletPreferences = request.role.outletPreferences.map((item, index) => ({
      operation: item.operation,
      rank: sampler.number(`role.${request.role.id}.outletPreferences[${index}].rank`, item.rank)
        .value,
    }));
  }
  if (request.role.satisfierPreferences !== undefined) {
    profile.satisfierPreferences = clone(request.role.satisfierPreferences);
  }
  const generatedEvents = generateFormativeEvents(request.role, sampler);
  profile.formativeEvents = generatedEvents.map(item => item.event);

  const parsed = parseResourceFile(
    {
      address: {
        kind: 'character-profile',
        packageId: request.packageId,
        resourceId: profile.profileId,
      },
      profile,
      schemaVersion: 1,
    },
    `generated:${profile.profileId}`,
  );
  if (parsed.address.kind !== 'character-profile') {
    throw new TypeError('generated character resource did not retain its resource kind');
  }
  const resource = parsed as CharacterProfileResourceFile;
  const initialized = initializeHistoryDerivedState(resource.profile);
  const eventProvenance = generatedEvents.map((generated, eventIndex) => {
    const record = initialized.history.formativeRecords[eventIndex];
    const memory = initialized.memories[eventIndex];
    if (record === undefined || memory === undefined) {
      throw new TypeError('generated formative event did not cross the history boundary');
    }
    return {
      dispositionEventId: record.eventId,
      event: clone(generated.event),
      eventIndex,
      memoryId: memory.id,
      selectionDrawPosition: generated.selectionDrawPosition,
      templateId: generated.templateId,
    };
  });
  return { eventProvenance, resource };
}

function generateWithSampler(
  request: CharacterGenerationRequest,
  sampler: GenerationSampler,
): GeneratedCharacterProfile {
  const samplerStart = sampler.position;
  const drawStart = sampler.draws.length;
  const { eventProvenance, resource } = generatedResource(request, sampler);
  return deepFreeze({
    generation: {
      algorithm: GENERATOR_ALGORITHM,
      draws: clone(sampler.draws.slice(drawStart)),
      formativeEvents: eventProvenance,
      roleBundleId: request.role.id,
      samplerEnd: sampler.position,
      samplerStart,
      seed: sampler.seed,
    },
    resource,
  });
}

export function generateCharacterProfile(
  request: CharacterGenerationRequest & { samplerPosition?: number; seed: number },
): GeneratedCharacterProfile {
  validateSeed(request.seed);
  const samplerPosition = request.samplerPosition ?? 0;
  validateSamplerPosition(samplerPosition);
  return generateWithSampler(request, new GenerationSampler(request.seed, samplerPosition));
}

function behaviorVector(profile: CharacterDefinition): number[] {
  return [
    ...CAPABILITY_IDS.map(id => profile.capabilities[id]),
    ...CASCADE_POSITIONS.map(position => profile.cascadePriors[position]),
    profile.constitution.baselineArousal,
    profile.constitution.habituationRate,
    profile.constitution.reactivity,
    profile.constitution.recoveryRate,
    (profile.constitution.socialValence + 1) / 2,
    profile.constitution.threshold,
    profile.contractAdherence,
    profile.disclosure.intimateSafety,
    profile.disclosure.strangerSafety,
    profile.disclosure.troughDepth,
    profile.disclosure.troughPosition,
    profile.disclosure.troughWidth,
    profile.empathy.ceiling,
    profile.empathy.floor,
    profile.empathy.selfPosition,
    profile.empathy.steepness / 12,
    profile.empathy.threatSensitivity,
    ...SOCIAL_FEATURE_IDS.map(id => profile.empathy.featureWeights[id] / 4),
    ...VALUE_IDS.map(id => profile.values[id].weight / 2),
    ...OUTLET_OPERATIONS.map(
      operation => profile.outletPreferences.find(item => item.operation === operation)?.rank ?? 0,
    ),
  ];
}

export function characterBehaviorDistance(
  left: CharacterDefinition,
  right: CharacterDefinition,
): number {
  const leftVector = behaviorVector(left);
  const rightVector = behaviorVector(right);
  const squaredDistance = leftVector.reduce((total, value, index) => {
    const difference = value - (rightVector[index] ?? 0);
    return total + difference * difference;
  }, 0);
  return Math.sqrt(squaredDistance / leftVector.length);
}

export function generateCharacterCohort(
  request: CohortGenerationRequest,
): GeneratedCharacterCohort {
  validateSeed(request.seed);
  const samplerStart = request.samplerPosition ?? 0;
  validateSamplerPosition(samplerStart);
  if (
    !Number.isFinite(request.minimumSeparation) ||
    request.minimumSeparation < 0 ||
    request.minimumSeparation > 1
  ) {
    throw new RangeError('minimumSeparation must be from 0 through 1');
  }
  const maximumAttempts = request.maximumAttemptsPerMember ?? 128;
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new RangeError('maximumAttemptsPerMember must be a positive integer');
  }
  const profileIds = new Set<string>();
  for (const [index, member] of request.members.entries()) {
    const profileId = member.profile.profileId;
    if (profileIds.has(profileId)) {
      throw new TypeError(`members[${index}].profile.profileId must be unique`);
    }
    profileIds.add(profileId);
  }

  const sampler = new GenerationSampler(request.seed, samplerStart);
  const profiles: GeneratedCharacterProfile[] = [];
  const attempts: CohortGenerationAttempt[] = [];
  for (const member of request.members) {
    let accepted: GeneratedCharacterProfile | null = null;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      const candidate = generateWithSampler(member, sampler);
      const distances = profiles.map(existing =>
        characterBehaviorDistance(existing.resource.profile, candidate.resource.profile),
      );
      const nearestDistance = distances.length === 0 ? null : Math.min(...distances);
      const isAccepted = nearestDistance === null || nearestDistance >= request.minimumSeparation;
      attempts.push({
        accepted: isAccepted,
        attempt,
        draws: clone(candidate.generation.draws),
        nearestDistance,
        profileId: member.profile.profileId,
        samplerEnd: candidate.generation.samplerEnd,
        samplerStart: candidate.generation.samplerStart,
      });
      if (isAccepted) {
        accepted = candidate;
        profiles.push(candidate);
        break;
      }
    }
    if (accepted === null) {
      throw new RangeError(
        `could not separate generated profile "${member.profile.profileId}" by ${request.minimumSeparation} within ${maximumAttempts} attempts`,
      );
    }
  }

  return deepFreeze({
    attempts,
    minimumSeparation: request.minimumSeparation,
    profiles,
    samplerEnd: sampler.position,
    samplerStart,
    seed: request.seed,
  });
}
