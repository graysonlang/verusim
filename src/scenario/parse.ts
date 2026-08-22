import {
  CAPABILITY_IDS,
  SOCIAL_FEATURE_IDS,
  VALUE_IDS,
  type AreaKind,
  type CharacterLibraryFile,
  type EnvironmentLibraryFile,
  type ScenarioFile,
  type ValueId,
} from '../model/types.js';

const AREA_KINDS = new Set<AreaKind>([
  'building',
  'field',
  'forest',
  'grass',
  'market',
  'path',
  'water',
]);
const VALUE_ID_SET = new Set<string>(VALUE_IDS);
const DYAD_MODES = new Set(['courteous', 'contesting', 'guarded', 'ruptured', 'warm']);
const GOAL_SOURCES = new Set(['aspiration', 'need', 'obligation', 'scenario', 'want']);
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ScenarioValidationError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ScenarioValidationError';
  }
}

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ScenarioValidationError(path, 'expected an object');
  }
  return value as Record<string, unknown>;
}

function arrayValue(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ScenarioValidationError(path, 'expected an array');
  return value;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ScenarioValidationError(path, 'expected a non-empty string');
  }
  return value;
}

function identifierValue(value: unknown, path: string): string {
  const id = stringValue(value, path);
  if (!IDENTIFIER.test(id)) {
    throw new ScenarioValidationError(path, 'expected a lowercase kebab-case identifier');
  }
  return id;
}

function numberValue(
  value: unknown,
  path: string,
  minimum = Number.NEGATIVE_INFINITY,
  maximum = Number.POSITIVE_INFINITY,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ScenarioValidationError(path, 'expected a finite number');
  }
  if (value < minimum || value > maximum) {
    throw new ScenarioValidationError(path, `expected a number from ${minimum} through ${maximum}`);
  }
  return value;
}

function integerValue(value: unknown, path: string, minimum: number, maximum: number): number {
  const result = numberValue(value, path, minimum, maximum);
  if (!Number.isInteger(result)) throw new ScenarioValidationError(path, 'expected an integer');
  return result;
}

function schemaVersion(value: unknown, path: string, expected: number): void {
  if (value !== expected) throw new ScenarioValidationError(path, 'unsupported schema version');
}

function uniqueIds(items: Record<string, unknown>[], path: string): void {
  const ids = new Set<string>();
  for (let index = 0; index < items.length; index += 1) {
    const id = identifierValue(items[index]?.id, `${path}[${index}].id`);
    if (ids.has(id))
      throw new ScenarioValidationError(`${path}[${index}].id`, 'duplicate identifier');
    ids.add(id);
  }
}

function validatePoint(value: unknown, path: string): void {
  const point = objectValue(value, path);
  numberValue(point.x, `${path}.x`);
  numberValue(point.y, `${path}.y`);
}

function validateBounds(value: unknown, path: string): Record<string, unknown> {
  const bounds = objectValue(value, path);
  numberValue(bounds.x, `${path}.x`);
  numberValue(bounds.y, `${path}.y`);
  numberValue(bounds.width, `${path}.width`, 0.01);
  numberValue(bounds.height, `${path}.height`, 0.01);
  return bounds;
}

function validateConstitution(value: unknown, path: string): void {
  const constitution = objectValue(value, path);
  numberValue(constitution.baselineArousal, `${path}.baselineArousal`, 0, 1);
  numberValue(constitution.habituationRate, `${path}.habituationRate`, 0, 1);
  numberValue(constitution.reactivity, `${path}.reactivity`, 0, 1);
  numberValue(constitution.recoveryRate, `${path}.recoveryRate`, 0, 1);
  numberValue(constitution.socialValence, `${path}.socialValence`, -1, 1);
  numberValue(constitution.threshold, `${path}.threshold`, 0, 1);
}

function validateCapabilities(value: unknown, path: string): void {
  const capabilities = objectValue(value, path);
  for (const capabilityId of CAPABILITY_IDS) {
    numberValue(capabilities[capabilityId], `${path}.${capabilityId}`, 0, 1);
  }
}

function validateSocialFeatures(value: unknown, path: string): void {
  const features = objectValue(value, path);
  for (const featureId of SOCIAL_FEATURE_IDS) {
    numberValue(features[featureId], `${path}.${featureId}`, 0, 1);
  }
}

function validateSocialFeatureWeights(value: unknown, path: string): void {
  const features = objectValue(value, path);
  for (const featureId of SOCIAL_FEATURE_IDS) {
    numberValue(features[featureId], `${path}.${featureId}`, 0, 4);
  }
}

function validateEmpathyEnvelope(value: unknown, path: string): void {
  const envelope = objectValue(value, path);
  const floor = numberValue(envelope.floor, `${path}.floor`, 0, 1);
  const ceiling = numberValue(envelope.ceiling, `${path}.ceiling`, 0, 1);
  if (ceiling < floor) {
    throw new ScenarioValidationError(`${path}.ceiling`, 'expected ceiling at or above floor');
  }
  numberValue(envelope.steepness, `${path}.steepness`, 0.01, 12);
  numberValue(envelope.selfPosition, `${path}.selfPosition`, 0, 1);
  numberValue(envelope.threatSensitivity, `${path}.threatSensitivity`, 0, 1);
  validateSocialFeatureWeights(envelope.featureWeights, `${path}.featureWeights`);
}

function validateDisclosureEnvelope(value: unknown, path: string): void {
  const envelope = objectValue(value, path);
  numberValue(envelope.intimateSafety, `${path}.intimateSafety`, 0, 1);
  numberValue(envelope.strangerSafety, `${path}.strangerSafety`, 0, 1);
  numberValue(envelope.troughDepth, `${path}.troughDepth`, 0, 1);
  numberValue(envelope.troughPosition, `${path}.troughPosition`, 0, 1);
  numberValue(envelope.troughWidth, `${path}.troughWidth`, 0.01, 1);
}

function validateValueDisposition(value: unknown, path: string): void {
  const disposition = objectValue(value, path);
  numberValue(disposition.initialCharge, `${path}.initialCharge`, -1, 1);
  numberValue(disposition.initialDeficit, `${path}.initialDeficit`, 0, 1);
  numberValue(disposition.initialVariance, `${path}.initialVariance`, 0, 1);
  numberValue(disposition.weight, `${path}.weight`, 0, 2);
}

function validateValueState(value: unknown, path: string): void {
  const state = objectValue(value, path);
  if (state.charge !== undefined) numberValue(state.charge, `${path}.charge`, -1, 1);
  if (state.deficitIntegral !== undefined) {
    numberValue(state.deficitIntegral, `${path}.deficitIntegral`, 0, 1);
  }
  if (state.variance !== undefined) numberValue(state.variance, `${path}.variance`, 0, 1);
}

function validateValueTurns(value: unknown, path: string): void {
  const turns = objectValue(value, path);
  for (const [valueId, turn] of Object.entries(turns)) {
    if (!VALUE_ID_SET.has(valueId)) {
      throw new ScenarioValidationError(`${path}.${valueId}`, 'expected a known value identifier');
    }
    numberValue(turn, `${path}.${valueId}`, -1, 1);
  }
}

function validateResourceCosts(value: unknown, path: string): void {
  const resources = objectValue(value, path);
  for (const [resourceId, cost] of Object.entries(resources)) {
    if (
      !['executiveBudget', 'physicalStamina', 'regulationReserve', 'socialBattery'].includes(
        resourceId,
      )
    ) {
      throw new ScenarioValidationError(`${path}.${resourceId}`, 'unknown resource');
    }
    numberValue(cost, `${path}.${resourceId}`, 0, 1);
  }
}

function validateFactConditions(value: unknown, path: string, requireOne: boolean): void {
  const conditions = arrayValue(value, path);
  if (requireOne && conditions.length === 0) {
    throw new ScenarioValidationError(path, 'expected at least one condition');
  }
  const factIds = new Set<string>();
  conditions.forEach((entry, index) => {
    const conditionPath = `${path}[${index}]`;
    const condition = objectValue(entry, conditionPath);
    const factId = identifierValue(condition.factId, `${conditionPath}.factId`);
    numberValue(condition.minimum, `${conditionPath}.minimum`, 0, 1_000_000);
    if (factIds.has(factId)) {
      throw new ScenarioValidationError(`${conditionPath}.factId`, 'duplicate fact condition');
    }
    factIds.add(factId);
  });
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function migrateCharacterLibrary(value: unknown): Record<string, unknown> {
  const file = clone(objectValue(value, 'characterLibrary'));
  if (file.schemaVersion === 4) return file;
  if (file.schemaVersion !== 1 && file.schemaVersion !== 2 && file.schemaVersion !== 3) {
    throw new ScenarioValidationError(
      'characterLibrary.schemaVersion',
      'unsupported schema version',
    );
  }
  const characters = arrayValue(file.characters, 'characterLibrary.characters');
  for (const value of characters) {
    const character = objectValue(value, 'characterLibrary.characters');
    if (file.schemaVersion === 1) {
      character.contractAdherence = 0.65;
      character.empathy = {
        ceiling: 1,
        featureWeights: {
          category: 0.6,
          familiarity: 1,
          kinship: 1,
          reciprocity: 0.8,
          similarity: 0.5,
        },
        floor: 0.22,
        selfPosition: 0,
        steepness: 3,
        threatSensitivity: 0.5,
      };
    }
    if (file.schemaVersion === 1 || file.schemaVersion === 2) {
      character.disclosure = {
        intimateSafety: 0.92,
        strangerSafety: 0.72,
        troughDepth: 0.58,
        troughPosition: 0.52,
        troughWidth: 0.2,
      };
    }
    character.capabilities = {
      acuity: 0.5,
      evidenceCalibration: 0.5,
      expressiveControl: 0.5,
    };
  }
  file.schemaVersion = 4;
  return file;
}

function migrateScenario(value: unknown): Record<string, unknown> {
  const file = clone(objectValue(value, 'scenario'));
  if (file.schemaVersion === 4) return file;
  if (file.schemaVersion !== 1 && file.schemaVersion !== 2 && file.schemaVersion !== 3) {
    throw new ScenarioValidationError('scenario.schemaVersion', 'unsupported schema version');
  }
  if (file.schemaVersion === 1 || file.schemaVersion === 2) {
    if (file.schemaVersion === 1) {
      file.behaviorOpportunities = [];
      file.socialRelations = [];
    }
    file.dyads = arrayValue(file.socialRelations, 'scenario.socialRelations').map(value => ({
      ...objectValue(value, 'scenario.socialRelations'),
      behaviorVariance: 0,
      estimateConfidence: 0.1,
      estimatedDisclosure: 0.5,
      estimatedEmpathy: 0.5,
      integratedHistory: 0,
      mode: 'courteous',
      predictionError: 0,
      stance: 0,
    }));
    delete file.socialRelations;
    file.disclosureItems = [];
    file.disclosureOpportunities = [];
  }
  file.agendaGoals = [];
  file.taskOperators = [];
  file.worldFacts = [];
  file.schemaVersion = 4;
  return file;
}

export function parseCharacterLibrary(value: unknown): CharacterLibraryFile {
  const file = migrateCharacterLibrary(value);
  schemaVersion(file.schemaVersion, 'characterLibrary.schemaVersion', 4);
  const characters = arrayValue(file.characters, 'characterLibrary.characters').map(
    (item, index) => {
      const path = `characterLibrary.characters[${index}]`;
      const character = objectValue(item, path);
      identifierValue(character.id, `${path}.id`);
      stringValue(character.name, `${path}.name`);
      stringValue(character.role, `${path}.role`);
      stringValue(character.summary, `${path}.summary`);
      validateCapabilities(character.capabilities, `${path}.capabilities`);
      validateConstitution(character.constitution, `${path}.constitution`);
      numberValue(character.contractAdherence, `${path}.contractAdherence`, 0, 1);
      validateDisclosureEnvelope(character.disclosure, `${path}.disclosure`);
      validateEmpathyEnvelope(character.empathy, `${path}.empathy`);

      const values = objectValue(character.values, `${path}.values`);
      for (const valueId of VALUE_IDS) {
        validateValueDisposition(values[valueId], `${path}.values.${valueId}`);
      }

      arrayValue(character.identity, `${path}.identity`).forEach((entry, identityIndex) => {
        const identityPath = `${path}.identity[${identityIndex}]`;
        const marker = objectValue(entry, identityPath);
        stringValue(marker.marker, `${identityPath}.marker`);
        numberValue(marker.centrality, `${identityPath}.centrality`, 0, 1);
      });

      arrayValue(character.narrativeClaims, `${path}.narrativeClaims`).forEach(
        (claim, claimIndex) => {
          stringValue(claim, `${path}.narrativeClaims[${claimIndex}]`);
        },
      );

      arrayValue(character.formativeEvents, `${path}.formativeEvents`).forEach(
        (entry, eventIndex) => {
          const eventPath = `${path}.formativeEvents[${eventIndex}]`;
          const event = objectValue(entry, eventPath);
          integerValue(event.age, `${eventPath}.age`, 0, 120);
          if (event.attribution !== null)
            stringValue(event.attribution, `${eventPath}.attribution`);
          numberValue(event.copingPotential, `${eventPath}.copingPotential`, 0, 1);
          stringValue(event.summary, `${eventPath}.summary`);
          numberValue(event.turn, `${eventPath}.turn`, -1, 1);
          if (typeof event.value !== 'string' || !VALUE_ID_SET.has(event.value)) {
            throw new ScenarioValidationError(
              `${eventPath}.value`,
              'expected a known value identifier',
            );
          }
        },
      );
      return character;
    },
  );
  uniqueIds(characters, 'characterLibrary.characters');
  return clone(file) as unknown as CharacterLibraryFile;
}

export function parseEnvironmentLibrary(value: unknown): EnvironmentLibraryFile {
  const file = objectValue(value, 'environmentLibrary');
  schemaVersion(file.schemaVersion, 'environmentLibrary.schemaVersion', 1);
  const environments = arrayValue(file.environments, 'environmentLibrary.environments').map(
    (item, index) => {
      const path = `environmentLibrary.environments[${index}]`;
      const environment = objectValue(item, path);
      identifierValue(environment.id, `${path}.id`);
      stringValue(environment.name, `${path}.name`);
      numberValue(environment.width, `${path}.width`, 1);
      numberValue(environment.height, `${path}.height`, 1);

      const areas = arrayValue(environment.areas, `${path}.areas`).map((entry, areaIndex) => {
        const areaPath = `${path}.areas[${areaIndex}]`;
        const area = validateBounds(entry, areaPath);
        identifierValue(area.id, `${areaPath}.id`);
        if (typeof area.kind !== 'string' || !AREA_KINDS.has(area.kind as AreaKind)) {
          throw new ScenarioValidationError(`${areaPath}.kind`, 'expected a known area kind');
        }
        if (area.label !== undefined) stringValue(area.label, `${areaPath}.label`);
        return area;
      });
      uniqueIds(areas, `${path}.areas`);

      const locations = arrayValue(environment.locations, `${path}.locations`).map(
        (entry, locationIndex) => {
          const locationPath = `${path}.locations[${locationIndex}]`;
          const location = validateBounds(entry, locationPath);
          identifierValue(location.id, `${locationPath}.id`);
          stringValue(location.kind, `${locationPath}.kind`);
          stringValue(location.name, `${locationPath}.name`);
          return location;
        },
      );
      uniqueIds(locations, `${path}.locations`);
      return environment;
    },
  );
  uniqueIds(environments, 'environmentLibrary.environments');
  return clone(file) as unknown as EnvironmentLibraryFile;
}

export function parseScenario(value: unknown): ScenarioFile {
  const file = migrateScenario(value);
  schemaVersion(file.schemaVersion, 'scenario.schemaVersion', 4);
  identifierValue(file.id, 'scenario.id');
  stringValue(file.title, 'scenario.title');
  stringValue(file.summary, 'scenario.summary');
  identifierValue(file.environmentId, 'scenario.environmentId');
  integerValue(file.startMinute, 'scenario.startMinute', 0, Number.MAX_SAFE_INTEGER);
  integerValue(file.tickMinutes, 'scenario.tickMinutes', 1, 1440);

  if (file.ambientTurnsPerHour !== undefined) {
    const turns = objectValue(file.ambientTurnsPerHour, 'scenario.ambientTurnsPerHour');
    for (const [valueId, turn] of Object.entries(turns)) {
      if (!VALUE_ID_SET.has(valueId)) {
        throw new ScenarioValidationError(
          `scenario.ambientTurnsPerHour.${valueId}`,
          'expected a known value identifier',
        );
      }
      numberValue(turn, `scenario.ambientTurnsPerHour.${valueId}`, -1, 1);
    }
  }

  const worldFacts = arrayValue(file.worldFacts, 'scenario.worldFacts').map((entry, index) => {
    const path = `scenario.worldFacts[${index}]`;
    const fact = objectValue(entry, path);
    identifierValue(fact.id, `${path}.id`);
    numberValue(fact.amount, `${path}.amount`, 0, 1_000_000);
    return fact;
  });
  uniqueIds(worldFacts, 'scenario.worldFacts');

  const agendaGoals = arrayValue(file.agendaGoals, 'scenario.agendaGoals').map((entry, index) => {
    const path = `scenario.agendaGoals[${index}]`;
    const goal = objectValue(entry, path);
    identifierValue(goal.id, `${path}.id`);
    identifierValue(goal.actorId, `${path}.actorId`);
    stringValue(goal.label, `${path}.label`);
    if (typeof goal.source !== 'string' || !GOAL_SOURCES.has(goal.source)) {
      throw new ScenarioValidationError(`${path}.source`, 'expected a known goal source');
    }
    numberValue(goal.commitment, `${path}.commitment`, 0, 1);
    const activationMinute = integerValue(
      goal.activationMinute,
      `${path}.activationMinute`,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    if (goal.deadlineMinute !== null) {
      const deadlineMinute = integerValue(
        goal.deadlineMinute,
        `${path}.deadlineMinute`,
        0,
        Number.MAX_SAFE_INTEGER,
      );
      if (deadlineMinute <= activationMinute) {
        throw new ScenarioValidationError(
          `${path}.deadlineMinute`,
          'expected a deadline after activation',
        );
      }
    }
    integerValue(goal.urgencyHorizonMinutes, `${path}.urgencyHorizonMinutes`, 1, 100_000);
    validateFactConditions(goal.desired, `${path}.desired`, true);
    validateValueTurns(goal.successTurns, `${path}.successTurns`);
    validateValueTurns(goal.failureTurns, `${path}.failureTurns`);
    return goal;
  });
  uniqueIds(agendaGoals, 'scenario.agendaGoals');

  const taskOperators = arrayValue(file.taskOperators, 'scenario.taskOperators').map(
    (entry, index) => {
      const path = `scenario.taskOperators[${index}]`;
      const task = objectValue(entry, path);
      identifierValue(task.id, `${path}.id`);
      stringValue(task.label, `${path}.label`);
      identifierValue(task.locationId, `${path}.locationId`);
      integerValue(task.durationMinutes, `${path}.durationMinutes`, 1, 100_000);
      numberValue(task.contractViolation, `${path}.contractViolation`, 0, 1);
      if (task.availableFromMinute !== null) {
        integerValue(
          task.availableFromMinute,
          `${path}.availableFromMinute`,
          0,
          Number.MAX_SAFE_INTEGER,
        );
      }
      if (task.availableUntilMinute !== null) {
        const availableUntilMinute = integerValue(
          task.availableUntilMinute,
          `${path}.availableUntilMinute`,
          0,
          Number.MAX_SAFE_INTEGER,
        );
        if (
          task.availableFromMinute !== null &&
          availableUntilMinute <= (task.availableFromMinute as number)
        ) {
          throw new ScenarioValidationError(
            `${path}.availableUntilMinute`,
            'expected the window to close after it opens',
          );
        }
      }
      const actorIds = arrayValue(task.actorIds, `${path}.actorIds`);
      if (actorIds.length === 0) {
        throw new ScenarioValidationError(`${path}.actorIds`, 'expected at least one actor');
      }
      actorIds.forEach((actorId, actorIndex) => {
        identifierValue(actorId, `${path}.actorIds[${actorIndex}]`);
      });
      if (new Set(actorIds).size !== actorIds.length) {
        throw new ScenarioValidationError(`${path}.actorIds`, 'duplicate actor identifier');
      }
      validateFactConditions(task.preconditions, `${path}.preconditions`, false);
      const effects = arrayValue(task.effects, `${path}.effects`);
      if (effects.length === 0) {
        throw new ScenarioValidationError(`${path}.effects`, 'expected at least one effect');
      }
      const effectFactIds = new Set<string>();
      effects.forEach((effectEntry, effectIndex) => {
        const effectPath = `${path}.effects[${effectIndex}]`;
        const effect = objectValue(effectEntry, effectPath);
        const factId = identifierValue(effect.factId, `${effectPath}.factId`);
        const delta = numberValue(effect.delta, `${effectPath}.delta`, -1_000_000, 1_000_000);
        if (delta === 0) {
          throw new ScenarioValidationError(`${effectPath}.delta`, 'expected a non-zero effect');
        }
        if (effectFactIds.has(factId)) {
          throw new ScenarioValidationError(`${effectPath}.factId`, 'duplicate fact effect');
        }
        effectFactIds.add(factId);
      });
      validateResourceCosts(task.resourceCosts, `${path}.resourceCosts`);
      validateValueTurns(task.valueTurns, `${path}.valueTurns`);
      return task;
    },
  );
  uniqueIds(taskOperators, 'scenario.taskOperators');

  const characters = arrayValue(file.characters, 'scenario.characters').map((item, index) => {
    const path = `scenario.characters[${index}]`;
    const placement = objectValue(item, path);
    identifierValue(placement.instanceId, `${path}.instanceId`);
    identifierValue(placement.characterId, `${path}.characterId`);
    validatePoint(placement.position, `${path}.position`);
    if (placement.walkingMetersPerMinute !== undefined) {
      numberValue(placement.walkingMetersPerMinute, `${path}.walkingMetersPerMinute`, 0.1, 500);
    }

    if (placement.initialResources !== undefined) {
      const resources = objectValue(placement.initialResources, `${path}.initialResources`);
      for (const [key, resource] of Object.entries(resources)) {
        if (
          !['executiveBudget', 'physicalStamina', 'regulationReserve', 'socialBattery'].includes(
            key,
          )
        ) {
          throw new ScenarioValidationError(`${path}.initialResources.${key}`, 'unknown resource');
        }
        numberValue(resource, `${path}.initialResources.${key}`, 0, 1);
      }
    }

    if (placement.initialValues !== undefined) {
      const values = objectValue(placement.initialValues, `${path}.initialValues`);
      for (const [valueId, state] of Object.entries(values)) {
        if (!VALUE_ID_SET.has(valueId)) {
          throw new ScenarioValidationError(`${path}.initialValues.${valueId}`, 'unknown value');
        }
        validateValueState(state, `${path}.initialValues.${valueId}`);
      }
    }

    const schedule = arrayValue(placement.schedule, `${path}.schedule`).map(
      (entry, scheduleIndex) => {
        const schedulePath = `${path}.schedule[${scheduleIndex}]`;
        const block = objectValue(entry, schedulePath);
        integerValue(block.startMinute, `${schedulePath}.startMinute`, 0, 1439);
        identifierValue(block.locationId, `${schedulePath}.locationId`);
        stringValue(block.activity, `${schedulePath}.activity`);
        return block;
      },
    );
    if (schedule.length === 0) {
      throw new ScenarioValidationError(`${path}.schedule`, 'expected at least one block');
    }
    for (let scheduleIndex = 1; scheduleIndex < schedule.length; scheduleIndex += 1) {
      const previous = schedule[scheduleIndex - 1];
      const current = schedule[scheduleIndex];
      if (
        previous === undefined ||
        current === undefined ||
        (previous.startMinute as number) >= (current.startMinute as number)
      ) {
        throw new ScenarioValidationError(
          `${path}.schedule[${scheduleIndex}].startMinute`,
          'schedule blocks must be ordered with unique start times',
        );
      }
    }
    return { ...placement, id: placement.instanceId };
  });
  uniqueIds(characters, 'scenario.characters');

  const dyads = arrayValue(file.dyads, 'scenario.dyads').map((entry, index) => {
    const path = `scenario.dyads[${index}]`;
    const dyad = objectValue(entry, path);
    identifierValue(dyad.observerId, `${path}.observerId`);
    identifierValue(dyad.subjectId, `${path}.subjectId`);
    validateSocialFeatures(dyad.features, `${path}.features`);
    numberValue(dyad.stance, `${path}.stance`, -1, 1);
    numberValue(dyad.integratedHistory, `${path}.integratedHistory`, -1, 1);
    numberValue(dyad.behaviorVariance, `${path}.behaviorVariance`, 0, 1);
    numberValue(dyad.estimatedEmpathy, `${path}.estimatedEmpathy`, 0, 1);
    numberValue(dyad.estimatedDisclosure, `${path}.estimatedDisclosure`, 0, 1);
    numberValue(dyad.estimateConfidence, `${path}.estimateConfidence`, 0, 1);
    numberValue(dyad.predictionError, `${path}.predictionError`, 0, 1);
    if (typeof dyad.mode !== 'string' || !DYAD_MODES.has(dyad.mode)) {
      throw new ScenarioValidationError(`${path}.mode`, 'expected a known dyad mode');
    }
    return { ...dyad, id: `dyad-${dyad.observerId}-${dyad.subjectId}` };
  });
  uniqueIds(dyads, 'scenario.dyads');

  const disclosureItems = arrayValue(file.disclosureItems, 'scenario.disclosureItems').map(
    (entry, index) => {
      const path = `scenario.disclosureItems[${index}]`;
      const item = objectValue(entry, path);
      identifierValue(item.id, `${path}.id`);
      identifierValue(item.ownerId, `${path}.ownerId`);
      stringValue(item.summary, `${path}.summary`);
      numberValue(item.shameCharge, `${path}.shameCharge`, 0, 1);
      arrayValue(item.knownByIds, `${path}.knownByIds`).forEach((agentId, agentIndex) => {
        identifierValue(agentId, `${path}.knownByIds[${agentIndex}]`);
      });
      return item;
    },
  );
  uniqueIds(disclosureItems, 'scenario.disclosureItems');

  const disclosureOpportunities = arrayValue(
    file.disclosureOpportunities,
    'scenario.disclosureOpportunities',
  ).map((entry, index) => {
    const path = `scenario.disclosureOpportunities[${index}]`;
    const opportunity = objectValue(entry, path);
    identifierValue(opportunity.id, `${path}.id`);
    identifierValue(opportunity.ownerId, `${path}.ownerId`);
    identifierValue(opportunity.itemId, `${path}.itemId`);
    integerValue(opportunity.atMinute, `${path}.atMinute`, 0, Number.MAX_SAFE_INTEGER);
    numberValue(opportunity.disclosureBenefit, `${path}.disclosureBenefit`, 0, 4);
    numberValue(opportunity.networkConductivity, `${path}.networkConductivity`, 0, 1);
    const audiences = arrayValue(opportunity.audienceIds, `${path}.audienceIds`);
    if (audiences.length === 0) {
      throw new ScenarioValidationError(`${path}.audienceIds`, 'expected at least one audience');
    }
    audiences.forEach((agentId, agentIndex) => {
      identifierValue(agentId, `${path}.audienceIds[${agentIndex}]`);
    });
    if (new Set(audiences).size !== audiences.length) {
      throw new ScenarioValidationError(`${path}.audienceIds`, 'duplicate agent identifier');
    }
    return opportunity;
  });
  uniqueIds(disclosureOpportunities, 'scenario.disclosureOpportunities');

  const opportunities = arrayValue(
    file.behaviorOpportunities,
    'scenario.behaviorOpportunities',
  ).map((entry, index) => {
    const path = `scenario.behaviorOpportunities[${index}]`;
    const opportunity = objectValue(entry, path);
    identifierValue(opportunity.id, `${path}.id`);
    identifierValue(opportunity.actorId, `${path}.actorId`);
    if (opportunity.targetId !== null) identifierValue(opportunity.targetId, `${path}.targetId`);
    integerValue(opportunity.atMinute, `${path}.atMinute`, 0, Number.MAX_SAFE_INTEGER);

    const contextPath = `${path}.context`;
    const context = objectValue(opportunity.context, contextPath);
    numberValue(context.enforcementPresence, `${contextPath}.enforcementPresence`, 0, 1);
    numberValue(context.networkConductivity, `${contextPath}.networkConductivity`, 0, 1);
    numberValue(context.perceivedThreat, `${contextPath}.perceivedThreat`, 0, 1);
    arrayValue(context.witnessIds, `${contextPath}.witnessIds`).forEach(
      (witnessId, witnessIndex) => {
        identifierValue(witnessId, `${contextPath}.witnessIds[${witnessIndex}]`);
      },
    );

    const candidates = arrayValue(opportunity.candidates, `${path}.candidates`).map(
      (candidateEntry, candidateIndex) => {
        const candidatePath = `${path}.candidates[${candidateIndex}]`;
        const candidate = objectValue(candidateEntry, candidatePath);
        identifierValue(candidate.id, `${candidatePath}.id`);
        stringValue(candidate.label, `${candidatePath}.label`);
        identifierValue(candidate.operation, `${candidatePath}.operation`);
        numberValue(candidate.contractViolation, `${candidatePath}.contractViolation`, 0, 1);
        numberValue(candidate.narrativeExpression, `${candidatePath}.narrativeExpression`, -2, 2);
        numberValue(candidate.repercussionSeverity, `${candidatePath}.repercussionSeverity`, 0, 4);
        arrayValue(candidate.impacts, `${candidatePath}.impacts`).forEach(
          (impactEntry, impactIndex) => {
            const impactPath = `${candidatePath}.impacts[${impactIndex}]`;
            const impact = objectValue(impactEntry, impactPath);
            identifierValue(impact.subjectId, `${impactPath}.subjectId`);
            const turns = objectValue(impact.turns, `${impactPath}.turns`);
            for (const [valueId, turn] of Object.entries(turns)) {
              if (!VALUE_ID_SET.has(valueId)) {
                throw new ScenarioValidationError(
                  `${impactPath}.turns.${valueId}`,
                  'unknown value',
                );
              }
              numberValue(turn, `${impactPath}.turns.${valueId}`, -1, 1);
            }
          },
        );
        return candidate;
      },
    );
    if (candidates.length === 0) {
      throw new ScenarioValidationError(`${path}.candidates`, 'expected at least one candidate');
    }
    uniqueIds(candidates, `${path}.candidates`);
    return opportunity;
  });
  uniqueIds(opportunities, 'scenario.behaviorOpportunities');
  return clone(file) as unknown as ScenarioFile;
}

export function isValueId(value: string): value is ValueId {
  return VALUE_ID_SET.has(value);
}
