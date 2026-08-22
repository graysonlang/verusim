import {
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

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function migrateCharacterLibrary(value: unknown): Record<string, unknown> {
  const file = clone(objectValue(value, 'characterLibrary'));
  if (file.schemaVersion === 2) return file;
  if (file.schemaVersion !== 1) {
    throw new ScenarioValidationError(
      'characterLibrary.schemaVersion',
      'unsupported schema version',
    );
  }
  const characters = arrayValue(file.characters, 'characterLibrary.characters');
  for (const value of characters) {
    const character = objectValue(value, 'characterLibrary.characters');
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
  file.schemaVersion = 2;
  return file;
}

function migrateScenario(value: unknown): Record<string, unknown> {
  const file = clone(objectValue(value, 'scenario'));
  if (file.schemaVersion === 2) return file;
  if (file.schemaVersion !== 1) {
    throw new ScenarioValidationError('scenario.schemaVersion', 'unsupported schema version');
  }
  file.behaviorOpportunities = [];
  file.socialRelations = [];
  file.schemaVersion = 2;
  return file;
}

export function parseCharacterLibrary(value: unknown): CharacterLibraryFile {
  const file = migrateCharacterLibrary(value);
  schemaVersion(file.schemaVersion, 'characterLibrary.schemaVersion', 2);
  const characters = arrayValue(file.characters, 'characterLibrary.characters').map(
    (item, index) => {
      const path = `characterLibrary.characters[${index}]`;
      const character = objectValue(item, path);
      identifierValue(character.id, `${path}.id`);
      stringValue(character.name, `${path}.name`);
      stringValue(character.role, `${path}.role`);
      stringValue(character.summary, `${path}.summary`);
      validateConstitution(character.constitution, `${path}.constitution`);
      numberValue(character.contractAdherence, `${path}.contractAdherence`, 0, 1);
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
  schemaVersion(file.schemaVersion, 'scenario.schemaVersion', 2);
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

  const relations = arrayValue(file.socialRelations, 'scenario.socialRelations').map(
    (entry, index) => {
      const path = `scenario.socialRelations[${index}]`;
      const relation = objectValue(entry, path);
      identifierValue(relation.observerId, `${path}.observerId`);
      identifierValue(relation.subjectId, `${path}.subjectId`);
      validateSocialFeatures(relation.features, `${path}.features`);
      return { ...relation, id: `relation-${relation.observerId}-${relation.subjectId}` };
    },
  );
  uniqueIds(relations, 'scenario.socialRelations');

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
