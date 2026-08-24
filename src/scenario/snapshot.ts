import {
  OUTLET_OPERATIONS,
  SOCIAL_FEATURE_IDS,
  VALUE_IDS,
  type RecoveryMode,
  type ResourceAddress,
  type SimulationSnapshotFile,
} from '../model/types.js';
import { ScenarioValidationError } from '../model/validation.js';
import { parseResourceAddress, parseScenario, resourceAddressKey } from './parse.js';
import {
  arrayValue,
  clone,
  integerValue,
  legacyRecoveryMode,
  numberValue,
  objectValue,
  stringValue,
  validateLayerPosition,
} from './primitives.js';

const CASCADE_POSITIONS = new Set(['none', 'freeze', 'fight', 'flight', 'fawn', 'flop']);
const BASELINE_PLASTICITY_MECHANISMS = new Set([
  'outlet-promotion',
  'rewarded-masking',
  'rupture-crystallization',
]);
const BASELINE_PLASTICITY_TARGET_KINDS = new Set(['cascade-prior', 'identity-marker']);
const MEMORY_TYPES = new Set([
  'activity',
  'aftermath',
  'disclosure',
  'formative',
  'goal',
  'intervention',
  'narrative',
  'relationship',
  'task',
]);
const TRACE_KINDS = new Set([
  'activity',
  'aftermath',
  'agenda',
  'appraisal',
  'cascade',
  'decision',
  'disclosure-appraisal',
  'disclosure-decision',
  'display-appraisal',
  'gate',
  'goal',
  'incident-appraisal',
  'intervention',
  'intention',
  'norm-appraisal',
  'narrative',
  'observation',
  'outlet',
  'prediction',
  'reputation',
  'relationship',
  'resource',
  'scenario',
  'somatic',
  'task',
  'value-turn',
]);
const RECOVERY_MODES = new Set<RecoveryMode>(['break', 'none', 'rest', 'sleep']);
const TRACE_SELECTION_RULES = new Set([
  'highest-score-then-authored-order',
  'highest-utility-then-authored-order',
  'positive-utility',
  'preempt-gate',
]);
const GOAL_STATUSES = new Set(['active', 'blocked', 'completed', 'failed', 'pending']);
const INTENTION_PHASES = new Set(['travel', 'waiting', 'work']);
const CAPABILITY_BANDS = new Set([
  'strong-yes',
  'weak-yes',
  'so-so',
  'weak-no',
  'strong-no',
  'strike',
  'pass',
]);
const OBSERVATION_CHANNELS = new Set(['hearing', 'sight']);
const OBSERVATION_DIMENSIONS = new Set(['disclosure', 'empathy']);
const OBSERVATION_OUTCOMES = new Set(['confirmed', 'corrected', 'missed', 'suspected']);
const NORM_OBSERVATION_OUTCOMES = new Set(['appraised', 'missed']);
const DISPLAY_RESPONSES = new Set(['admiration', 'disdain', 'envy', 'indifference', 'missed']);
const SOMATIC_CADENCES = new Set(['fluctuating', 'steady']);
const SOMATIC_ORIGINS = new Set(['activity', 'environment', 'event']);
const SOMATIC_PREEMPTIONS = new Set(['dead', 'emergency', 'incapacitated', 'none']);
const SOMATIC_RESPONSES = new Set(['concern', 'freeze', 'help', 'ignore', 'leave']);
const OUTLET_OPERATION_SET = new Set<string>(OUTLET_OPERATIONS);
const NARRATIVE_DISPOSITIONS = new Set([
  'accepted',
  'confirmed',
  'fishing',
  'genuine',
  'preemptive-shame',
  'reinterpreted',
  'resisted',
  'revised',
  'status-lowering',
  'wore-in',
]);

function validateValueState(value: unknown, path: string): void {
  const state = objectValue(value, path);
  numberValue(state.charge, `${path}.charge`, -1, 1);
  numberValue(state.deficitIntegral, `${path}.deficitIntegral`, 0, 1);
  numberValue(state.variance, `${path}.variance`, 0, 1);
}

function validateResourceMap(value: unknown, path: string): void {
  const resources = objectValue(value, path);
  for (const [resourceId, amount] of Object.entries(resources)) {
    if (
      !['executiveBudget', 'physicalStamina', 'regulationReserve', 'socialBattery'].includes(
        resourceId,
      )
    ) {
      throw new ScenarioValidationError(`${path}.${resourceId}`, 'unknown resource');
    }
    numberValue(amount, `${path}.${resourceId}`, 0, 1);
  }
}

function validateSomaticSource(value: unknown, path: string): string {
  const source = objectValue(value, path);
  const id = stringValue(source.id, `${path}.id`);
  stringValue(source.label, `${path}.label`);
  for (const field of [
    'attentionTax',
    'copingPotential',
    'impairment',
    'pain',
    'perceivedUrgency',
    'visible',
  ]) {
    numberValue(source[field], `${path}.${field}`, 0, 1);
  }
  if (typeof source.cadence !== 'string' || !SOMATIC_CADENCES.has(source.cadence)) {
    throw new ScenarioValidationError(`${path}.cadence`, 'expected fluctuating or steady');
  }
  if (typeof source.origin !== 'string' || !SOMATIC_ORIGINS.has(source.origin)) {
    throw new ScenarioValidationError(`${path}.origin`, 'expected activity, environment, or event');
  }
  if (typeof source.preemption !== 'string' || !SOMATIC_PREEMPTIONS.has(source.preemption)) {
    throw new ScenarioValidationError(`${path}.preemption`, 'expected a known preemption');
  }
  return id;
}

function validateSomaticState(value: unknown, path: string): void {
  const state = objectValue(value, path);
  for (const field of [
    'attentionTax',
    'impairment',
    'pain',
    'perceivedUrgency',
    'threatContribution',
  ]) {
    numberValue(state[field], `${path}.${field}`, 0, 1);
  }
  const level = integerValue(state.level, `${path}.level`, 0);
  if (level > 5) {
    throw new ScenarioValidationError(`${path}.level`, 'expected an integer from 0 through 5');
  }
  const sourceIds = new Set<string>();
  arrayValue(state.sources, `${path}.sources`).forEach((value, index) => {
    const sourcePath = `${path}.sources[${index}]`;
    const source = objectValue(value, sourcePath);
    const id = validateSomaticSource(source, sourcePath);
    if (sourceIds.has(id)) {
      throw new ScenarioValidationError(`${sourcePath}.id`, 'duplicate somatic source');
    }
    sourceIds.add(id);
    numberValue(source.habituation, `${sourcePath}.habituation`, 0, 1);
  });
}

function validateMaskingDemand(value: unknown, path: string): void {
  if (value === null) return;
  const demand = objectValue(value, path);
  numberValue(demand.presentationGap, `${path}.presentationGap`, 0, 1);
  numberValue(demand.exposureRisk, `${path}.exposureRisk`, 0, 1);
  integerValue(demand.audienceCount, `${path}.audienceCount`, 0);
  if (typeof demand.fabricated !== 'boolean') {
    throw new ScenarioValidationError(`${path}.fabricated`, 'expected a boolean');
  }
}

function validateHistoryOverrides(value: unknown, path: string): void {
  const overrides = objectValue(value, path);
  if (overrides.cascadePriors !== undefined) {
    const priors = objectValue(overrides.cascadePriors, `${path}.cascadePriors`);
    for (const [position, prior] of Object.entries(priors)) {
      if (!['freeze', 'fight', 'flight', 'fawn', 'flop'].includes(position)) {
        throw new ScenarioValidationError(`${path}.cascadePriors.${position}`, 'unknown cascade');
      }
      numberValue(prior, `${path}.cascadePriors.${position}`, 0, 1);
    }
  }
  if (overrides.contractAdherence !== undefined) {
    numberValue(overrides.contractAdherence, `${path}.contractAdherence`, 0, 1);
  }
  if (overrides.disclosure !== undefined) {
    const disclosure = objectValue(overrides.disclosure, `${path}.disclosure`);
    for (const [field, amount] of Object.entries(disclosure)) {
      if (
        ![
          'intimateSafety',
          'strangerSafety',
          'troughDepth',
          'troughPosition',
          'troughWidth',
        ].includes(field)
      ) {
        throw new ScenarioValidationError(`${path}.disclosure.${field}`, 'unknown field');
      }
      numberValue(amount, `${path}.disclosure.${field}`, field === 'troughWidth' ? 0.01 : 0, 1);
    }
  }
  if (overrides.empathy !== undefined) {
    const empathy = objectValue(overrides.empathy, `${path}.empathy`);
    for (const [field, amount] of Object.entries(empathy)) {
      if (field === 'featureWeights') {
        const weights = objectValue(amount, `${path}.empathy.featureWeights`);
        for (const [featureId, weight] of Object.entries(weights)) {
          if (!(SOCIAL_FEATURE_IDS as readonly string[]).includes(featureId)) {
            throw new ScenarioValidationError(
              `${path}.empathy.featureWeights.${featureId}`,
              'unknown social feature',
            );
          }
          numberValue(weight, `${path}.empathy.featureWeights.${featureId}`, 0, 4);
        }
        continue;
      }
      if (!['ceiling', 'floor', 'selfPosition', 'steepness', 'threatSensitivity'].includes(field)) {
        throw new ScenarioValidationError(`${path}.empathy.${field}`, 'unknown field');
      }
      numberValue(
        amount,
        `${path}.empathy.${field}`,
        field === 'steepness' ? 0.01 : 0,
        field === 'steepness' ? 12 : 1,
      );
    }
  }
  if (overrides.identity !== undefined) {
    arrayValue(overrides.identity, `${path}.identity`).forEach((entryValue, index) => {
      const entryPath = `${path}.identity[${index}]`;
      const entry = objectValue(entryValue, entryPath);
      stringValue(entry.marker, `${entryPath}.marker`);
      numberValue(entry.centrality, `${entryPath}.centrality`, 0, 1);
    });
  }
  if (overrides.normInternalizations !== undefined) {
    const internalizations = objectValue(
      overrides.normInternalizations,
      `${path}.normInternalizations`,
    );
    for (const [key, amount] of Object.entries(internalizations)) {
      stringValue(key, `${path}.normInternalizations`);
      numberValue(amount, `${path}.normInternalizations.${key}`, 0, 1);
    }
  }
  if (overrides.outletPreferences !== undefined) {
    const operations = new Set<string>();
    const preferences = arrayValue(overrides.outletPreferences, `${path}.outletPreferences`);
    if (preferences.length === 0) {
      throw new ScenarioValidationError(`${path}.outletPreferences`, 'expected at least one item');
    }
    preferences.forEach((entryValue, index) => {
      const entryPath = `${path}.outletPreferences[${index}]`;
      const entry = objectValue(entryValue, entryPath);
      if (typeof entry.operation !== 'string' || !OUTLET_OPERATION_SET.has(entry.operation)) {
        throw new ScenarioValidationError(`${entryPath}.operation`, 'unknown outlet operation');
      }
      if (operations.has(entry.operation)) {
        throw new ScenarioValidationError(`${entryPath}.operation`, 'duplicate outlet operation');
      }
      operations.add(entry.operation);
      numberValue(entry.rank, `${entryPath}.rank`, 0, 1);
    });
  }
  if (overrides.satisfierPreferences !== undefined) {
    arrayValue(overrides.satisfierPreferences, `${path}.satisfierPreferences`).forEach(
      (entryValue, index) => {
        const entryPath = `${path}.satisfierPreferences[${index}]`;
        const entry = objectValue(entryValue, entryPath);
        if (
          typeof entry.valueId !== 'string' ||
          !(VALUE_IDS as readonly string[]).includes(entry.valueId)
        ) {
          throw new ScenarioValidationError(`${entryPath}.valueId`, 'unknown value identifier');
        }
        stringValue(entry.flavor, `${entryPath}.flavor`);
        if (entry.type !== 'deficit' && entry.type !== 'surplus') {
          throw new ScenarioValidationError(`${entryPath}.type`, 'expected deficit or surplus');
        }
      },
    );
  }
  if (overrides.valueWeights !== undefined) {
    const weights = objectValue(overrides.valueWeights, `${path}.valueWeights`);
    for (const [valueId, weight] of Object.entries(weights)) {
      if (!(VALUE_IDS as readonly string[]).includes(valueId)) {
        throw new ScenarioValidationError(
          `${path}.valueWeights.${valueId}`,
          'unknown value identifier',
        );
      }
      numberValue(weight, `${path}.valueWeights.${valueId}`, 0, 2);
    }
  }
}

function validateFormativeProvenance(value: unknown, path: string): Record<string, unknown> {
  const provenance = objectValue(value, path);
  integerValue(provenance.age, `${path}.age`, 0);
  if (provenance.attribution !== null) {
    stringValue(provenance.attribution, `${path}.attribution`);
  }
  numberValue(provenance.copingPotential, `${path}.copingPotential`, 0, 1);
  stringValue(provenance.eventId, `${path}.eventId`);
  integerValue(provenance.eventIndex, `${path}.eventIndex`);
  stringValue(provenance.profileId, `${path}.profileId`);
  stringValue(provenance.source, `${path}.source`);
  numberValue(provenance.turn, `${path}.turn`, -1, 1);
  if (
    typeof provenance.valueId !== 'string' ||
    !(VALUE_IDS as readonly string[]).includes(provenance.valueId)
  ) {
    throw new ScenarioValidationError(`${path}.valueId`, 'unknown value identifier');
  }
  return provenance;
}

function validateHistoryState(value: unknown, path: string): Map<string, Record<string, unknown>> {
  const history = objectValue(value, path);
  validateHistoryOverrides(history.overrides, `${path}.overrides`);
  const plasticity = objectValue(history.plasticity, `${path}.plasticity`);
  const accumulatorKeys = new Set<string>();
  arrayValue(plasticity.accumulators, `${path}.plasticity.accumulators`).forEach(
    (entryValue, index) => {
      const entryPath = `${path}.plasticity.accumulators[${index}]`;
      const entry = objectValue(entryValue, entryPath);
      const appliedChange = numberValue(entry.appliedChange, `${entryPath}.appliedChange`, 0);
      const earnedChange = numberValue(entry.earnedChange, `${entryPath}.earnedChange`, 0);
      if (appliedChange > earnedChange) {
        throw new ScenarioValidationError(
          `${entryPath}.appliedChange`,
          'must not exceed earnedChange',
        );
      }
      numberValue(entry.integratedYears, `${entryPath}.integratedYears`, 0);
      const key = stringValue(entry.key, `${entryPath}.key`);
      if (accumulatorKeys.has(key)) {
        throw new ScenarioValidationError(`${entryPath}.key`, 'duplicate plasticity accumulator');
      }
      accumulatorKeys.add(key);
      validateBaselinePlasticityMechanism(entry.mechanism, `${entryPath}.mechanism`);
      const target = validateBaselinePlasticityTarget(entry.target, `${entryPath}.target`);
      if (key !== `${String(entry.mechanism)}:${target.kind}:${target.id}`) {
        throw new ScenarioValidationError(`${entryPath}.key`, 'must match mechanism and target');
      }
      validatePlasticityTargetCompatibility(
        String(entry.mechanism),
        target.kind,
        `${entryPath}.target.kind`,
      );
    },
  );
  arrayValue(plasticity.records, `${path}.plasticity.records`).forEach((entryValue, index) => {
    const entryPath = `${path}.plasticity.records[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    numberValue(entry.ageYears, `${entryPath}.ageYears`, 0);
    numberValue(entry.appliedChange, `${entryPath}.appliedChange`, 0, 1);
    numberValue(entry.integratedYears, `${entryPath}.integratedYears`, 0);
    validateBaselinePlasticityMechanism(entry.mechanism, `${entryPath}.mechanism`);
    integerValue(entry.minute, `${entryPath}.minute`, 0);
    numberValue(entry.previous, `${entryPath}.previous`, 0, 1);
    numberValue(entry.resulting, `${entryPath}.resulting`, 0, 1);
    stringValue(entry.source, `${entryPath}.source`);
    const target = validateBaselinePlasticityTarget(entry.target, `${entryPath}.target`);
    validatePlasticityTargetCompatibility(
      String(entry.mechanism),
      target.kind,
      `${entryPath}.target.kind`,
    );
  });
  const byMemoryId = new Map<string, Record<string, unknown>>();
  const eventIds = new Set<string>();
  arrayValue(history.formativeRecords, `${path}.formativeRecords`).forEach((entryValue, index) => {
    const entryPath = `${path}.formativeRecords[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    integerValue(entry.age, `${entryPath}.age`, 0);
    numberValue(entry.appliedTurn, `${entryPath}.appliedTurn`, -1, 1);
    if (entry.attribution !== null) stringValue(entry.attribution, `${entryPath}.attribution`);
    numberValue(entry.authoredTurn, `${entryPath}.authoredTurn`, -1, 1);
    numberValue(entry.copingPotential, `${entryPath}.copingPotential`, 0, 1);
    const eventId = stringValue(entry.eventId, `${entryPath}.eventId`);
    if (eventIds.has(eventId)) {
      throw new ScenarioValidationError(`${entryPath}.eventId`, 'duplicate formative event');
    }
    eventIds.add(eventId);
    integerValue(entry.eventIndex, `${entryPath}.eventIndex`);
    const memoryId = stringValue(entry.memoryId, `${entryPath}.memoryId`);
    if (byMemoryId.has(memoryId)) {
      throw new ScenarioValidationError(`${entryPath}.memoryId`, 'duplicate formative memory');
    }
    for (const field of ['previousCharge', 'resultingCharge']) {
      numberValue(entry[field], `${entryPath}.${field}`, -1, 1);
    }
    for (const field of ['previousWeight', 'resultingWeight']) {
      numberValue(entry[field], `${entryPath}.${field}`, 0, 2);
    }
    stringValue(entry.profileId, `${entryPath}.profileId`);
    stringValue(entry.source, `${entryPath}.source`);
    if (
      typeof entry.valueId !== 'string' ||
      !(VALUE_IDS as readonly string[]).includes(entry.valueId)
    ) {
      throw new ScenarioValidationError(`${entryPath}.valueId`, 'unknown value identifier');
    }
    byMemoryId.set(memoryId, entry);
  });
  return byMemoryId;
}

function validateBaselinePlasticityMechanism(value: unknown, path: string): void {
  if (typeof value !== 'string' || !BASELINE_PLASTICITY_MECHANISMS.has(value)) {
    throw new ScenarioValidationError(path, 'expected a known baseline plasticity mechanism');
  }
}

function validateBaselinePlasticityTarget(
  value: unknown,
  path: string,
): { id: string; kind: string } {
  const target = objectValue(value, path);
  const id = stringValue(target.id, `${path}.id`);
  if (typeof target.kind !== 'string' || !BASELINE_PLASTICITY_TARGET_KINDS.has(target.kind)) {
    throw new ScenarioValidationError(`${path}.kind`, 'expected a known plasticity target kind');
  }
  if (target.kind === 'cascade-prior' && (id === 'none' || !CASCADE_POSITIONS.has(id))) {
    throw new ScenarioValidationError(`${path}.id`, 'expected a cascade position');
  }
  return { id, kind: target.kind };
}

function validatePlasticityTargetCompatibility(
  mechanism: string,
  targetKind: string,
  path: string,
): void {
  const expectsCascade = mechanism === 'rupture-crystallization';
  if (expectsCascade !== (targetKind === 'cascade-prior')) {
    throw new ScenarioValidationError(path, `incompatible with ${mechanism}`);
  }
}

function validateAgent(value: unknown, path: string): void {
  const agent = objectValue(value, path);
  stringValue(agent.id, `${path}.id`);
  parseResourceAddress(agent.profile, `${path}.profile`, 'character-profile');
  validateLayerPosition(agent.position, `${path}.position`);
  validateLayerPosition(agent.destination, `${path}.destination`);
  if (agent.currentLocationId !== null) {
    stringValue(agent.currentLocationId, `${path}.currentLocationId`);
  }
  stringValue(agent.currentActivity, `${path}.currentActivity`);
  if (typeof agent.cascade !== 'string' || !CASCADE_POSITIONS.has(agent.cascade)) {
    throw new ScenarioValidationError(`${path}.cascade`, 'expected a known cascade position');
  }
  numberValue(agent.cascadeLoad, `${path}.cascadeLoad`, 0, 1.5);
  integerValue(agent.cascadeDwellUntilMinute, `${path}.cascadeDwellUntilMinute`);
  if (agent.cascadeTargetId !== null) {
    stringValue(agent.cascadeTargetId, `${path}.cascadeTargetId`);
  }
  if (agent.currentOutlet !== null) {
    const outlet = objectValue(agent.currentOutlet, `${path}.currentOutlet`);
    stringValue(outlet.affordanceId, `${path}.currentOutlet.affordanceId`);
    stringValue(outlet.label, `${path}.currentOutlet.label`);
    if (typeof outlet.operation !== 'string' || !OUTLET_OPERATION_SET.has(outlet.operation)) {
      throw new ScenarioValidationError(
        `${path}.currentOutlet.operation`,
        'expected a known outlet operation',
      );
    }
    if (
      typeof outlet.targetValueId !== 'string' ||
      !VALUE_IDS.some(candidate => candidate === outlet.targetValueId)
    ) {
      throw new ScenarioValidationError(
        `${path}.currentOutlet.targetValueId`,
        'expected a known value identifier',
      );
    }
    integerValue(outlet.remainingMinutes, `${path}.currentOutlet.remainingMinutes`, 1);
    integerValue(outlet.startedMinute, `${path}.currentOutlet.startedMinute`);
    numberValue(outlet.yield, `${path}.currentOutlet.yield`, 0, 1);
  }
  if (agent.narrative !== null) {
    const narrative = objectValue(agent.narrative, `${path}.narrative`);
    integerValue(narrative.promotedMinute, `${path}.narrative.promotedMinute`);
    const claimIds = new Set<string>();
    arrayValue(narrative.claims, `${path}.narrative.claims`).forEach((entry, index) => {
      const claimPath = `${path}.narrative.claims[${index}]`;
      const claim = objectValue(entry, claimPath);
      const claimId = stringValue(claim.id, `${claimPath}.id`);
      if (claimIds.has(claimId)) {
        throw new ScenarioValidationError(`${claimPath}.id`, 'duplicate narrative claim');
      }
      claimIds.add(claimId);
      stringValue(claim.statement, `${claimPath}.statement`);
      stringValue(claim.kind, `${claimPath}.kind`);
      for (const field of ['commitment', 'confidence', 'wearIn']) {
        numberValue(claim[field], `${claimPath}.${field}`, 0, 1);
      }
      for (const field of ['confirmations', 'reinterpretations', 'revisions']) {
        integerValue(claim[field], `${claimPath}.${field}`);
      }
    });
  }
  const formativeRecords = validateHistoryState(agent.history, `${path}.history`);
  numberValue(agent.walkingMetersPerMinute, `${path}.walkingMetersPerMinute`, 0.1, 500);

  const resources = objectValue(agent.resources, `${path}.resources`);
  for (const resourceId of [
    'executiveBudget',
    'physicalStamina',
    'regulationReserve',
    'socialBattery',
  ]) {
    numberValue(resources[resourceId], `${path}.resources.${resourceId}`, 0, 1);
  }
  validateSomaticState(agent.somatic, `${path}.somatic`);

  const values = objectValue(agent.values, `${path}.values`);
  for (const valueId of VALUE_IDS) validateValueState(values[valueId], `${path}.values.${valueId}`);

  const schedule = arrayValue(agent.schedule, `${path}.schedule`);
  if (schedule.length === 0) {
    throw new ScenarioValidationError(`${path}.schedule`, 'expected at least one block');
  }
  schedule.forEach((value, index) => {
    const blockPath = `${path}.schedule[${index}]`;
    const block = objectValue(value, blockPath);
    integerValue(block.startMinute, `${blockPath}.startMinute`);
    stringValue(block.locationId, `${blockPath}.locationId`);
    stringValue(block.activity, `${blockPath}.activity`);
    if (
      typeof block.recoveryMode !== 'string' ||
      !RECOVERY_MODES.has(block.recoveryMode as RecoveryMode)
    ) {
      throw new ScenarioValidationError(
        `${blockPath}.recoveryMode`,
        'expected break, none, rest, or sleep',
      );
    }
    validateResourceMap(block.resourceDrainsPerHour, `${blockPath}.resourceDrainsPerHour`);
    validateMaskingDemand(block.maskingDemand, `${blockPath}.maskingDemand`);
  });

  arrayValue(agent.outletHistory, `${path}.outletHistory`).forEach((value, index) => {
    const usePath = `${path}.outletHistory[${index}]`;
    const use = objectValue(value, usePath);
    stringValue(use.affordanceId, `${usePath}.affordanceId`);
    integerValue(use.uses, `${usePath}.uses`, 1);
    numberValue(use.habituation, `${usePath}.habituation`, 0, 1);
  });

  const positional = objectValue(agent.positionalRespect, `${path}.positionalRespect`);
  integerValue(positional.ambientCount, `${path}.positionalRespect.ambientCount`, 0);
  numberValue(positional.ambientStanding, `${path}.positionalRespect.ambientStanding`, -1, 1);
  const referenceIds = new Set<string>();
  const references = arrayValue(positional.references, `${path}.positionalRespect.references`);
  if (references.length > 5) {
    throw new ScenarioValidationError(
      `${path}.positionalRespect.references`,
      'expected no more than five exact references',
    );
  }
  references.forEach((referenceValue, index) => {
    const referencePath = `${path}.positionalRespect.references[${index}]`;
    const reference = objectValue(referenceValue, referencePath);
    const subjectId = stringValue(reference.subjectId, `${referencePath}.subjectId`);
    if (referenceIds.has(subjectId)) {
      throw new ScenarioValidationError(`${referencePath}.subjectId`, 'duplicate reference');
    }
    referenceIds.add(subjectId);
    numberValue(reference.relevance, `${referencePath}.relevance`, 0, 1);
    numberValue(reference.standing, `${referencePath}.standing`, -1, 1);
  });

  arrayValue(agent.memories, `${path}.memories`).forEach((value, index) => {
    const memoryPath = `${path}.memories[${index}]`;
    const memory = objectValue(value, memoryPath);
    stringValue(memory.id, `${memoryPath}.id`);
    integerValue(memory.minute, `${memoryPath}.minute`, -1);
    stringValue(memory.summary, `${memoryPath}.summary`);
    if (typeof memory.type !== 'string' || !MEMORY_TYPES.has(memory.type)) {
      throw new ScenarioValidationError(`${memoryPath}.type`, 'expected a known memory type');
    }
    if (memory.subjectId !== undefined) stringValue(memory.subjectId, `${memoryPath}.subjectId`);
    if (memory.emotionalTurn !== undefined) {
      numberValue(memory.emotionalTurn, `${memoryPath}.emotionalTurn`, -1, 1);
    }
    if (memory.provenance !== undefined) {
      if (memory.type !== 'formative') {
        throw new ScenarioValidationError(
          `${memoryPath}.provenance`,
          'only formative memories carry formative provenance',
        );
      }
      const provenance = validateFormativeProvenance(memory.provenance, `${memoryPath}.provenance`);
      const record = formativeRecords.get(memory.id as string);
      if (
        record === undefined ||
        record.eventId !== provenance.eventId ||
        record.age !== provenance.age ||
        record.attribution !== provenance.attribution ||
        record.authoredTurn !== provenance.turn ||
        record.copingPotential !== provenance.copingPotential ||
        record.eventIndex !== provenance.eventIndex ||
        record.profileId !== provenance.profileId ||
        record.source !== provenance.source ||
        record.valueId !== provenance.valueId
      ) {
        throw new ScenarioValidationError(
          `${memoryPath}.provenance`,
          'must match the linked formative disposition record',
        );
      }
    }
  });
}

function validateRelationshipHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    stringValue(entry.id, `${entryPath}.id`);
    stringValue(entry.requesterId, `${entryPath}.requesterId`);
    stringValue(entry.responderId, `${entryPath}.responderId`);
    integerValue(entry.minute, `${entryPath}.minute`);
    integerValue(entry.tick, `${entryPath}.tick`);
    numberValue(entry.magnitude, `${entryPath}.magnitude`, 0, 1);
    numberValue(entry.cooperationPosition, `${entryPath}.cooperationPosition`, 0, 1);
    numberValue(entry.previousStance, `${entryPath}.previousStance`, -1, 1);
    numberValue(entry.newStance, `${entryPath}.newStance`, -1, 1);
    numberValue(entry.stanceTurn, `${entryPath}.stanceTurn`, -1, 1);
    if (entry.outcome !== 'accepted' && entry.outcome !== 'refused') {
      throw new ScenarioValidationError(`${entryPath}.outcome`, 'expected accepted or refused');
    }
  });
}

function validateAppraisalHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    stringValue(entry.id, `${entryPath}.id`);
    stringValue(entry.eventId, `${entryPath}.eventId`);
    stringValue(entry.agentId, `${entryPath}.agentId`);
    integerValue(entry.minute, `${entryPath}.minute`);
    integerValue(entry.tick, `${entryPath}.tick`);
    numberValue(entry.copingPotential, `${entryPath}.copingPotential`, 0, 1);
    numberValue(entry.effectiveCoping, `${entryPath}.effectiveCoping`, 0, 1);
    numberValue(entry.cascadeLoad, `${entryPath}.cascadeLoad`, 0, 1.5);
    numberValue(entry.somaticImpairment, `${entryPath}.somaticImpairment`, 0, 1);
    numberValue(entry.somaticThreatContribution, `${entryPath}.somaticThreatContribution`, 0, 1);
    if (
      typeof entry.previousCascade !== 'string' ||
      !CASCADE_POSITIONS.has(entry.previousCascade)
    ) {
      throw new ScenarioValidationError(
        `${entryPath}.previousCascade`,
        'expected a known cascade position',
      );
    }
    if (typeof entry.nextCascade !== 'string' || !CASCADE_POSITIONS.has(entry.nextCascade)) {
      throw new ScenarioValidationError(
        `${entryPath}.nextCascade`,
        'expected a known cascade position',
      );
    }
    if (entry.socialTargetId !== null) {
      stringValue(entry.socialTargetId, `${entryPath}.socialTargetId`);
    }
    const turns = objectValue(entry.appliedTurns, `${entryPath}.appliedTurns`);
    for (const [valueId, turn] of Object.entries(turns)) {
      if (!VALUE_IDS.some(candidate => candidate === valueId)) {
        throw new ScenarioValidationError(
          `${entryPath}.appliedTurns.${valueId}`,
          'expected a known value identifier',
        );
      }
      numberValue(turn, `${entryPath}.appliedTurns.${valueId}`, -1, 1);
    }
  });
}

function validateTrace(value: unknown, path: string): void {
  const trace = objectValue(value, path);
  if (trace.schemaVersion !== 1) {
    throw new ScenarioValidationError(`${path}.schemaVersion`, 'unsupported schema version');
  }
  arrayValue(trace.entries, `${path}.entries`).forEach((entryValue, index) => {
    const entryPath = `${path}.entries[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    stringValue(entry.id, `${entryPath}.id`);
    if (entry.agentId !== null) stringValue(entry.agentId, `${entryPath}.agentId`);
    integerValue(entry.minute, `${entryPath}.minute`);
    integerValue(entry.tick, `${entryPath}.tick`);
    stringValue(entry.summary, `${entryPath}.summary`);
    if (typeof entry.kind !== 'string' || !TRACE_KINDS.has(entry.kind)) {
      throw new ScenarioValidationError(`${entryPath}.kind`, 'expected a known trace kind');
    }
    arrayValue(entry.terms, `${entryPath}.terms`).forEach((termValue, termIndex) => {
      const termPath = `${entryPath}.terms[${termIndex}]`;
      const term = objectValue(termValue, termPath);
      stringValue(term.id, `${termPath}.id`);
      const sources = arrayValue(term.sources, `${termPath}.sources`);
      if (sources.length === 0) {
        throw new ScenarioValidationError(`${termPath}.sources`, 'expected at least one source');
      }
      sources.forEach((source, sourceIndex) => {
        stringValue(source, `${termPath}.sources[${sourceIndex}]`);
      });
      if (
        term.value !== null &&
        typeof term.value !== 'boolean' &&
        typeof term.value !== 'string' &&
        (typeof term.value !== 'number' || !Number.isFinite(term.value))
      ) {
        throw new ScenarioValidationError(
          `${termPath}.value`,
          'expected a finite number, string, boolean, or null',
        );
      }
    });
    if (entry.selection === null) {
      if (entry.kind === 'gate') {
        throw new ScenarioValidationError(
          `${entryPath}.selection`,
          'gate entries require an explicit selection',
        );
      }
      return;
    }
    const selection = objectValue(entry.selection, `${entryPath}.selection`);
    if (selection.selectedId !== null) {
      stringValue(selection.selectedId, `${entryPath}.selection.selectedId`);
    }
    if (typeof selection.rule !== 'string' || !TRACE_SELECTION_RULES.has(selection.rule)) {
      throw new ScenarioValidationError(
        `${entryPath}.selection.rule`,
        'expected a known selection rule',
      );
    }
    if (entry.kind === 'gate' && selection.rule !== 'preempt-gate') {
      throw new ScenarioValidationError(
        `${entryPath}.selection.rule`,
        'gate entries must use the preempt-gate rule',
      );
    }
  });
}

function validateDecisionHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    stringValue(entry.id, `${entryPath}.id`);
    stringValue(entry.actorId, `${entryPath}.actorId`);
    stringValue(entry.opportunityId, `${entryPath}.opportunityId`);
    stringValue(entry.selectedCandidateId, `${entryPath}.selectedCandidateId`);
    if (entry.targetId !== null) stringValue(entry.targetId, `${entryPath}.targetId`);
    integerValue(entry.minute, `${entryPath}.minute`);
    integerValue(entry.tick, `${entryPath}.tick`);
    const candidates = arrayValue(entry.candidates, `${entryPath}.candidates`);
    if (candidates.length === 0) {
      throw new ScenarioValidationError(
        `${entryPath}.candidates`,
        'expected at least one candidate',
      );
    }
    candidates.forEach((candidateValue, candidateIndex) => {
      const candidatePath = `${entryPath}.candidates[${candidateIndex}]`;
      const candidate = objectValue(candidateValue, candidatePath);
      stringValue(candidate.candidateId, `${candidatePath}.candidateId`);
      stringValue(candidate.label, `${candidatePath}.label`);
      stringValue(candidate.operation, `${candidatePath}.operation`);
      const appraisal = objectValue(candidate.appraisal, `${candidatePath}.appraisal`);
      for (const key of [
        'contractViolationCost',
        'narrativeExpression',
        'repercussionCost',
        'turnFelt',
        'utility',
      ]) {
        numberValue(appraisal[key], `${candidatePath}.appraisal.${key}`);
      }
      arrayValue(appraisal.contributions, `${candidatePath}.appraisal.contributions`).forEach(
        (contributionValue, contributionIndex) => {
          const contributionPath = `${candidatePath}.appraisal.contributions[${contributionIndex}]`;
          const contribution = objectValue(contributionValue, contributionPath);
          stringValue(contribution.subjectId, `${contributionPath}.subjectId`);
          stringValue(contribution.value, `${contributionPath}.value`);
          for (const key of ['amount', 'empathy', 'turn', 'weight']) {
            numberValue(contribution[key], `${contributionPath}.${key}`);
          }
        },
      );
      const weights = objectValue(
        candidate.effectiveValueWeights,
        `${candidatePath}.effectiveValueWeights`,
      );
      for (const valueId of VALUE_IDS) {
        numberValue(weights[valueId], `${candidatePath}.effectiveValueWeights.${valueId}`, 0);
      }
      arrayValue(candidate.empathy, `${candidatePath}.empathy`).forEach(
        (empathyValue, empathyIndex) => {
          const empathyPath = `${candidatePath}.empathy[${empathyIndex}]`;
          const empathy = objectValue(empathyValue, empathyPath);
          stringValue(empathy.observerId, `${empathyPath}.observerId`);
          stringValue(empathy.subjectId, `${empathyPath}.subjectId`);
          for (const key of ['distance', 'effectiveFloor', 'empathy']) {
            numberValue(empathy[key], `${empathyPath}.${key}`, 0, 1);
          }
          const features = objectValue(empathy.features, `${empathyPath}.features`);
          for (const key of ['category', 'familiarity', 'kinship', 'reciprocity', 'similarity']) {
            numberValue(features[key], `${empathyPath}.features.${key}`, 0, 1);
          }
        },
      );
      const repercussion = objectValue(candidate.repercussion, `${candidatePath}.repercussion`);
      numberValue(repercussion.cost, `${candidatePath}.repercussion.cost`, 0);
      numberValue(repercussion.probability, `${candidatePath}.repercussion.probability`, 0, 1);
      arrayValue(repercussion.witnesses, `${candidatePath}.repercussion.witnesses`).forEach(
        (witnessValue, witnessIndex) => {
          const witnessPath = `${candidatePath}.repercussion.witnesses[${witnessIndex}]`;
          const witness = objectValue(witnessValue, witnessPath);
          stringValue(witness.witnessId, `${witnessPath}.witnessId`);
          numberValue(witness.actorEmpathy, `${witnessPath}.actorEmpathy`, 0, 1);
          numberValue(witness.targetEmpathy, `${witnessPath}.targetEmpathy`, 0, 1);
          numberValue(witness.reportProbability, `${witnessPath}.reportProbability`, 0, 1);
        },
      );
    });
  });
}

function validateDisclosureHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    stringValue(entry.id, `${entryPath}.id`);
    stringValue(entry.ownerId, `${entryPath}.ownerId`);
    stringValue(entry.itemId, `${entryPath}.itemId`);
    stringValue(entry.opportunityId, `${entryPath}.opportunityId`);
    integerValue(entry.minute, `${entryPath}.minute`);
    integerValue(entry.tick, `${entryPath}.tick`);
    numberValue(entry.disclosureBenefit, `${entryPath}.disclosureBenefit`);
    numberValue(entry.worstCost, `${entryPath}.worstCost`, 0);
    numberValue(entry.utility, `${entryPath}.utility`);
    if (entry.worstAudienceId !== null) {
      stringValue(entry.worstAudienceId, `${entryPath}.worstAudienceId`);
    }
    if (entry.outcome !== 'conceal' && entry.outcome !== 'disclose') {
      throw new ScenarioValidationError(`${entryPath}.outcome`, 'expected conceal or disclose');
    }
    arrayValue(entry.audiences, `${entryPath}.audiences`).forEach(
      (audienceValue, audienceIndex) => {
        const audiencePath = `${entryPath}.audiences[${audienceIndex}]`;
        const audience = objectValue(audienceValue, audiencePath);
        stringValue(audience.audienceId, `${audiencePath}.audienceId`);
        for (const key of [
          'disclosureSafety',
          'embeddedness',
          'estimatedEmpathy',
          'exposureRisk',
          'subjectiveCost',
        ]) {
          numberValue(audience[key], `${audiencePath}.${key}`, 0);
        }
      },
    );
  });
}

function nullableNumber(value: unknown, path: string, minimum = 0, maximum = 1): void {
  if (value !== null) numberValue(value, path, minimum, maximum);
}

function validateValueTurns(value: unknown, path: string): void {
  const turns = objectValue(value, path);
  for (const [valueId, turn] of Object.entries(turns)) {
    if (!(VALUE_IDS as readonly string[]).includes(valueId)) {
      throw new ScenarioValidationError(`${path}.${valueId}`, 'expected a known value identifier');
    }
    numberValue(turn, `${path}.${valueId}`, -1, 1);
  }
}

function validateObservationHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    stringValue(entry.id, `${entryPath}.id`);
    stringValue(entry.eventId, `${entryPath}.eventId`);
    stringValue(entry.observerId, `${entryPath}.observerId`);
    stringValue(entry.subjectId, `${entryPath}.subjectId`);
    integerValue(entry.minute, `${entryPath}.minute`);
    integerValue(entry.tick, `${entryPath}.tick`);
    if (typeof entry.channel !== 'string' || !OBSERVATION_CHANNELS.has(entry.channel)) {
      throw new ScenarioValidationError(`${entryPath}.channel`, 'expected hearing or sight');
    }
    if (entry.eventType === 'norm') {
      stringValue(entry.normId, `${entryPath}.normId`);
      if (typeof entry.affiliated !== 'boolean') {
        throw new ScenarioValidationError(`${entryPath}.affiliated`, 'expected a boolean');
      }
      numberValue(entry.internalization, `${entryPath}.internalization`, 0, 1);
      numberValue(entry.legibility, `${entryPath}.legibility`, 0, 1);
      numberValue(entry.perceptionStrength, `${entryPath}.perceptionStrength`, 0, 1);
      if (typeof entry.outcome !== 'string' || !NORM_OBSERVATION_OUTCOMES.has(entry.outcome)) {
        throw new ScenarioValidationError(`${entryPath}.outcome`, 'expected appraised or missed');
      }
      validateValueTurns(entry.baselineTurns, `${entryPath}.baselineTurns`);
      validateValueTurns(entry.compatibilityTurns, `${entryPath}.compatibilityTurns`);
      validateValueTurns(entry.subjectiveTurns, `${entryPath}.subjectiveTurns`);
      nullableNumber(entry.subjectiveTurn, `${entryPath}.subjectiveTurn`, -100, 100);
      nullableNumber(entry.legibilityMargin, `${entryPath}.legibilityMargin`, -1, 1);
      if (
        entry.legibilityBand !== null &&
        (typeof entry.legibilityBand !== 'string' || !CAPABILITY_BANDS.has(entry.legibilityBand))
      ) {
        throw new ScenarioValidationError(
          `${entryPath}.legibilityBand`,
          'expected a known capability band or null',
        );
      }
      return;
    }
    if (entry.eventType !== 'mind-model') {
      throw new ScenarioValidationError(`${entryPath}.eventType`, 'expected mind-model or norm');
    }
    if (typeof entry.dimension !== 'string' || !OBSERVATION_DIMENSIONS.has(entry.dimension)) {
      throw new ScenarioValidationError(`${entryPath}.dimension`, 'expected disclosure or empathy');
    }
    if (typeof entry.outcome !== 'string' || !OBSERVATION_OUTCOMES.has(entry.outcome)) {
      throw new ScenarioValidationError(
        `${entryPath}.outcome`,
        'expected a known observation outcome',
      );
    }
    numberValue(entry.diagnosticity, `${entryPath}.diagnosticity`, 0, 1);
    numberValue(entry.effectiveEvidence, `${entryPath}.effectiveEvidence`, 0, 1);
    numberValue(entry.evidenceStrength, `${entryPath}.evidenceStrength`, 0, 1);
    numberValue(entry.observedValue, `${entryPath}.observedValue`, 0, 1);
    numberValue(entry.perceptionStrength, `${entryPath}.perceptionStrength`, 0, 1);
    for (const key of [
      'gateThreshold',
      'newConfidence',
      'newEstimate',
      'newPredictionError',
      'newSuspicion',
      'predictedValue',
      'previousConfidence',
      'previousEstimate',
      'previousPredictionError',
      'previousSuspicion',
      'rawError',
    ]) {
      nullableNumber(entry[key], `${entryPath}.${key}`);
    }
    if (entry.calibrationMargin !== null) {
      numberValue(entry.calibrationMargin, `${entryPath}.calibrationMargin`, -1, 1);
    }
    if (
      entry.calibrationBand !== null &&
      (typeof entry.calibrationBand !== 'string' || !CAPABILITY_BANDS.has(entry.calibrationBand))
    ) {
      throw new ScenarioValidationError(
        `${entryPath}.calibrationBand`,
        'expected a known capability band or null',
      );
    }
  });
}

function validateIncidentHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    stringValue(entry.eventId, `${entryPath}.eventId`);
    stringValue(entry.id, `${entryPath}.id`);
    integerValue(entry.minute, `${entryPath}.minute`);
    stringValue(entry.observerId, `${entryPath}.observerId`);
    integerValue(entry.tick, `${entryPath}.tick`);
    if (entry.outcome !== 'appraised' && entry.outcome !== 'missed') {
      throw new ScenarioValidationError(`${entryPath}.outcome`, 'expected appraised or missed');
    }
    if (
      entry.perceivedAttribution !== null &&
      !['nobody', 'other', 'self'].includes(String(entry.perceivedAttribution))
    ) {
      throw new ScenarioValidationError(
        `${entryPath}.perceivedAttribution`,
        'expected nobody, other, self, or null',
      );
    }
    numberValue(entry.perceptionStrength, `${entryPath}.perceptionStrength`, 0, 1);
    numberValue(entry.shameTurn, `${entryPath}.shameTurn`, -1, 0);
    validateValueTurns(entry.baselineTurns, `${entryPath}.baselineTurns`);
    validateValueTurns(entry.subjectiveTurns, `${entryPath}.subjectiveTurns`);
    arrayValue(entry.contractTerms, `${entryPath}.contractTerms`).forEach(
      (termValue, termIndex) => {
        const termPath = `${entryPath}.contractTerms[${termIndex}]`;
        const term = objectValue(termValue, termPath);
        if (typeof term.affiliated !== 'boolean') {
          throw new ScenarioValidationError(`${termPath}.affiliated`, 'expected a boolean');
        }
        stringValue(term.contractId, `${termPath}.contractId`);
        stringValue(term.normId, `${termPath}.normId`);
        numberValue(term.enforcementPressure, `${termPath}.enforcementPressure`, 0, 1);
        numberValue(term.identityStake, `${termPath}.identityStake`, 0, 1);
        numberValue(term.internalization, `${termPath}.internalization`, 0, 1);
        numberValue(term.legibility, `${termPath}.legibility`, 0, 1);
        validateValueTurns(term.conventionalTurns, `${termPath}.conventionalTurns`);
      },
    );
  });
}

function validateDisplayHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    stringValue(entry.eventId, `${entryPath}.eventId`);
    stringValue(entry.id, `${entryPath}.id`);
    integerValue(entry.minute, `${entryPath}.minute`);
    integerValue(entry.perceivedAudienceCount, `${entryPath}.perceivedAudienceCount`, 0);
    integerValue(entry.tick, `${entryPath}.tick`);
    stringValue(entry.wearerId, `${entryPath}.wearerId`);
    numberValue(entry.wearerYield, `${entryPath}.wearerYield`, 0, 1);
    arrayValue(entry.appraisals, `${entryPath}.appraisals`).forEach(
      (appraisalValue, appraisalIndex) => {
        const appraisalPath = `${entryPath}.appraisals[${appraisalIndex}]`;
        const appraisal = objectValue(appraisalValue, appraisalPath);
        stringValue(appraisal.eventId, `${appraisalPath}.eventId`);
        stringValue(appraisal.id, `${appraisalPath}.id`);
        integerValue(appraisal.minute, `${appraisalPath}.minute`);
        stringValue(appraisal.observerId, `${appraisalPath}.observerId`);
        integerValue(appraisal.tick, `${appraisalPath}.tick`);
        if (typeof appraisal.outcome !== 'string' || !DISPLAY_RESPONSES.has(appraisal.outcome)) {
          throw new ScenarioValidationError(
            `${appraisalPath}.outcome`,
            'expected a known display response',
          );
        }
        for (const field of [
          'admirationTurn',
          'comparability',
          'exposureAfter',
          'exposureBefore',
          'markerCentrality',
          'perceptionStrength',
          'rankSimilarity',
        ]) {
          numberValue(appraisal[field], `${appraisalPath}.${field}`, 0, 1);
        }
        numberValue(appraisal.positionalTurn, `${appraisalPath}.positionalTurn`, -1, 0);
        validateValueTurns(appraisal.subjectiveTurns, `${appraisalPath}.subjectiveTurns`);
        arrayValue(appraisal.contractTerms, `${appraisalPath}.contractTerms`).forEach(
          (termValue, termIndex) => {
            const termPath = `${appraisalPath}.contractTerms[${termIndex}]`;
            const term = objectValue(termValue, termPath);
            if (typeof term.affiliated !== 'boolean') {
              throw new ScenarioValidationError(`${termPath}.affiliated`, 'expected a boolean');
            }
            stringValue(term.contractId, `${termPath}.contractId`);
            stringValue(term.normId, `${termPath}.normId`);
            numberValue(term.enforcementPressure, `${termPath}.enforcementPressure`, 0, 1);
            numberValue(term.identityStake, `${termPath}.identityStake`, 0, 1);
            numberValue(term.internalization, `${termPath}.internalization`, 0, 1);
            numberValue(term.legibility, `${termPath}.legibility`, 0, 1);
            validateValueTurns(term.conventionalTurns, `${termPath}.conventionalTurns`);
          },
        );
      },
    );
  });
}

function validateDisplayExposures(value: unknown, path: string): void {
  const keys = new Set<string>();
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    const displayId = stringValue(entry.displayId, `${entryPath}.displayId`);
    const observerId = stringValue(entry.observerId, `${entryPath}.observerId`);
    const key = `${observerId}:${displayId}`;
    if (keys.has(key)) {
      throw new ScenarioValidationError(entryPath, 'duplicate observer display exposure');
    }
    keys.add(key);
    integerValue(entry.exposures, `${entryPath}.exposures`, 1);
    numberValue(entry.habituation, `${entryPath}.habituation`, 0, 1);
  });
}

function validateSomaticHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    for (const field of ['eventId', 'id', 'subjectId']) {
      stringValue(entry[field], `${entryPath}.${field}`);
    }
    integerValue(entry.minute, `${entryPath}.minute`);
    integerValue(entry.tick, `${entryPath}.tick`);
    for (const field of ['levelAfter', 'levelBefore']) {
      const level = integerValue(entry[field], `${entryPath}.${field}`);
      if (level > 5) {
        throw new ScenarioValidationError(
          `${entryPath}.${field}`,
          'expected an integer from 0 through 5',
        );
      }
    }
    arrayValue(entry.observations, `${entryPath}.observations`).forEach(
      (observationValue, observationIndex) => {
        const observationPath = `${entryPath}.observations[${observationIndex}]`;
        const observation = objectValue(observationValue, observationPath);
        for (const field of ['eventId', 'id', 'observerId', 'subjectId']) {
          stringValue(observation[field], `${observationPath}.${field}`);
        }
        integerValue(observation.minute, `${observationPath}.minute`);
        integerValue(observation.tick, `${observationPath}.tick`);
        integerValue(observation.witnessCount, `${observationPath}.witnessCount`);
        for (const field of ['empathy', 'helpProbability', 'perceptionStrength']) {
          numberValue(observation[field], `${observationPath}.${field}`, 0, 1);
        }
        nullableNumber(observation.inferredSeverity, `${observationPath}.inferredSeverity`);
        nullableNumber(
          observation.calibrationMargin,
          `${observationPath}.calibrationMargin`,
          -1,
          1,
        );
        if (
          observation.calibrationBand !== null &&
          (typeof observation.calibrationBand !== 'string' ||
            !CAPABILITY_BANDS.has(observation.calibrationBand))
        ) {
          throw new ScenarioValidationError(
            `${observationPath}.calibrationBand`,
            'expected a known capability band or null',
          );
        }
        if (observation.outcome !== 'missed' && observation.outcome !== 'observed') {
          throw new ScenarioValidationError(
            `${observationPath}.outcome`,
            'expected missed or observed',
          );
        }
        if (
          observation.response !== null &&
          (typeof observation.response !== 'string' || !SOMATIC_RESPONSES.has(observation.response))
        ) {
          throw new ScenarioValidationError(
            `${observationPath}.response`,
            'expected a known crowd response or null',
          );
        }
      },
    );
  });
}

function validateIdentifierList(value: unknown, path: string): void {
  const values = arrayValue(value, path);
  values.forEach((entry, index) => {
    stringValue(entry, `${path}[${index}]`);
  });
  if (new Set(values).size !== values.length) {
    throw new ScenarioValidationError(path, 'duplicate identifier');
  }
}

function validateAgendaState(value: unknown, path: string): void {
  arrayValue(value, path).forEach((goalValue, index) => {
    const goalPath = `${path}[${index}]`;
    const goal = objectValue(goalValue, goalPath);
    if (typeof goal.status !== 'string' || !GOAL_STATUSES.has(goal.status)) {
      throw new ScenarioValidationError(`${goalPath}.status`, 'expected a known goal status');
    }
    if (goal.lastPlannedWorldRevision !== null) {
      integerValue(goal.lastPlannedWorldRevision, `${goalPath}.lastPlannedWorldRevision`);
    }
    if (goal.resolvedMinute !== null) {
      integerValue(goal.resolvedMinute, `${goalPath}.resolvedMinute`);
    }
  });
}

function validatePlans(value: unknown, path: string): void {
  arrayValue(value, path).forEach((planValue, index) => {
    const planPath = `${path}[${index}]`;
    const plan = objectValue(planValue, planPath);
    stringValue(plan.id, `${planPath}.id`);
    stringValue(plan.actorId, `${planPath}.actorId`);
    stringValue(plan.goalId, `${planPath}.goalId`);
    integerValue(plan.createdMinute, `${planPath}.createdMinute`);
    integerValue(plan.estimatedCompletionMinute, `${planPath}.estimatedCompletionMinute`);
    numberValue(plan.score, `${planPath}.score`);
    const taskIds = arrayValue(plan.taskIds, `${planPath}.taskIds`);
    if (taskIds.length === 0) {
      throw new ScenarioValidationError(`${planPath}.taskIds`, 'expected at least one task');
    }
    taskIds.forEach((taskId, taskIndex) => {
      stringValue(taskId, `${planPath}.taskIds[${taskIndex}]`);
    });
  });
}

function validateIntentions(value: unknown, path: string): void {
  arrayValue(value, path).forEach((intentionValue, index) => {
    const intentionPath = `${path}[${index}]`;
    const intention = objectValue(intentionValue, intentionPath);
    stringValue(intention.actorId, `${intentionPath}.actorId`);
    stringValue(intention.goalId, `${intentionPath}.goalId`);
    stringValue(intention.planId, `${intentionPath}.planId`);
    stringValue(intention.taskId, `${intentionPath}.taskId`);
    numberValue(intention.remainingMinutes, `${intentionPath}.remainingMinutes`, 0);
    if (intention.startedMinute !== null) {
      integerValue(intention.startedMinute, `${intentionPath}.startedMinute`);
    }
    if (typeof intention.phase !== 'string' || !INTENTION_PHASES.has(intention.phase)) {
      throw new ScenarioValidationError(
        `${intentionPath}.phase`,
        'expected a known intention phase',
      );
    }
  });
}

function validatePlanAppraisal(value: unknown, path: string): void {
  const appraisal = objectValue(value, path);
  for (const key of [
    'contractViolationCost',
    'narrativeExpression',
    'repercussionCost',
    'turnFelt',
    'utility',
  ]) {
    numberValue(appraisal[key], `${path}.${key}`);
  }
  arrayValue(appraisal.contributions, `${path}.contributions`).forEach(
    (contributionValue, index) => {
      const contributionPath = `${path}.contributions[${index}]`;
      const contribution = objectValue(contributionValue, contributionPath);
      stringValue(contribution.subjectId, `${contributionPath}.subjectId`);
      stringValue(contribution.value, `${contributionPath}.value`);
      for (const key of ['amount', 'empathy', 'turn', 'weight']) {
        numberValue(contribution[key], `${contributionPath}.${key}`);
      }
    },
  );
}

function validateAgendaHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((decisionValue, index) => {
    const decisionPath = `${path}[${index}]`;
    const decision = objectValue(decisionValue, decisionPath);
    stringValue(decision.id, `${decisionPath}.id`);
    stringValue(decision.actorId, `${decisionPath}.actorId`);
    integerValue(decision.minute, `${decisionPath}.minute`);
    integerValue(decision.tick, `${decisionPath}.tick`);
    integerValue(decision.worldRevision, `${decisionPath}.worldRevision`);
    if (decision.selectedPlanId !== null) {
      stringValue(decision.selectedPlanId, `${decisionPath}.selectedPlanId`);
    }
    const candidateIds: string[] = [];
    arrayValue(decision.candidates, `${decisionPath}.candidates`).forEach(
      (candidateValue, candidateIndex) => {
        const candidatePath = `${decisionPath}.candidates[${candidateIndex}]`;
        const candidate = objectValue(candidateValue, candidatePath);
        candidateIds.push(stringValue(candidate.id, `${candidatePath}.id`));
        stringValue(candidate.goalId, `${candidatePath}.goalId`);
        integerValue(
          candidate.estimatedCompletionMinute,
          `${candidatePath}.estimatedCompletionMinute`,
        );
        integerValue(
          candidate.estimatedDurationMinutes,
          `${candidatePath}.estimatedDurationMinutes`,
        );
        for (const key of ['goalUtility', 'resourceCost', 'score', 'taskUtility', 'urgency']) {
          numberValue(candidate[key], `${candidatePath}.${key}`);
        }
        const resourceCosts = objectValue(
          candidate.resourceCosts,
          `${candidatePath}.resourceCosts`,
        );
        for (const resourceId of [
          'executiveBudget',
          'physicalStamina',
          'regulationReserve',
          'socialBattery',
        ]) {
          numberValue(resourceCosts[resourceId], `${candidatePath}.resourceCosts.${resourceId}`, 0);
        }
        arrayValue(candidate.taskIds, `${candidatePath}.taskIds`).forEach((taskId, taskIndex) => {
          stringValue(taskId, `${candidatePath}.taskIds[${taskIndex}]`);
        });
        validatePlanAppraisal(candidate.appraisal, `${candidatePath}.appraisal`);
      },
    );
    if (
      decision.selectedPlanId !== null &&
      !candidateIds.includes(decision.selectedPlanId as string)
    ) {
      throw new ScenarioValidationError(
        `${decisionPath}.selectedPlanId`,
        'selected plan must belong to the decision candidates',
      );
    }
  });
}

function validateNarrativeHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entry, index) => {
    const recordPath = `${path}[${index}]`;
    const record = objectValue(entry, recordPath);
    for (const field of ['id', 'eventId', 'actorId', 'claimId', 'summary']) {
      stringValue(record[field], `${recordPath}.${field}`);
    }
    if (typeof record.disposition !== 'string' || !NARRATIVE_DISPOSITIONS.has(record.disposition)) {
      throw new ScenarioValidationError(
        `${recordPath}.disposition`,
        'expected a known narrative disposition',
      );
    }
    integerValue(record.minute, `${recordPath}.minute`);
    integerValue(record.tick, `${recordPath}.tick`);
    numberValue(record.regulationCost, `${recordPath}.regulationCost`, 0, 1);
  });
}

function validateReputations(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entry, index) => {
    const reputationPath = `${path}[${index}]`;
    const reputation = objectValue(entry, reputationPath);
    for (const field of ['audienceId', 'claim', 'subjectId']) {
      stringValue(reputation[field], `${reputationPath}.${field}`);
    }
    if (reputation.audienceType !== 'agent' && reputation.audienceType !== 'group') {
      throw new ScenarioValidationError(
        `${reputationPath}.audienceType`,
        'expected agent or group',
      );
    }
    numberValue(reputation.confidence, `${reputationPath}.confidence`, 0, 1);
    integerValue(reputation.firstMinute, `${reputationPath}.firstMinute`);
    integerValue(reputation.lastMinute, `${reputationPath}.lastMinute`);
    integerValue(reputation.repetitions, `${reputationPath}.repetitions`, 1);
    arrayValue(reputation.sourceIds, `${reputationPath}.sourceIds`).forEach(
      (sourceId, sourceIndex) => {
        stringValue(sourceId, `${reputationPath}.sourceIds[${sourceIndex}]`);
      },
    );
  });
}

function migrateSnapshot(value: unknown): Record<string, unknown> {
  const file = clone(objectValue(value, 'snapshot'));
  if (
    file.schemaVersion !== 1 &&
    file.schemaVersion !== 2 &&
    file.schemaVersion !== 3 &&
    file.schemaVersion !== 4 &&
    file.schemaVersion !== 5 &&
    file.schemaVersion !== 6 &&
    file.schemaVersion !== 7 &&
    file.schemaVersion !== 8 &&
    file.schemaVersion !== 9 &&
    file.schemaVersion !== 10 &&
    file.schemaVersion !== 11 &&
    file.schemaVersion !== 12 &&
    file.schemaVersion !== 13 &&
    file.schemaVersion !== 14 &&
    file.schemaVersion !== 15 &&
    file.schemaVersion !== 16 &&
    file.schemaVersion !== 17
  ) {
    throw new ScenarioValidationError('snapshot.schemaVersion', 'unsupported schema version');
  }
  const sourceVersion = file.schemaVersion as number;
  if (sourceVersion === 1) {
    const scenario = parseScenario(file.scenario);
    file.scenario = scenario;
    file.agendaDecisions = [];
    file.agendaGoals = [];
    file.intentions = [];
    file.plans = [];
    file.worldFacts = scenario.worldFacts;
    file.worldRevision = 0;
  }
  if (sourceVersion === 1 || sourceVersion === 2) {
    file.trace = {
      entries: arrayValue(file.trace, 'snapshot.trace').map((entryValue, entryIndex) => {
        const entry = clone(objectValue(entryValue, `snapshot.trace[${entryIndex}]`));
        const causes = arrayValue(entry.causes, `snapshot.trace[${entryIndex}].causes`);
        delete entry.causes;
        entry.selection = null;
        entry.terms = causes.map((cause, causeIndex) => ({
          id: 'legacy-cause',
          sources: [`snapshot-v${file.schemaVersion}.trace[${entryIndex}].causes[${causeIndex}]`],
          value: stringValue(cause, `snapshot.trace[${entryIndex}].causes[${causeIndex}]`),
        }));
        return entry;
      }),
      schemaVersion: 1,
    };
  }
  for (const agentValue of arrayValue(file.agents, 'snapshot.agents')) {
    const agent = objectValue(agentValue, 'snapshot.agents');
    for (const blockValue of arrayValue(agent.schedule, 'snapshot.agents.schedule')) {
      const block = objectValue(blockValue, 'snapshot.agents.schedule');
      if (block.recoveryMode === undefined) {
        block.recoveryMode = legacyRecoveryMode(block.activity);
      }
      if (block.resourceDrainsPerHour === undefined) block.resourceDrainsPerHour = {};
      if (block.maskingDemand === undefined) block.maskingDemand = null;
    }
  }
  if (sourceVersion < 4) {
    for (const dyadValue of arrayValue(file.dyads, 'snapshot.dyads')) {
      const dyad = objectValue(dyadValue, 'snapshot.dyads');
      dyad.suspicion = 0;
    }
    file.observations = [];
    file.resolvedObservationEventIds = [];
  }
  if (sourceVersion < 5) {
    for (const observationValue of arrayValue(file.observations, 'snapshot.observations')) {
      const observation = objectValue(observationValue, 'snapshot.observations');
      observation.eventType = 'mind-model';
    }
  }
  if (sourceVersion < 6) {
    for (const dyadValue of arrayValue(file.dyads, 'snapshot.dyads')) {
      const dyad = objectValue(dyadValue, 'snapshot.dyads');
      dyad.exposureDebt = 0;
    }
    file.relationshipDecisions = [];
    file.resolvedRelationshipEventIds = [];
    file.resolvedRelationshipRequestIds = [];
  }
  if (sourceVersion < 7) {
    for (const agentValue of arrayValue(file.agents, 'snapshot.agents')) {
      const agent = objectValue(agentValue, 'snapshot.agents');
      agent.cascadeDwellUntilMinute = file.minute;
      agent.cascadeLoad = 0;
      agent.cascadeTargetId = null;
      agent.currentOutlet = null;
      agent.outletHistory = [];
    }
    file.appraisalRecords = [];
    file.resolvedAppraisalEventIds = [];
  }
  if (sourceVersion < 8) {
    for (const agentValue of arrayValue(file.agents, 'snapshot.agents')) {
      objectValue(agentValue, 'snapshot.agents').narrative = null;
    }
    for (const dyadValue of arrayValue(file.dyads, 'snapshot.dyads')) {
      objectValue(dyadValue, 'snapshot.dyads').validatorClaimIds = [];
    }
    for (const goalValue of arrayValue(file.agendaGoals, 'snapshot.agendaGoals')) {
      objectValue(goalValue, 'snapshot.agendaGoals').claimExpressions = [];
    }
    file.narrativeRecords = [];
    file.reputations = [];
    file.resolvedAspirationOpportunityIds = [];
    file.resolvedNarrativeEventIds = [];
  }
  if (sourceVersion < 9) {
    const scenario = parseScenario(file.scenario);
    const legacyEnvironmentId = stringValue(file.environmentId, 'snapshot.environmentId');
    if (legacyEnvironmentId !== scenario.environment.resourceId) {
      throw new ScenarioValidationError(
        'snapshot.environmentId',
        'must match the snapshot scenario environment',
      );
    }
    file.scenario = scenario;
    file.environment = scenario.environment;
    delete file.environmentId;
    for (const agentValue of arrayValue(file.agents, 'snapshot.agents')) {
      const agent = objectValue(agentValue, 'snapshot.agents');
      const placement = scenario.characters.find(candidate => candidate.instanceId === agent.id);
      if (placement === undefined) {
        throw new ScenarioValidationError(
          'snapshot.agents.id',
          `unknown scenario agent "${String(agent.id)}"`,
        );
      }
      const legacyProfileId = stringValue(agent.profileId, 'snapshot.agents.profileId');
      if (legacyProfileId !== placement.profile.resourceId) {
        throw new ScenarioValidationError(
          'snapshot.agents.profileId',
          'must match the snapshot scenario character profile',
        );
      }
      agent.profile = placement.profile;
      delete agent.profileId;
    }
    const byKey = new Map<string, ResourceAddress>();
    for (const address of [
      scenario.environment,
      ...scenario.characters.map(item => item.profile),
    ]) {
      byKey.set(resourceAddressKey(address), address);
    }
    file.resourceLock = {
      resources: [...byKey.values()].sort((left, right) => {
        const leftKey = resourceAddressKey(left);
        const rightKey = resourceAddressKey(right);
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      }),
    };
  }
  if (sourceVersion < 10) {
    for (const agentValue of arrayValue(file.agents, 'snapshot.agents')) {
      const agent = objectValue(agentValue, 'snapshot.agents');
      objectValue(agent.position, 'snapshot.agents.position').layerId = 'surface';
      objectValue(agent.destination, 'snapshot.agents.destination').layerId = 'surface';
    }
  }
  if (sourceVersion < 11) {
    const scenario = parseScenario(file.scenario);
    file.scenario = scenario;
    const events = new Map(scenario.observationEvents.map(event => [event.id, event]));
    for (const observationValue of arrayValue(file.observations, 'snapshot.observations')) {
      const observation = objectValue(observationValue, 'snapshot.observations');
      if (observation.eventType !== 'norm') continue;
      const event = events.get(stringValue(observation.eventId, 'snapshot.observations.eventId'));
      if (event?.eventType === 'norm') observation.normId = resourceAddressKey(event.norm);
    }
  }
  if (sourceVersion < 12) {
    for (const agentValue of arrayValue(file.agents, 'snapshot.agents')) {
      const agent = objectValue(agentValue, 'snapshot.agents');
      agent.history = {
        formativeRecords: [],
        overrides: {},
        plasticity: { accumulators: [], records: [] },
      };
      for (const memoryValue of arrayValue(agent.memories, 'snapshot.agents.memories')) {
        delete objectValue(memoryValue, 'snapshot.agents.memories').provenance;
      }
    }
  }
  if (sourceVersion < 13) {
    for (const agentValue of arrayValue(file.agents, 'snapshot.agents')) {
      const agent = objectValue(agentValue, 'snapshot.agents');
      const history = objectValue(agent.history, 'snapshot.agents.history');
      history.plasticity = { accumulators: [], records: [] };
    }
  }
  if (sourceVersion < 14) {
    const scenario = parseScenario(file.scenario);
    file.scenario = scenario;
    file.incidentRecords = [];
    file.resolvedIncidentEventIds = [];
    for (const observationValue of arrayValue(file.observations, 'snapshot.observations')) {
      const observation = objectValue(observationValue, 'snapshot.observations');
      if (observation.eventType !== 'norm') continue;
      const member = observation.member === true;
      observation.affiliated = member;
      observation.internalization = member ? 1 : 0;
      delete observation.member;
    }
    for (const agentValue of arrayValue(file.agents, 'snapshot.agents')) {
      const agent = objectValue(agentValue, 'snapshot.agents');
      const history = objectValue(agent.history, 'snapshot.agents.history');
      const overrides = objectValue(history.overrides, 'snapshot.agents.history.overrides');
      const placement = scenario.characters.find(candidate => candidate.instanceId === agent.id);
      if (placement !== undefined && placement.normPerspectives.length > 0) {
        overrides.normInternalizations = Object.fromEntries(
          placement.normPerspectives.map(perspective => [
            resourceAddressKey(perspective.norm),
            perspective.internalization,
          ]),
        );
      }
    }
  }
  if (sourceVersion < 15) {
    file.scenario = parseScenario(file.scenario);
    file.displayExposures = [];
    file.displayRecords = [];
    file.resolvedDisplayEventIds = [];
    for (const agentValue of arrayValue(file.agents, 'snapshot.agents')) {
      objectValue(agentValue, 'snapshot.agents').positionalRespect = {
        ambientCount: 0,
        ambientStanding: 0,
        references: [],
      };
    }
  }
  if (sourceVersion < 16) {
    file.scenario = parseScenario(file.scenario);
    file.resolvedSomaticEventIds = [];
    file.somaticRecords = [];
    for (const agentValue of arrayValue(file.agents, 'snapshot.agents')) {
      objectValue(agentValue, 'snapshot.agents').somatic = {
        attentionTax: 0,
        impairment: 0,
        level: 0,
        pain: 0,
        perceivedUrgency: 0,
        sources: [],
        threatContribution: 0,
      };
    }
    for (const recordValue of arrayValue(file.appraisalRecords, 'snapshot.appraisalRecords')) {
      const record = objectValue(recordValue, 'snapshot.appraisalRecords');
      record.somaticImpairment = 0;
      record.somaticThreatContribution = 0;
    }
  }
  if (sourceVersion < 17) {
    const lock = objectValue(file.resourceLock, 'snapshot.resourceLock');
    lock.digest = null;
  }
  file.schemaVersion = 17;
  return file;
}

export function parseSnapshot(value: unknown): SimulationSnapshotFile {
  const file = migrateSnapshot(value);
  if (file.type !== 'verusim-snapshot') {
    throw new ScenarioValidationError('snapshot.type', 'expected verusim-snapshot');
  }
  if (file.schemaVersion !== 17) {
    throw new ScenarioValidationError('snapshot.schemaVersion', 'unsupported schema version');
  }
  const scenario = parseScenario(file.scenario);
  const environment = parseResourceAddress(
    file.environment,
    'snapshot.environment',
    'environment-layout',
  );
  if (resourceAddressKey(environment) !== resourceAddressKey(scenario.environment)) {
    throw new ScenarioValidationError(
      'snapshot.environment',
      'must match the snapshot scenario environment',
    );
  }
  const resourceLock = objectValue(file.resourceLock, 'snapshot.resourceLock');
  const lockedResources = arrayValue(resourceLock.resources, 'snapshot.resourceLock.resources').map(
    (address, index) => parseResourceAddress(address, `snapshot.resourceLock.resources[${index}]`),
  );
  const lockDigest =
    resourceLock.digest === null
      ? null
      : stringValue(resourceLock.digest, 'snapshot.resourceLock.digest');
  resourceLock.digest = lockDigest;
  const lockKeys = lockedResources.map(resourceAddressKey);
  if (new Set(lockKeys).size !== lockKeys.length) {
    throw new ScenarioValidationError(
      'snapshot.resourceLock.resources',
      'duplicate resource address',
    );
  }
  const sortedLockKeys = [...lockKeys].sort();
  if (JSON.stringify(lockKeys) !== JSON.stringify(sortedLockKeys)) {
    throw new ScenarioValidationError(
      'snapshot.resourceLock.resources',
      'must use semantic address order',
    );
  }
  const expectedKeys = [
    scenario.environment,
    ...scenario.characters.map(item => item.profile),
    ...scenario.socialContractPlacements.map(item => item.contract),
  ]
    .map(resourceAddressKey)
    .filter((key, index, keys) => keys.indexOf(key) === index)
    .sort();
  if (expectedKeys.some(key => !lockKeys.includes(key))) {
    throw new ScenarioValidationError(
      'snapshot.resourceLock.resources',
      'must contain every direct scenario resource dependency',
    );
  }
  integerValue(file.minute, 'snapshot.minute');
  integerValue(file.tick, 'snapshot.tick');

  const agents = arrayValue(file.agents, 'snapshot.agents');
  agents.forEach((agent, index) => {
    validateAgent(agent, `snapshot.agents[${index}]`);
  });
  const agentIds = agents.map((agent, index) =>
    stringValue(objectValue(agent, `snapshot.agents[${index}]`).id, `snapshot.agents[${index}].id`),
  );
  if (new Set(agentIds).size !== agentIds.length) {
    throw new ScenarioValidationError('snapshot.agents', 'duplicate agent identifier');
  }

  const runtimeScenario = parseScenario({
    ...scenario,
    agendaGoals: file.agendaGoals,
    disclosureItems: file.disclosureItems,
    dyads: file.dyads,
    worldFacts: file.worldFacts,
  });
  validateAgendaState(file.agendaGoals, 'snapshot.agendaGoals');
  validateAgendaHistory(file.agendaDecisions, 'snapshot.agendaDecisions');
  validatePlans(file.plans, 'snapshot.plans');
  validateIntentions(file.intentions, 'snapshot.intentions');
  integerValue(file.worldRevision, 'snapshot.worldRevision');
  validateDecisionHistory(file.decisions, 'snapshot.decisions');
  validateDisclosureHistory(file.disclosureDecisions, 'snapshot.disclosureDecisions');
  validateDisplayExposures(file.displayExposures, 'snapshot.displayExposures');
  validateDisplayHistory(file.displayRecords, 'snapshot.displayRecords');
  validateSomaticHistory(file.somaticRecords, 'snapshot.somaticRecords');
  validateIncidentHistory(file.incidentRecords, 'snapshot.incidentRecords');
  validateObservationHistory(file.observations, 'snapshot.observations');
  validateRelationshipHistory(file.relationshipDecisions, 'snapshot.relationshipDecisions');
  validateAppraisalHistory(file.appraisalRecords, 'snapshot.appraisalRecords');
  validateNarrativeHistory(file.narrativeRecords, 'snapshot.narrativeRecords');
  validateReputations(file.reputations, 'snapshot.reputations');
  validateTrace(file.trace, 'snapshot.trace');
  validateIdentifierList(file.resolvedOpportunityIds, 'snapshot.resolvedOpportunityIds');
  validateIdentifierList(
    file.resolvedDisclosureOpportunityIds,
    'snapshot.resolvedDisclosureOpportunityIds',
  );
  validateIdentifierList(file.resolvedDisplayEventIds, 'snapshot.resolvedDisplayEventIds');
  validateIdentifierList(file.resolvedIncidentEventIds, 'snapshot.resolvedIncidentEventIds');
  validateIdentifierList(file.resolvedObservationEventIds, 'snapshot.resolvedObservationEventIds');
  validateIdentifierList(
    file.resolvedRelationshipEventIds,
    'snapshot.resolvedRelationshipEventIds',
  );
  validateIdentifierList(
    file.resolvedRelationshipRequestIds,
    'snapshot.resolvedRelationshipRequestIds',
  );
  validateIdentifierList(file.resolvedAppraisalEventIds, 'snapshot.resolvedAppraisalEventIds');
  validateIdentifierList(
    file.resolvedAspirationOpportunityIds,
    'snapshot.resolvedAspirationOpportunityIds',
  );
  validateIdentifierList(file.resolvedNarrativeEventIds, 'snapshot.resolvedNarrativeEventIds');
  validateIdentifierList(file.resolvedSomaticEventIds, 'snapshot.resolvedSomaticEventIds');

  return {
    ...(file as unknown as SimulationSnapshotFile),
    agendaGoals: runtimeScenario.agendaGoals as SimulationSnapshotFile['agendaGoals'],
    disclosureItems: runtimeScenario.disclosureItems,
    dyads: runtimeScenario.dyads,
    scenario,
    worldFacts: runtimeScenario.worldFacts,
  };
}
