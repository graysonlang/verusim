import { clamp } from '../model/retention.js';
import type {
  CharacterProfileResourceFile,
  DyadSeed,
  FormativeEvent,
  SocialFeatureMap,
  ValueId,
} from '../model/types.js';
import { parseResourceFile } from '../scenario/parse.js';
import { initializeHistoryDerivedState } from '../simulation/history.js';
import { resolveDyadMode } from '../simulation/relationship.js';
import {
  GenerationSampler,
  cloneGenerated,
  freezeGenerated,
  validateGenerationRange,
  validateGenerationSeed,
  validateSamplerPosition,
  type IntegerGenerationRange,
  type NumericGenerationRange,
  type RealizedGenerationDraw,
} from './sampler.js';

const RECENT_HISTORY_ALGORITHM = 'verusim-recent-history-v1' as const;
const PRECONTACT_ALGORITHM = 'verusim-precontact-v1' as const;

export interface CohortContextMember {
  instanceId: string;
  resource: CharacterProfileResourceFile;
}

export interface RecentFormativeEventTemplate {
  attribution: string | null;
  copingPotential: NumericGenerationRange;
  id: string;
  summary: string;
  turn: NumericGenerationRange;
  value: ValueId;
  weight: number;
}

export interface RecentCohortHistoryRequest {
  eventPool: RecentFormativeEventTemplate[];
  horizonYears: number;
  members: CohortContextMember[];
  samplerPosition?: number;
  seed: number;
}

export interface RecentCohortEventProvenance {
  age: number;
  dispositionEventId: string;
  eventIndex: number;
  instanceId: string;
  memoryId: string;
  stratum: number;
  templateId: string;
  yearsBeforeCurrentAge: number;
}

export interface GeneratedRecentCohortHistory {
  algorithm: typeof RECENT_HISTORY_ALGORITHM;
  draws: RealizedGenerationDraw[];
  events: RecentCohortEventProvenance[];
  profiles: CharacterProfileResourceFile[];
  samplerEnd: number;
  samplerStart: number;
  seed: number;
}

export type PrecontactKind = 'community' | 'household' | 'occupation';

export interface PrecontactSeedInput {
  behaviorVariance: NumericGenerationRange;
  category: NumericGenerationRange;
  encountersPerYear: number;
  exposureDebt: NumericGenerationRange;
  kind: PrecontactKind;
  observerId: string;
  reciprocity: NumericGenerationRange;
  similarity: NumericGenerationRange;
  stance: NumericGenerationRange;
  subjectId: string;
  validatorClaimIds: string[];
  yearsKnown: number;
}

export interface PrecontactGenerationRequest {
  contacts: PrecontactSeedInput[];
  members: CohortContextMember[];
  samplerPosition?: number;
  seed: number;
}

export interface PrecontactDyadProvenance {
  contactIndex: number;
  estimatedDisclosureSignal: number;
  estimatedEmpathySignal: number;
  estimateConfidence: number;
  kind: PrecontactKind;
  observationCount: number;
  observerId: string;
  subjectId: string;
}

export interface GeneratedPrecontactDyads {
  algorithm: typeof PRECONTACT_ALGORITHM;
  draws: RealizedGenerationDraw[];
  dyads: DyadSeed[];
  provenance: PrecontactDyadProvenance[];
  samplerEnd: number;
  samplerStart: number;
  seed: number;
}

function validateIdentifier(value: string, path: string): void {
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value)) {
    throw new TypeError(`${path} must be a lowercase semantic identifier`);
  }
}

function weightedRecentTemplate(
  request: RecentCohortHistoryRequest,
  sampler: GenerationSampler,
  memberIndex: number,
): RecentFormativeEventTemplate {
  const totalWeight = request.eventPool.reduce((total, item) => total + item.weight, 0);
  const draw = sampler.number(`recentHistory.members[${memberIndex}].template`, {
    minimum: 0,
    maximum: totalWeight,
  });
  let cumulative = 0;
  for (const template of request.eventPool) {
    cumulative += template.weight;
    if (draw.value < cumulative) return template;
  }
  const template = request.eventPool.at(-1);
  if (template === undefined) throw new TypeError('recent event pool must not be empty');
  return template;
}

function validateRecentRequest(request: RecentCohortHistoryRequest): void {
  if (request.members.length === 0) throw new TypeError('members must not be empty');
  if (!Number.isInteger(request.horizonYears) || request.horizonYears < request.members.length) {
    throw new RangeError('horizonYears must be an integer at least as large as the cohort');
  }
  const instanceIds = new Set<string>();
  for (const [index, member] of request.members.entries()) {
    validateIdentifier(member.instanceId, `members[${index}].instanceId`);
    if (instanceIds.has(member.instanceId)) {
      throw new TypeError(`members[${index}].instanceId must be unique`);
    }
    instanceIds.add(member.instanceId);
    if (member.resource.address.kind !== 'character-profile') {
      throw new TypeError(`members[${index}].resource must be a character profile`);
    }
    if (member.resource.profile.physical.ageYears < request.horizonYears) {
      throw new RangeError(`members[${index}] must be at least horizonYears old`);
    }
  }
  if (request.eventPool.length === 0) throw new TypeError('eventPool must not be empty');
  const templateIds = new Set<string>();
  for (const [index, template] of request.eventPool.entries()) {
    const path = `eventPool[${index}]`;
    validateIdentifier(template.id, `${path}.id`);
    if (templateIds.has(template.id)) throw new TypeError(`${path}.id must be unique`);
    templateIds.add(template.id);
    if (!(template.weight > 0) || !Number.isFinite(template.weight)) {
      throw new RangeError(`${path}.weight must be a positive finite number`);
    }
    if (template.summary.trim() === '') throw new TypeError(`${path}.summary must not be empty`);
    validateGenerationRange(template.turn, `${path}.turn`, { minimum: -1, maximum: 1 });
    validateGenerationRange(template.copingPotential, `${path}.copingPotential`, {
      minimum: 0,
      maximum: 1,
    });
  }
}

function shuffledStrata(memberCount: number, sampler: GenerationSampler): number[] {
  const strata = Array.from({ length: memberCount }, (_, index) => index);
  for (let end = strata.length - 1; end > 0; end -= 1) {
    const draw = sampler.integer(`recentHistory.strata[${end}]`, {
      minimum: 0,
      maximum: end,
    });
    const selected = draw.value;
    const previous = strata[selected];
    strata[selected] = strata[end] ?? selected;
    strata[end] = previous ?? end;
  }
  return strata;
}

function yearsRangeForStratum(
  stratum: number,
  memberCount: number,
  horizonYears: number,
): IntegerGenerationRange {
  return {
    maximum: Math.floor(((stratum + 1) * horizonYears) / memberCount),
    minimum: Math.floor((stratum * horizonYears) / memberCount) + 1,
  };
}

export function generateRecentCohortHistory(
  request: RecentCohortHistoryRequest,
): GeneratedRecentCohortHistory {
  validateGenerationSeed(request.seed);
  const samplerStart = request.samplerPosition ?? 0;
  validateSamplerPosition(samplerStart);
  validateRecentRequest(request);
  const sampler = new GenerationSampler(request.seed, samplerStart);
  const strata = shuffledStrata(request.members.length, sampler);
  const events: RecentCohortEventProvenance[] = [];
  const profiles = request.members.map((member, memberIndex) => {
    const stratum = strata[memberIndex];
    if (stratum === undefined) throw new TypeError('recent history stratum was not assigned');
    const yearsBeforeCurrentAge = sampler.integer(
      `recentHistory.members[${memberIndex}].yearsBeforeCurrentAge`,
      yearsRangeForStratum(stratum, request.members.length, request.horizonYears),
    ).value;
    const template = weightedRecentTemplate(request, sampler, memberIndex);
    const event: FormativeEvent = {
      age: member.resource.profile.physical.ageYears - yearsBeforeCurrentAge,
      attribution: template.attribution,
      copingPotential: sampler.number(
        `recentHistory.members[${memberIndex}].${template.id}.copingPotential`,
        template.copingPotential,
      ).value,
      summary: template.summary,
      turn: sampler.number(
        `recentHistory.members[${memberIndex}].${template.id}.turn`,
        template.turn,
      ).value,
      value: template.value,
    };
    const ordered = [
      ...member.resource.profile.formativeEvents.map((existing, originalIndex) => ({
        event: cloneGenerated(existing),
        generated: false,
        originalIndex,
      })),
      { event, generated: true, originalIndex: member.resource.profile.formativeEvents.length },
    ].sort(
      (left, right) => left.event.age - right.event.age || left.originalIndex - right.originalIndex,
    );
    const eventIndex = ordered.findIndex(item => item.generated);
    const profile = {
      ...cloneGenerated(member.resource.profile),
      formativeEvents: ordered.map(item => item.event),
    };
    const parsed = parseResourceFile(
      {
        address: cloneGenerated(member.resource.address),
        profile,
        schemaVersion: 1,
      },
      `generated-recent-history:${profile.profileId}`,
    );
    if (parsed.address.kind !== 'character-profile') {
      throw new TypeError('recent history output did not retain its character resource kind');
    }
    const resource = parsed as CharacterProfileResourceFile;
    const initialized = initializeHistoryDerivedState(resource.profile);
    const record = initialized.history.formativeRecords[eventIndex];
    const memory = initialized.memories[eventIndex];
    if (record === undefined || memory === undefined) {
      throw new TypeError('recent formative event did not cross the history boundary');
    }
    events.push({
      age: event.age,
      dispositionEventId: record.eventId,
      eventIndex,
      instanceId: member.instanceId,
      memoryId: memory.id,
      stratum,
      templateId: template.id,
      yearsBeforeCurrentAge,
    });
    return resource;
  });

  return freezeGenerated({
    algorithm: RECENT_HISTORY_ALGORITHM,
    draws: cloneGenerated(sampler.draws),
    events,
    profiles,
    samplerEnd: sampler.position,
    samplerStart,
    seed: request.seed,
  });
}

function featureRangesFor(kind: PrecontactKind): {
  familiarity: NumericGenerationRange;
  kinship: NumericGenerationRange;
} {
  if (kind === 'household') {
    return {
      familiarity: { minimum: 0.82, maximum: 1 },
      kinship: { minimum: 0.85, maximum: 1 },
    };
  }
  if (kind === 'occupation') {
    return {
      familiarity: { minimum: 0.42, maximum: 0.9 },
      kinship: { minimum: 0, maximum: 0.24 },
    };
  }
  return {
    familiarity: { minimum: 0.18, maximum: 0.74 },
    kinship: { minimum: 0, maximum: 0.16 },
  };
}

function validatePrecontactRequest(
  request: PrecontactGenerationRequest,
): Map<string, CohortContextMember> {
  const members = new Map<string, CohortContextMember>();
  for (const [index, member] of request.members.entries()) {
    validateIdentifier(member.instanceId, `members[${index}].instanceId`);
    if (members.has(member.instanceId)) {
      throw new TypeError(`members[${index}].instanceId must be unique`);
    }
    members.set(member.instanceId, member);
  }
  const directedPairs = new Set<string>();
  for (const [index, contact] of request.contacts.entries()) {
    const path = `contacts[${index}]`;
    if (!members.has(contact.observerId))
      throw new TypeError(`${path}.observerId must name a member`);
    if (!members.has(contact.subjectId))
      throw new TypeError(`${path}.subjectId must name a member`);
    if (contact.observerId === contact.subjectId) {
      throw new TypeError(`${path} must connect two different members`);
    }
    const key = `${contact.observerId}:${contact.subjectId}`;
    if (directedPairs.has(key)) throw new TypeError(`${path} duplicates a directed contact`);
    directedPairs.add(key);
    if (!Number.isFinite(contact.yearsKnown) || contact.yearsKnown < 0) {
      throw new RangeError(`${path}.yearsKnown must be a nonnegative finite number`);
    }
    if (!Number.isFinite(contact.encountersPerYear) || contact.encountersPerYear < 0) {
      throw new RangeError(`${path}.encountersPerYear must be a nonnegative finite number`);
    }
    if (contact.kind === 'household' && contact.encountersPerYear < 300) {
      throw new RangeError(`${path}.encountersPerYear must express daily household cadence`);
    }
    for (const field of [
      'behaviorVariance',
      'category',
      'exposureDebt',
      'reciprocity',
      'similarity',
    ] as const) {
      validateGenerationRange(contact[field], `${path}.${field}`, { minimum: 0, maximum: 1 });
    }
    validateGenerationRange(contact.stance, `${path}.stance`, { minimum: -1, maximum: 1 });
  }
  return members;
}

function estimatedSignals(member: CohortContextMember): {
  disclosure: number;
  empathy: number;
} {
  const profile = member.resource.profile;
  return {
    disclosure: clamp(
      (profile.disclosure.intimateSafety +
        profile.disclosure.strangerSafety -
        profile.disclosure.troughDepth) /
        2,
      0,
      1,
    ),
    empathy: clamp((profile.empathy.floor + profile.empathy.ceiling) / 2, 0, 1),
  };
}

export function generatePrecontactDyads(
  request: PrecontactGenerationRequest,
): GeneratedPrecontactDyads {
  validateGenerationSeed(request.seed);
  const samplerStart = request.samplerPosition ?? 0;
  validateSamplerPosition(samplerStart);
  const members = validatePrecontactRequest(request);
  const sampler = new GenerationSampler(request.seed, samplerStart);
  const provenance: PrecontactDyadProvenance[] = [];
  const dyads = request.contacts.map((contact, contactIndex) => {
    const observer = members.get(contact.observerId);
    const subject = members.get(contact.subjectId);
    if (observer === undefined || subject === undefined) {
      throw new TypeError('validated precontact member was not available');
    }
    const knownYears = Math.min(
      contact.yearsKnown,
      observer.resource.profile.physical.ageYears,
      subject.resource.profile.physical.ageYears,
    );
    const observationCount = Math.floor(knownYears * contact.encountersPerYear);
    const calibration = observer.resource.profile.capabilities.evidenceCalibration;
    const estimateConfidence = clamp(
      0.1 + (1 - Math.exp(-observationCount / 80)) * (0.62 + calibration * 0.23),
      0.1,
      0.95,
    );
    const subjectSignals = estimatedSignals(subject);
    const estimateErrorScale = (1 - estimateConfidence) * 0.55;
    const estimatedEmpathy = clamp(
      subjectSignals.empathy +
        sampler.number(`precontact[${contactIndex}].estimatedEmpathyError`, {
          minimum: -estimateErrorScale,
          maximum: estimateErrorScale,
        }).value,
      0,
      1,
    );
    const estimatedDisclosure = clamp(
      subjectSignals.disclosure +
        sampler.number(`precontact[${contactIndex}].estimatedDisclosureError`, {
          minimum: -estimateErrorScale,
          maximum: estimateErrorScale,
        }).value,
      0,
      1,
    );
    const fixedFeatureRanges = featureRangesFor(contact.kind);
    const features: SocialFeatureMap = {
      category: sampler.number(`precontact[${contactIndex}].features.category`, contact.category)
        .value,
      familiarity: sampler.number(
        `precontact[${contactIndex}].features.familiarity`,
        fixedFeatureRanges.familiarity,
      ).value,
      kinship: sampler.number(
        `precontact[${contactIndex}].features.kinship`,
        fixedFeatureRanges.kinship,
      ).value,
      reciprocity: sampler.number(
        `precontact[${contactIndex}].features.reciprocity`,
        contact.reciprocity,
      ).value,
      similarity: sampler.number(
        `precontact[${contactIndex}].features.similarity`,
        contact.similarity,
      ).value,
    };
    const stance = sampler.number(`precontact[${contactIndex}].stance`, contact.stance).value;
    const base: DyadSeed = {
      behaviorVariance: sampler.number(
        `precontact[${contactIndex}].behaviorVariance`,
        contact.behaviorVariance,
      ).value,
      estimateConfidence,
      estimatedDisclosure,
      estimatedEmpathy,
      exposureDebt: sampler.number(`precontact[${contactIndex}].exposureDebt`, contact.exposureDebt)
        .value,
      features,
      integratedHistory: clamp(stance * Math.min(1, knownYears / 10), -1, 1),
      mode: 'courteous',
      observerId: contact.observerId,
      predictionError: 0,
      stance,
      subjectId: contact.subjectId,
      suspicion: clamp(Math.max(0, -stance) * (1 - estimateConfidence) * 0.4, 0, 1),
      validatorClaimIds: [...contact.validatorClaimIds],
    };
    const dyad = { ...base, mode: resolveDyadMode(base) };
    provenance.push({
      contactIndex,
      estimatedDisclosureSignal: subjectSignals.disclosure,
      estimatedEmpathySignal: subjectSignals.empathy,
      estimateConfidence,
      kind: contact.kind,
      observationCount,
      observerId: contact.observerId,
      subjectId: contact.subjectId,
    });
    return dyad;
  });

  return freezeGenerated({
    algorithm: PRECONTACT_ALGORITHM,
    draws: cloneGenerated(sampler.draws),
    dyads,
    provenance,
    samplerEnd: sampler.position,
    samplerStart,
    seed: sampler.seed,
  });
}
