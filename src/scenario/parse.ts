import {
  CAPABILITY_IDS,
  HEIGHT_CLASSES,
  INCIDENT_ROOT_IMPACTS,
  MIND_MODEL_DIMENSIONS,
  OBSERVATION_CHANNELS,
  OUTLET_OPERATIONS,
  RESOURCE_KINDS,
  SEASON_IDS,
  SEX_IDS,
  SOCIAL_CONTRACT_SCOPE_KINDS,
  SOCIAL_FEATURE_IDS,
  TIME_RATE_IDS,
  VALUE_IDS,
  WEATHER_IDS,
  WEIGHT_CLASSES,
  type AreaKind,
  type CharacterProfileAddress,
  type CharacterProfileResourceFile,
  type CharacterLibraryFile,
  type EnvironmentLayoutAddress,
  type EnvironmentLayoutResourceFile,
  type EnvironmentLibraryFile,
  type EnvironmentConnectorKind,
  type NormAddress,
  type NormResourceFile,
  type RecoveryMode,
  type ResourceAddress,
  type ResourceFile,
  type ResourceKind,
  type ScenarioFile,
  type SocialContractAddress,
  type SocialContractResourceFile,
  type ValueId,
} from '../model/types.js';
import { ScenarioValidationError } from '../model/validation.js';
import {
  arrayValue,
  clone,
  identifierValue,
  integerValue,
  knownKeys,
  legacyRecoveryMode,
  numberValue,
  objectValue,
  stringValue,
  validateLayerPosition,
  renameKeysDeep,
} from './primitives.js';

export { ScenarioValidationError } from '../model/validation.js';

const AREA_KINDS = new Set<AreaKind>([
  'building',
  'field',
  'forest',
  'grass',
  'market',
  'path',
  'water',
]);
const ENVIRONMENT_CONNECTOR_KINDS = new Set<EnvironmentConnectorKind>(['ladder', 'ramp', 'stairs']);
const VALUE_ID_SET = new Set<string>(VALUE_IDS);
const DYAD_MODES = new Set(['courteous', 'contesting', 'guarded', 'ruptured', 'warm']);
const GOAL_SOURCES = new Set(['aspiration', 'need', 'obligation', 'scenario', 'want']);
const RECOVERY_MODES = new Set<RecoveryMode>(['break', 'none', 'rest', 'sleep']);
const TIME_RATE_ID_SET = new Set<string>(TIME_RATE_IDS);
const HEIGHT_CLASS_SET = new Set<string>(HEIGHT_CLASSES);
const INCIDENT_ROOT_IMPACT_SET = new Set<string>(INCIDENT_ROOT_IMPACTS);
const INCIDENT_ATTRIBUTIONS = new Set(['ambiguous', 'nobody', 'other', 'self']);
const INCIDENT_PUBLICITY = new Set(['private', 'public', 'witnessed']);
const INCIDENT_VOLITIONS = new Set(['careless', 'deliberate', 'involuntary']);
const MIND_MODEL_DIMENSION_SET = new Set<string>(MIND_MODEL_DIMENSIONS);
const OBSERVATION_CHANNEL_SET = new Set<string>(OBSERVATION_CHANNELS);
const OUTLET_OPERATION_SET = new Set<string>(OUTLET_OPERATIONS);
const REINFORCEMENT_SCHEDULES = new Set(['fixed', 'variable-ratio']);
const SATISFIER_TYPES = new Set(['deficit', 'surplus']);
const SOMATIC_CADENCES = new Set(['fluctuating', 'steady']);
const SOMATIC_ORIGINS = new Set(['activity', 'environment', 'event']);
const SOMATIC_PREEMPTIONS = new Set(['dead', 'emergency', 'incapacitated', 'none']);
const AGENCY_MODES = new Set(['invoker', 'responder']);
const NARRATIVE_CLAIM_KINDS = new Set(['affirm', 'deny', 'deserve']);
const RESOURCE_KIND_SET = new Set<string>(RESOURCE_KINDS);
const SEASON_ID_SET = new Set<string>(SEASON_IDS);
const SEX_ID_SET = new Set<string>(SEX_IDS);
const SOCIAL_CONTRACT_SCOPE_KIND_SET = new Set<string>(SOCIAL_CONTRACT_SCOPE_KINDS);
const WEATHER_ID_SET = new Set<string>(WEATHER_IDS);
const WEIGHT_CLASS_SET = new Set<string>(WEIGHT_CLASSES);
export const DEFAULT_RESOURCE_PACKAGE_ID = 'verusim';

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

function uniqueIdentifierField(
  items: Record<string, unknown>[],
  path: string,
  field: string,
): void {
  const ids = new Set<string>();
  for (let index = 0; index < items.length; index += 1) {
    const id = identifierValue(items[index]?.[field], `${path}[${index}].${field}`);
    if (ids.has(id)) {
      throw new ScenarioValidationError(`${path}[${index}].${field}`, 'duplicate identifier');
    }
    ids.add(id);
  }
}

export function parseResourceAddress(
  value: unknown,
  path: string,
  expectedKind?: ResourceKind,
): ResourceAddress {
  const address = objectValue(value, path);
  const packageId = identifierValue(address.packageId, `${path}.packageId`);
  const resourceId = identifierValue(address.resourceId, `${path}.resourceId`);
  if (typeof address.kind !== 'string' || !RESOURCE_KIND_SET.has(address.kind)) {
    throw new ScenarioValidationError(`${path}.kind`, 'expected a known resource kind');
  }
  if (expectedKind !== undefined && address.kind !== expectedKind) {
    throw new ScenarioValidationError(`${path}.kind`, `expected ${expectedKind}`);
  }
  return { kind: address.kind as ResourceKind, packageId, resourceId };
}

export function resourceAddressKey(address: ResourceAddress): string {
  return `${address.packageId}:${address.kind}:${address.resourceId}`;
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

function validatePhysicalProfile(value: unknown, path: string): number {
  const physical = objectValue(value, path);
  const ageYears = integerValue(physical.ageYears, `${path}.ageYears`, 0, 130);
  const build = objectValue(physical.build, `${path}.build`);
  if (typeof build.heightClass !== 'string' || !HEIGHT_CLASS_SET.has(build.heightClass)) {
    throw new ScenarioValidationError(`${path}.build.heightClass`, 'expected a known height class');
  }
  if (typeof build.weightClass !== 'string' || !WEIGHT_CLASS_SET.has(build.weightClass)) {
    throw new ScenarioValidationError(`${path}.build.weightClass`, 'expected a known weight class');
  }
  numberValue(physical.comeliness, `${path}.comeliness`, 0, 1);
  if (typeof physical.sex !== 'string' || !SEX_ID_SET.has(physical.sex)) {
    throw new ScenarioValidationError(`${path}.sex`, 'expected a known sex identifier');
  }
  return ageYears;
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

function validateClaimExpressions(value: unknown, path: string): void {
  const claimIds = new Set<string>();
  arrayValue(value, path).forEach((entry, index) => {
    const expressionPath = `${path}[${index}]`;
    const expression = objectValue(entry, expressionPath);
    const claimId = identifierValue(expression.claimId, `${expressionPath}.claimId`);
    if (claimIds.has(claimId)) {
      throw new ScenarioValidationError(`${expressionPath}.claimId`, 'duplicate claim expression');
    }
    claimIds.add(claimId);
    if (typeof expression.valueId !== 'string' || !VALUE_ID_SET.has(expression.valueId)) {
      throw new ScenarioValidationError(
        `${expressionPath}.valueId`,
        'expected a known value identifier',
      );
    }
    numberValue(expression.strength, `${expressionPath}.strength`, -1, 1);
  });
}

function validateNonzeroValueTurns(value: unknown, path: string): void {
  validateValueTurns(value, path);
  const turns = objectValue(value, path);
  if (!Object.values(turns).some(turn => turn !== 0)) {
    throw new ScenarioValidationError(path, 'expected at least one non-zero value turn');
  }
}

function validateNormDefinition(value: unknown, path: string): Record<string, unknown> {
  const norm = objectValue(value, path);
  stringValue(norm.label, `${path}.label`);
  validateValueTurns(norm.compatibilityTurns, `${path}.compatibilityTurns`);
  const interpretations = arrayValue(norm.interpretations, `${path}.interpretations`);
  if (interpretations.length === 0) {
    throw new ScenarioValidationError(`${path}.interpretations`, 'expected at least one entry');
  }
  const rootImpacts = new Set<string>();
  interpretations.forEach((entry, index) => {
    const entryPath = `${path}.interpretations[${index}]`;
    const interpretation = objectValue(entry, entryPath);
    if (
      typeof interpretation.rootImpact !== 'string' ||
      !INCIDENT_ROOT_IMPACT_SET.has(interpretation.rootImpact)
    ) {
      throw new ScenarioValidationError(
        `${entryPath}.rootImpact`,
        'expected a known incident root impact',
      );
    }
    if (rootImpacts.has(interpretation.rootImpact)) {
      throw new ScenarioValidationError(`${entryPath}.rootImpact`, 'duplicate root impact');
    }
    rootImpacts.add(interpretation.rootImpact);
    const identityStake = numberValue(
      interpretation.identityStake,
      `${entryPath}.identityStake`,
      0,
      1,
    );
    validateValueTurns(interpretation.turns, `${entryPath}.turns`);
    if (
      identityStake === 0 &&
      !Object.values(objectValue(interpretation.turns, `${entryPath}.turns`)).some(
        turn => turn !== 0,
      )
    ) {
      throw new ScenarioValidationError(entryPath, 'expected turns or an identity stake');
    }
  });
  return norm;
}

function validateSocialContractDefinition(value: unknown, path: string): Record<string, unknown> {
  const contract = objectValue(value, path);
  stringValue(contract.label, `${path}.label`);
  stringValue(contract.summary, `${path}.summary`);
  numberValue(contract.enforcementSeverity, `${path}.enforcementSeverity`, 0, 1);
  const norms = arrayValue(contract.norms, `${path}.norms`);
  if (norms.length === 0) {
    throw new ScenarioValidationError(`${path}.norms`, 'expected at least one norm');
  }
  const normKeys = new Set<string>();
  norms.forEach((norm, index) => {
    const address = parseResourceAddress(norm, `${path}.norms[${index}]`, 'norm');
    const key = resourceAddressKey(address);
    if (normKeys.has(key)) {
      throw new ScenarioValidationError(`${path}.norms[${index}]`, 'duplicate norm reference');
    }
    normKeys.add(key);
  });
  return contract;
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

function validateSomaticSource(
  value: unknown,
  path: string,
  expectedOrigin?: 'activity' | 'environment' | 'event',
): Record<string, unknown> {
  const source = objectValue(value, path);
  identifierValue(source.id, `${path}.id`);
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
  if (expectedOrigin !== undefined && source.origin !== expectedOrigin) {
    throw new ScenarioValidationError(`${path}.origin`, `expected ${expectedOrigin}`);
  }
  if (typeof source.preemption !== 'string' || !SOMATIC_PREEMPTIONS.has(source.preemption)) {
    throw new ScenarioValidationError(
      `${path}.preemption`,
      'expected dead, emergency, incapacitated, or none',
    );
  }
  return source;
}

function validateSomaticSources(
  value: unknown,
  path: string,
  expectedOrigin?: 'activity' | 'environment' | 'event',
): void {
  const sources = arrayValue(value, path).map((entry, index) =>
    validateSomaticSource(entry, `${path}[${index}]`, expectedOrigin),
  );
  uniqueIds(sources, path);
}

function validateMaskingDemand(value: unknown, path: string): void {
  if (value === null) return;
  const demand = objectValue(value, path);
  numberValue(demand.presentationGap, `${path}.presentationGap`, 0, 1);
  numberValue(demand.exposureRisk, `${path}.exposureRisk`, 0, 1);
  integerValue(demand.audienceCount, `${path}.audienceCount`, 0, 10_000);
  if (typeof demand.fabricated !== 'boolean') {
    throw new ScenarioValidationError(`${path}.fabricated`, 'expected a boolean');
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

function eachObject(
  value: unknown,
  path: string,
  visit: (item: Record<string, unknown>, itemPath: string) => void,
): void {
  for (const [index, item] of arrayValue(value, path).entries()) {
    const itemPath = `${path}[${index}]`;
    visit(objectValue(item, itemPath), itemPath);
  }
}

function migrateCharacterLibrary(value: unknown): Record<string, unknown> {
  const file = clone(objectValue(value, 'characterLibrary'));
  if (file.schemaVersion === 7) {
    eachObject(file.characters, 'characterLibrary.characters', character => {
      character.profileId ??= character.id;
      character.characterId ??= character.profileId;
      delete character.id;
    });
    return file;
  }
  if (
    file.schemaVersion !== 1 &&
    file.schemaVersion !== 2 &&
    file.schemaVersion !== 3 &&
    file.schemaVersion !== 4 &&
    file.schemaVersion !== 5 &&
    file.schemaVersion !== 6
  ) {
    throw new ScenarioValidationError(
      'characterLibrary.schemaVersion',
      'unsupported schema version',
    );
  }
  const sourceVersion = file.schemaVersion;
  eachObject(file.characters, 'characterLibrary.characters', (character, characterPath) => {
    character.profileId ??= character.id;
    character.characterId ??= character.profileId;
    delete character.id;
    if (sourceVersion === 1) {
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
    if (sourceVersion === 1 || sourceVersion === 2) {
      character.disclosure = {
        intimateSafety: 0.92,
        strangerSafety: 0.72,
        troughDepth: 0.58,
        troughPosition: 0.52,
        troughWidth: 0.2,
      };
    }
    if (sourceVersion < 4) {
      character.capabilities = {
        acuity: 0.5,
        evidenceCalibration: 0.5,
        expressiveControl: 0.5,
      };
    }
    if (sourceVersion < 5) {
      const latestFormativeAge = Array.isArray(character.formativeEvents)
        ? character.formativeEvents.reduce((latest, event) => {
            if (typeof event !== 'object' || event === null || Array.isArray(event)) return latest;
            const age = (event as Record<string, unknown>).age;
            return typeof age === 'number' && Number.isFinite(age) ? Math.max(latest, age) : latest;
          }, 0)
        : 0;
      character.physical = {
        ageYears: Math.min(130, Math.max(30, latestFormativeAge + 10)),
        build: { heightClass: 'average', weightClass: 'average' },
        comeliness: 0.5,
        sex: 'unspecified',
      };
    }
    character.cascadePriors ??= {
      fawn: 0.5,
      fight: 0.5,
      flight: 0.5,
      flop: 0.5,
      freeze: 0.5,
    };
    character.outletPreferences ??= OUTLET_OPERATIONS.map((operation, index) => ({
      operation,
      rank: 1 - index * 0.1,
    }));
    character.satisfierPreferences ??= [];
    character.narrativeClaims = arrayValue(
      character.narrativeClaims,
      `${characterPath}.narrativeClaims`,
    ).map((claim, index) => {
      if (typeof claim !== 'string') return claim;
      const normalized = claim.toLowerCase();
      return {
        commitment: 0.7,
        confidence: 0.65,
        id: `claim-${index + 1}`,
        kind: normalized.includes('deserve')
          ? 'deserve'
          : normalized.includes(' not ') || normalized.startsWith('not ')
            ? 'deny'
            : 'affirm',
        statement: claim,
      };
    });
  });
  file.schemaVersion = 7;
  return file;
}

function legacyAreaDefaults(area: Record<string, unknown>): void {
  area.enclosure ??= area.kind === 'building' ? 'interior' : 'exterior';
  area.cover ??=
    area.kind === 'building'
      ? { hearingOcclusion: 0.7, overhead: 1, sightOcclusion: 1 }
      : area.kind === 'forest'
        ? { hearingOcclusion: 0.12, overhead: 0.65, sightOcclusion: 0.92 }
        : { hearingOcclusion: 0, overhead: 0, sightOcclusion: 0 };
}

function migrateEnvironmentLibrary(value: unknown): Record<string, unknown> {
  const file = clone(objectValue(value, 'environmentLibrary'));
  if (file.schemaVersion === 2 || file.schemaVersion === 3) {
    eachObject(
      file.environments,
      'environmentLibrary.environments',
      (environment, environmentPath) => {
        environment.layoutId ??= environment.id;
        environment.environmentId ??= environment.layoutId;
        delete environment.id;
        environment.layers ??= [{ elevationMeters: 0, id: 'surface', name: 'Surface' }];
        environment.connectors ??= [];
        eachObject(environment.areas, `${environmentPath}.areas`, area => {
          area.layerId ??= 'surface';
          legacyAreaDefaults(area);
        });
        eachObject(environment.locations, `${environmentPath}.locations`, location => {
          location.layerId ??= 'surface';
        });
      },
    );
    file.schemaVersion = 3;
    return file;
  }
  if (file.schemaVersion !== 1) {
    throw new ScenarioValidationError(
      'environmentLibrary.schemaVersion',
      'unsupported schema version',
    );
  }
  eachObject(
    file.environments,
    'environmentLibrary.environments',
    (environment, environmentPath) => {
      environment.layoutId ??= environment.id;
      environment.environmentId ??= environment.layoutId;
      delete environment.id;
      environment.outletAffordances ??= [];
      environment.layers = [{ elevationMeters: 0, id: 'surface', name: 'Surface' }];
      environment.connectors = [];
      eachObject(environment.areas, `${environmentPath}.areas`, area => {
        area.layerId = 'surface';
        delete area.enclosure;
        delete area.cover;
        legacyAreaDefaults(area);
      });
      eachObject(environment.locations, `${environmentPath}.locations`, location => {
        location.layerId = 'surface';
      });
    },
  );
  file.schemaVersion = 3;
  return file;
}

function normAddress(resourceId: string): Record<string, unknown> {
  return { kind: 'norm', packageId: DEFAULT_RESOURCE_PACKAGE_ID, resourceId };
}

function migrateScenario(value: unknown): Record<string, unknown> {
  const file = clone(objectValue(value, 'scenario'));
  if (file.schemaVersion === 18) return file;
  if (
    typeof file.schemaVersion !== 'number' ||
    !Number.isInteger(file.schemaVersion) ||
    file.schemaVersion < 1 ||
    file.schemaVersion > 17
  ) {
    throw new ScenarioValidationError('scenario.schemaVersion', 'unsupported schema version');
  }
  const sourceVersion = file.schemaVersion;
  const characters = 'scenario.characters';
  if (sourceVersion === 1 || sourceVersion === 2) {
    if (sourceVersion === 1) {
      file.behaviorOpportunities = [];
      file.socialRelations = [];
    }
    const dyads: Record<string, unknown>[] = [];
    eachObject(file.socialRelations, 'scenario.socialRelations', relation => {
      dyads.push({
        ...relation,
        behaviorVariance: 0,
        estimateConfidence: 0.1,
        estimatedDisclosure: 0.5,
        estimatedEmpathy: 0.5,
        integratedHistory: 0,
        mode: 'courteous',
        predictionError: 0,
        stance: 0,
      });
    });
    file.dyads = dyads;
    delete file.socialRelations;
    file.disclosureItems = [];
    file.disclosureOpportunities = [];
  }
  if (sourceVersion < 4) {
    file.agendaGoals = [];
    file.taskOperators = [];
    file.worldFacts = [];
  }
  if (sourceVersion < 5) {
    eachObject(file.taskOperators, 'scenario.taskOperators', task => {
      task.recoveryMode = 'none';
    });
    eachObject(file.characters, characters, (placement, placementPath) => {
      eachObject(placement.schedule, `${placementPath}.schedule`, block => {
        block.recoveryMode = legacyRecoveryMode(block.activity);
      });
    });
  }
  if (sourceVersion < 6) {
    file.environmentConditions = {
      season: 'spring',
      temperatureCelsius: 15,
      weather: 'clear',
    };
  }
  if (sourceVersion < 7) {
    eachObject(file.dyads, 'scenario.dyads', dyad => {
      dyad.suspicion = 0;
    });
    file.observationEvents = [];
  }
  if (sourceVersion < 8) {
    file.localNorms = [];
    eachObject(file.characters, characters, placement => {
      placement.normPerspectives = [];
    });
    eachObject(file.observationEvents, 'scenario.observationEvents', event => {
      event.eventType = 'mind-model';
    });
  }
  if (sourceVersion < 9) {
    file.relationshipEvents = [];
    file.relationshipRequests = [];
    eachObject(file.dyads, 'scenario.dyads', dyad => {
      dyad.exposureDebt = 0;
    });
  }
  if (sourceVersion < 10) {
    file.appraisalEvents = [];
    eachObject(file.taskOperators, 'scenario.taskOperators', task => {
      task.maskingDemand = null;
      task.resourceDrainsPerHour = {};
    });
    eachObject(file.characters, characters, (placement, placementPath) => {
      eachObject(placement.schedule, `${placementPath}.schedule`, block => {
        block.maskingDemand = null;
        block.resourceDrainsPerHour = {};
      });
    });
  }
  if (sourceVersion < 11) {
    file.aspirationOpportunities = [];
    file.narrativeEvents = [];
    file.reputationGroups = [];
    eachObject(file.characters, characters, placement => {
      placement.agency = 'responder';
      placement.narrativeOverrides = [];
    });
    eachObject(file.dyads, 'scenario.dyads', dyad => {
      dyad.validatorClaimIds = [];
    });
    eachObject(file.agendaGoals, 'scenario.agendaGoals', goal => {
      goal.claimExpressions = [];
    });
    eachObject(file.taskOperators, 'scenario.taskOperators', task => {
      task.claimExpressions = [];
    });
    eachObject(
      file.behaviorOpportunities,
      'scenario.behaviorOpportunities',
      (opportunity, opportunityPath) => {
        eachObject(opportunity.candidates, `${opportunityPath}.candidates`, candidate => {
          candidate.claimExpressions = [];
          delete candidate.narrativeExpression;
        });
      },
    );
  }
  if (sourceVersion < 12) {
    file.environment = {
      kind: 'environment-layout',
      packageId: DEFAULT_RESOURCE_PACKAGE_ID,
      resourceId: identifierValue(file.environmentId, 'scenario.environmentId'),
    };
    delete file.environmentId;
    eachObject(file.characters, characters, (placement, placementPath) => {
      placement.profile = {
        kind: 'character-profile',
        packageId: DEFAULT_RESOURCE_PACKAGE_ID,
        resourceId: identifierValue(placement.characterId, `${placementPath}.characterId`),
      };
      delete placement.characterId;
    });
  }
  if (sourceVersion < 14) {
    eachObject(file.characters, characters, (placement, placementPath) => {
      objectValue(placement.position, `${placementPath}.position`).layerId ??= 'surface';
    });
    file.socialContractPlacements = [];
    file.legacyLocalNorms = arrayValue(file.localNorms, 'scenario.localNorms');
    delete file.localNorms;
    eachObject(file.legacyLocalNorms, 'scenario.localNorms', (norm, normPath) => {
      norm.address = normAddress(identifierValue(norm.id, `${normPath}.id`));
      delete norm.id;
    });
    eachObject(file.characters, characters, (placement, placementPath) => {
      eachObject(
        placement.normPerspectives,
        `${placementPath}.normPerspectives`,
        (perspective, perspectivePath) => {
          perspective.norm = normAddress(
            identifierValue(perspective.normId, `${perspectivePath}.normId`),
          );
          delete perspective.normId;
        },
      );
    });
    eachObject(file.observationEvents, 'scenario.observationEvents', (event, eventPath) => {
      if (event.eventType === 'norm') {
        event.norm = normAddress(identifierValue(event.normId, `${eventPath}.normId`));
        delete event.normId;
      }
    });
  }
  if (sourceVersion < 15) {
    file.incidentEvents = [];
    eachObject(file.legacyLocalNorms, 'scenario.legacyLocalNorms', norm => {
      norm.interpretations = [
        {
          identityStake: 0.5,
          rootImpact: 'norm-violation',
          turns: clone(norm.compatibilityTurns),
        },
      ];
    });
    eachObject(file.socialContractPlacements, 'scenario.socialContractPlacements', placement => {
      placement.enforcementPresence = 0;
    });
    eachObject(file.characters, characters, (placement, placementPath) => {
      eachObject(placement.normPerspectives, `${placementPath}.normPerspectives`, perspective => {
        const member = perspective.member === true;
        perspective.affiliated = member;
        perspective.internalization = member ? 1 : 0;
        delete perspective.member;
      });
    });
  }
  if (sourceVersion < 16) file.displayEvents = [];
  if (sourceVersion < 17) {
    file.ambientSomaticSources = [];
    file.somaticEvents = [];
    eachObject(file.characters, characters, placement => {
      placement.initialSomaticSources = [];
    });
    eachObject(file.taskOperators, 'scenario.taskOperators', task => {
      task.somaticDemand = 0;
    });
    eachObject(
      file.behaviorOpportunities,
      'scenario.behaviorOpportunities',
      (opportunity, opportunityPath) => {
        eachObject(opportunity.candidates, `${opportunityPath}.candidates`, candidate => {
          candidate.selfDirected = false;
          candidate.somaticDemand = 0;
        });
      },
    );
  }
  if (sourceVersion < 18)
    renameKeysDeep(file, { affectedAgentId: 'affectedInstanceId', agentId: 'instanceId' });
  file.schemaVersion = 18;
  return file;
}

export function parseCharacterLibrary(value: unknown): CharacterLibraryFile {
  const file = migrateCharacterLibrary(value);
  schemaVersion(file.schemaVersion, 'characterLibrary.schemaVersion', 7);
  const characters = arrayValue(file.characters, 'characterLibrary.characters').map(
    (item, index) => {
      const path = `characterLibrary.characters[${index}]`;
      const character = objectValue(item, path);
      identifierValue(character.profileId, `${path}.profileId`);
      identifierValue(character.characterId, `${path}.characterId`);
      stringValue(character.name, `${path}.name`);
      stringValue(character.role, `${path}.role`);
      stringValue(character.summary, `${path}.summary`);
      validateCapabilities(character.capabilities, `${path}.capabilities`);
      validateConstitution(character.constitution, `${path}.constitution`);
      const ageYears = validatePhysicalProfile(character.physical, `${path}.physical`);
      numberValue(character.contractAdherence, `${path}.contractAdherence`, 0, 1);
      validateDisclosureEnvelope(character.disclosure, `${path}.disclosure`);
      validateEmpathyEnvelope(character.empathy, `${path}.empathy`);

      const cascadePriors = objectValue(character.cascadePriors, `${path}.cascadePriors`);
      for (const position of ['freeze', 'fight', 'flight', 'fawn', 'flop']) {
        numberValue(cascadePriors[position], `${path}.cascadePriors.${position}`, 0, 1);
      }

      const outletPreferences = arrayValue(
        character.outletPreferences,
        `${path}.outletPreferences`,
      );
      if (outletPreferences.length === 0) {
        throw new ScenarioValidationError(
          `${path}.outletPreferences`,
          'expected at least one outlet preference',
        );
      }
      const outletOperations = new Set<string>();
      outletPreferences.forEach((entry, preferenceIndex) => {
        const preferencePath = `${path}.outletPreferences[${preferenceIndex}]`;
        const preference = objectValue(entry, preferencePath);
        if (
          typeof preference.operation !== 'string' ||
          !OUTLET_OPERATION_SET.has(preference.operation)
        ) {
          throw new ScenarioValidationError(
            `${preferencePath}.operation`,
            'expected a known outlet operation',
          );
        }
        if (outletOperations.has(preference.operation)) {
          throw new ScenarioValidationError(
            `${preferencePath}.operation`,
            'duplicate outlet operation',
          );
        }
        outletOperations.add(preference.operation);
        numberValue(preference.rank, `${preferencePath}.rank`, 0, 1);
      });

      arrayValue(character.satisfierPreferences, `${path}.satisfierPreferences`).forEach(
        (entry, preferenceIndex) => {
          const preferencePath = `${path}.satisfierPreferences[${preferenceIndex}]`;
          const preference = objectValue(entry, preferencePath);
          if (typeof preference.valueId !== 'string' || !VALUE_ID_SET.has(preference.valueId)) {
            throw new ScenarioValidationError(
              `${preferencePath}.valueId`,
              'expected a known value identifier',
            );
          }
          stringValue(preference.flavor, `${preferencePath}.flavor`);
          if (typeof preference.type !== 'string' || !SATISFIER_TYPES.has(preference.type)) {
            throw new ScenarioValidationError(
              `${preferencePath}.type`,
              'expected deficit or surplus',
            );
          }
        },
      );

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

      const narrativeClaims = arrayValue(character.narrativeClaims, `${path}.narrativeClaims`).map(
        (entry, claimIndex) => {
          const claimPath = `${path}.narrativeClaims[${claimIndex}]`;
          const claim = objectValue(entry, claimPath);
          identifierValue(claim.id, `${claimPath}.id`);
          stringValue(claim.statement, `${claimPath}.statement`);
          if (typeof claim.kind !== 'string' || !NARRATIVE_CLAIM_KINDS.has(claim.kind)) {
            throw new ScenarioValidationError(
              `${claimPath}.kind`,
              'expected affirm, deny, or deserve',
            );
          }
          numberValue(claim.commitment, `${claimPath}.commitment`, 0, 1);
          numberValue(claim.confidence, `${claimPath}.confidence`, 0, 1);
          return claim;
        },
      );
      uniqueIds(narrativeClaims, `${path}.narrativeClaims`);

      let previousFormativeAge = -1;
      arrayValue(character.formativeEvents, `${path}.formativeEvents`).forEach(
        (entry, eventIndex) => {
          const eventPath = `${path}.formativeEvents[${eventIndex}]`;
          const event = objectValue(entry, eventPath);
          const eventAge = integerValue(event.age, `${eventPath}.age`, 0, 120);
          if (eventAge > ageYears) {
            throw new ScenarioValidationError(
              `${eventPath}.age`,
              'expected an age at or before the current character age',
            );
          }
          if (eventAge < previousFormativeAge) {
            throw new ScenarioValidationError(
              `${eventPath}.age`,
              'expected formative events in chronological order',
            );
          }
          previousFormativeAge = eventAge;
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
  uniqueIdentifierField(characters, 'characterLibrary.characters', 'profileId');
  return clone(file) as unknown as CharacterLibraryFile;
}

export function parseEnvironmentLibrary(value: unknown): EnvironmentLibraryFile {
  const file = migrateEnvironmentLibrary(value);
  schemaVersion(file.schemaVersion, 'environmentLibrary.schemaVersion', 3);
  const environments = arrayValue(file.environments, 'environmentLibrary.environments').map(
    (item, index) => {
      const path = `environmentLibrary.environments[${index}]`;
      const environment = objectValue(item, path);
      identifierValue(environment.layoutId, `${path}.layoutId`);
      identifierValue(environment.environmentId, `${path}.environmentId`);
      stringValue(environment.name, `${path}.name`);
      numberValue(environment.width, `${path}.width`, 1);
      numberValue(environment.height, `${path}.height`, 1);

      const layers = arrayValue(environment.layers, `${path}.layers`).map((entry, layerIndex) => {
        const layerPath = `${path}.layers[${layerIndex}]`;
        const layer = objectValue(entry, layerPath);
        identifierValue(layer.id, `${layerPath}.id`);
        stringValue(layer.name, `${layerPath}.name`);
        numberValue(layer.elevationMeters, `${layerPath}.elevationMeters`);
        return layer;
      });
      if (layers.length === 0) {
        throw new ScenarioValidationError(`${path}.layers`, 'expected at least one layer');
      }
      uniqueIds(layers, `${path}.layers`);
      const layerIds = new Set(layers.map(layer => layer.id));

      const areas = arrayValue(environment.areas, `${path}.areas`).map((entry, areaIndex) => {
        const areaPath = `${path}.areas[${areaIndex}]`;
        const area = validateBounds(entry, areaPath);
        identifierValue(area.id, `${areaPath}.id`);
        if (typeof area.kind !== 'string' || !AREA_KINDS.has(area.kind as AreaKind)) {
          throw new ScenarioValidationError(`${areaPath}.kind`, 'expected a known area kind');
        }
        if (area.enclosure !== 'exterior' && area.enclosure !== 'interior') {
          throw new ScenarioValidationError(
            `${areaPath}.enclosure`,
            'expected exterior or interior',
          );
        }
        const cover = objectValue(area.cover, `${areaPath}.cover`);
        numberValue(cover.hearingOcclusion, `${areaPath}.cover.hearingOcclusion`, 0, 1);
        numberValue(cover.overhead, `${areaPath}.cover.overhead`, 0, 1);
        numberValue(cover.sightOcclusion, `${areaPath}.cover.sightOcclusion`, 0, 1);
        const layerId = identifierValue(area.layerId, `${areaPath}.layerId`);
        if (!layerIds.has(layerId)) {
          throw new ScenarioValidationError(`${areaPath}.layerId`, `unknown layer "${layerId}"`);
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
          const layerId = identifierValue(location.layerId, `${locationPath}.layerId`);
          if (!layerIds.has(layerId)) {
            throw new ScenarioValidationError(
              `${locationPath}.layerId`,
              `unknown layer "${layerId}"`,
            );
          }
          return location;
        },
      );
      uniqueIds(locations, `${path}.locations`);

      const connectors = arrayValue(environment.connectors, `${path}.connectors`).map(
        (entry, connectorIndex) => {
          const connectorPath = `${path}.connectors[${connectorIndex}]`;
          const connector = objectValue(entry, connectorPath);
          identifierValue(connector.id, `${connectorPath}.id`);
          if (
            typeof connector.kind !== 'string' ||
            !ENVIRONMENT_CONNECTOR_KINDS.has(connector.kind as EnvironmentConnectorKind)
          ) {
            throw new ScenarioValidationError(
              `${connectorPath}.kind`,
              'expected ladder, ramp, or stairs',
            );
          }
          const from = validateLayerPosition(connector.from, `${connectorPath}.from`);
          const to = validateLayerPosition(connector.to, `${connectorPath}.to`);
          if (!layerIds.has(from.layerId as string)) {
            throw new ScenarioValidationError(
              `${connectorPath}.from.layerId`,
              `unknown layer "${String(from.layerId)}"`,
            );
          }
          if (!layerIds.has(to.layerId as string)) {
            throw new ScenarioValidationError(
              `${connectorPath}.to.layerId`,
              `unknown layer "${String(to.layerId)}"`,
            );
          }
          if (from.layerId === to.layerId) {
            throw new ScenarioValidationError(
              `${connectorPath}.to.layerId`,
              'connector endpoints must use different layers',
            );
          }
          numberValue(
            connector.traversalDistanceMeters,
            `${connectorPath}.traversalDistanceMeters`,
            0,
          );
          return connector;
        },
      );
      uniqueIds(connectors, `${path}.connectors`);
      const reachableLayerIds = new Set<string>([layers[0]?.id as string]);
      let addedLayer = true;
      while (addedLayer) {
        addedLayer = false;
        for (const connector of connectors) {
          const fromLayerId = objectValue(connector.from, `${path}.connectors.from`).layerId;
          const toLayerId = objectValue(connector.to, `${path}.connectors.to`).layerId;
          if (
            reachableLayerIds.has(fromLayerId as string) &&
            !reachableLayerIds.has(toLayerId as string)
          ) {
            reachableLayerIds.add(toLayerId as string);
            addedLayer = true;
          }
          if (
            reachableLayerIds.has(toLayerId as string) &&
            !reachableLayerIds.has(fromLayerId as string)
          ) {
            reachableLayerIds.add(fromLayerId as string);
            addedLayer = true;
          }
        }
      }
      const unreachableLayer = layers.find(layer => !reachableLayerIds.has(layer.id as string));
      if (unreachableLayer !== undefined) {
        throw new ScenarioValidationError(
          `${path}.layers`,
          `layer "${String(unreachableLayer.id)}" is not connected to "${String(layers[0]?.id)}"`,
        );
      }

      const outletAffordances = arrayValue(
        environment.outletAffordances,
        `${path}.outletAffordances`,
      ).map((entry, affordanceIndex) => {
        const affordancePath = `${path}.outletAffordances[${affordanceIndex}]`;
        const affordance = objectValue(entry, affordancePath);
        identifierValue(affordance.id, `${affordancePath}.id`);
        stringValue(affordance.label, `${affordancePath}.label`);
        if (
          typeof affordance.operation !== 'string' ||
          !OUTLET_OPERATION_SET.has(affordance.operation)
        ) {
          throw new ScenarioValidationError(
            `${affordancePath}.operation`,
            'expected a known outlet operation',
          );
        }
        if (
          typeof affordance.targetValueId !== 'string' ||
          !VALUE_ID_SET.has(affordance.targetValueId)
        ) {
          throw new ScenarioValidationError(
            `${affordancePath}.targetValueId`,
            'expected a known value identifier',
          );
        }
        if (affordance.satisfierFlavor !== null) {
          stringValue(affordance.satisfierFlavor, `${affordancePath}.satisfierFlavor`);
        }
        numberValue(affordance.potency, `${affordancePath}.potency`, 0, 1);
        numberValue(affordance.toleranceBuild, `${affordancePath}.toleranceBuild`, 0, 1);
        numberValue(affordance.valueDamage, `${affordancePath}.valueDamage`, 0, 1);
        integerValue(affordance.durationMinutes, `${affordancePath}.durationMinutes`, 1, 100_000);
        if (
          typeof affordance.reinforcementSchedule !== 'string' ||
          !REINFORCEMENT_SCHEDULES.has(affordance.reinforcementSchedule)
        ) {
          throw new ScenarioValidationError(
            `${affordancePath}.reinforcementSchedule`,
            'expected fixed or variable-ratio',
          );
        }
        if (typeof affordance.displacesRepair !== 'boolean') {
          throw new ScenarioValidationError(
            `${affordancePath}.displacesRepair`,
            'expected a boolean',
          );
        }
        return affordance;
      });
      uniqueIds(outletAffordances, `${path}.outletAffordances`);
      return environment;
    },
  );
  uniqueIdentifierField(environments, 'environmentLibrary.environments', 'layoutId');
  return clone(file) as unknown as EnvironmentLibraryFile;
}

const RESOURCE_PAYLOAD_KEY: Record<string, string> = {
  'character-profile': 'profile',
  'environment-layout': 'layout',
  norm: 'norm',
  'social-contract': 'contract',
};

export function parseResourceFile(value: unknown, path = 'resource'): ResourceFile {
  const file = objectValue(value, path);
  const address = parseResourceAddress(file.address, `${path}.address`);
  knownKeys(file, path, ['address', 'schemaVersion', RESOURCE_PAYLOAD_KEY[address.kind] ?? '']);
  if (address.kind === 'character-profile') {
    schemaVersion(file.schemaVersion, `${path}.schemaVersion`, 1);
    let profile: CharacterLibraryFile['characters'][number] | undefined;
    try {
      profile = parseCharacterLibrary({ characters: [file.profile], schemaVersion: 7 })
        .characters[0];
    } catch (error) {
      if (error instanceof ScenarioValidationError) {
        throw new ScenarioValidationError(path, error.message);
      }
      throw error;
    }
    if (profile === undefined) throw new Error('Validated resource contains one character profile');
    if (profile.profileId !== address.resourceId) {
      throw new ScenarioValidationError(
        `${path}.profile.profileId`,
        'must match the resource address identifier',
      );
    }
    return clone({
      address: address as CharacterProfileAddress,
      profile,
      schemaVersion: 1,
    }) as CharacterProfileResourceFile;
  }
  if (address.kind === 'norm') {
    if (file.schemaVersion !== 1 && file.schemaVersion !== 2) {
      throw new ScenarioValidationError(`${path}.schemaVersion`, 'unsupported schema version');
    }
    const migrated = clone(file);
    const normValue = objectValue(migrated.norm, `${path}.norm`);
    if (file.schemaVersion === 1) {
      validateNonzeroValueTurns(normValue.compatibilityTurns, `${path}.norm.compatibilityTurns`);
      normValue.interpretations = [
        {
          identityStake: 0.5,
          rootImpact: 'norm-violation',
          turns: clone(normValue.compatibilityTurns),
        },
      ];
    }
    const norm = validateNormDefinition(normValue, `${path}.norm`);
    return clone({
      address: address as NormAddress,
      norm,
      schemaVersion: 2,
    }) as unknown as NormResourceFile;
  }
  if (address.kind === 'social-contract') {
    if (file.schemaVersion !== 1 && file.schemaVersion !== 2) {
      throw new ScenarioValidationError(`${path}.schemaVersion`, 'unsupported schema version');
    }
    const migrated = clone(file);
    const contractValue = objectValue(migrated.contract, `${path}.contract`);
    if (file.schemaVersion === 1) contractValue.enforcementSeverity = 0.5;
    const contract = validateSocialContractDefinition(contractValue, `${path}.contract`);
    return clone({
      address: address as SocialContractAddress,
      contract,
      schemaVersion: 2,
    }) as unknown as SocialContractResourceFile;
  }
  if (file.schemaVersion !== 1 && file.schemaVersion !== 2 && file.schemaVersion !== 3) {
    throw new ScenarioValidationError(`${path}.schemaVersion`, 'unsupported schema version');
  }
  let layout: EnvironmentLibraryFile['environments'][number] | undefined;
  try {
    layout = parseEnvironmentLibrary({
      environments: [file.layout],
      schemaVersion: file.schemaVersion,
    }).environments[0];
  } catch (error) {
    if (error instanceof ScenarioValidationError) {
      throw new ScenarioValidationError(path, error.message);
    }
    throw error;
  }
  if (layout === undefined) throw new Error('Validated resource contains one environment layout');
  if (layout.layoutId !== address.resourceId) {
    throw new ScenarioValidationError(
      `${path}.layout.layoutId`,
      'must match the resource address identifier',
    );
  }
  return clone({
    address: address as EnvironmentLayoutAddress,
    layout,
    schemaVersion: 3,
  }) as EnvironmentLayoutResourceFile;
}

const SCENARIO_FILE_KEYS: readonly string[] = [
  'agendaGoals',
  'ambientTurnsPerHour',
  'ambientSomaticSources',
  'appraisalEvents',
  'aspirationOpportunities',
  'behaviorOpportunities',
  'characters',
  'disclosureItems',
  'disclosureOpportunities',
  'displayEvents',
  'dyads',
  'environment',
  'environmentConditions',
  'id',
  'incidentEvents',
  'initialTimeRate',
  'legacyLocalNorms',
  'narrativeEvents',
  'observationEvents',
  'relationshipEvents',
  'relationshipRequests',
  'reputationGroups',
  'schemaVersion',
  'socialContractPlacements',
  'somaticEvents',
  'startMinute',
  'summary',
  'taskOperators',
  'tickMinutes',
  'title',
  'worldFacts',
];
const CHARACTER_PLACEMENT_KEYS: readonly string[] = [
  'agency',
  'profile',
  'initialResources',
  'initialSomaticSources',
  'initialValues',
  'instanceId',
  'narrativeOverrides',
  'normPerspectives',
  'position',
  'schedule',
  'walkingMetersPerMinute',
];
const SCHEDULE_BLOCK_KEYS: readonly string[] = [
  'activity',
  'locationId',
  'maskingDemand',
  'recoveryMode',
  'resourceDrainsPerHour',
  'startMinute',
];

export function parseScenario(value: unknown): ScenarioFile {
  const file = migrateScenario(value);
  schemaVersion(file.schemaVersion, 'scenario.schemaVersion', 18);
  knownKeys(file, 'scenario', SCENARIO_FILE_KEYS);
  eachObject(file.characters, 'scenario.characters', (placement, placementPath) => {
    knownKeys(placement, placementPath, CHARACTER_PLACEMENT_KEYS);
    eachObject(placement.schedule, `${placementPath}.schedule`, (block, blockPath) => {
      knownKeys(block, blockPath, SCHEDULE_BLOCK_KEYS);
    });
  });
  identifierValue(file.id, 'scenario.id');
  stringValue(file.title, 'scenario.title');
  stringValue(file.summary, 'scenario.summary');
  parseResourceAddress(file.environment, 'scenario.environment', 'environment-layout');
  const environmentConditions = objectValue(
    file.environmentConditions,
    'scenario.environmentConditions',
  );
  if (
    typeof environmentConditions.season !== 'string' ||
    !SEASON_ID_SET.has(environmentConditions.season)
  ) {
    throw new ScenarioValidationError(
      'scenario.environmentConditions.season',
      'expected a known season identifier',
    );
  }
  numberValue(
    environmentConditions.temperatureCelsius,
    'scenario.environmentConditions.temperatureCelsius',
    -100,
    70,
  );
  if (
    typeof environmentConditions.weather !== 'string' ||
    !WEATHER_ID_SET.has(environmentConditions.weather)
  ) {
    throw new ScenarioValidationError(
      'scenario.environmentConditions.weather',
      'expected a known weather identifier',
    );
  }
  const startMinute = integerValue(
    file.startMinute,
    'scenario.startMinute',
    0,
    Number.MAX_SAFE_INTEGER,
  );
  integerValue(file.tickMinutes, 'scenario.tickMinutes', 1, 1440);
  if (
    file.initialTimeRate !== undefined &&
    (typeof file.initialTimeRate !== 'string' || !TIME_RATE_ID_SET.has(file.initialTimeRate))
  ) {
    throw new ScenarioValidationError(
      'scenario.initialTimeRate',
      'expected a known time rate identifier',
    );
  }

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
  validateSomaticSources(
    file.ambientSomaticSources,
    'scenario.ambientSomaticSources',
    'environment',
  );

  const legacyLocalNorms = arrayValue(file.legacyLocalNorms, 'scenario.legacyLocalNorms').map(
    (entry, index) => {
      const path = `scenario.legacyLocalNorms[${index}]`;
      const norm = objectValue(entry, path);
      parseResourceAddress(norm.address, `${path}.address`, 'norm');
      validateNormDefinition(norm, path);
      return norm;
    },
  );
  const localNormKeys = legacyLocalNorms.map(norm =>
    resourceAddressKey(
      parseResourceAddress(norm.address, 'scenario.legacyLocalNorms.address', 'norm'),
    ),
  );
  if (new Set(localNormKeys).size !== localNormKeys.length) {
    throw new ScenarioValidationError('scenario.legacyLocalNorms', 'duplicate norm address');
  }

  const socialContractPlacements = arrayValue(
    file.socialContractPlacements,
    'scenario.socialContractPlacements',
  ).map((entry, index) => {
    const path = `scenario.socialContractPlacements[${index}]`;
    const placement = objectValue(entry, path);
    identifierValue(placement.id, `${path}.id`);
    parseResourceAddress(placement.contract, `${path}.contract`, 'social-contract');
    numberValue(placement.enforcementPresence, `${path}.enforcementPresence`, 0, 1);
    const scope = objectValue(placement.scope, `${path}.scope`);
    if (typeof scope.kind !== 'string' || !SOCIAL_CONTRACT_SCOPE_KIND_SET.has(scope.kind)) {
      throw new ScenarioValidationError(
        `${path}.scope.kind`,
        'expected event, group, institution, or location',
      );
    }
    const scopeField = `${scope.kind}Id`;
    identifierValue(scope[scopeField], `${path}.scope.${scopeField}`);
    return placement;
  });
  uniqueIds(socialContractPlacements, 'scenario.socialContractPlacements');

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
    validateClaimExpressions(goal.claimExpressions, `${path}.claimExpressions`);
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
      validateClaimExpressions(task.claimExpressions, `${path}.claimExpressions`);
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
      if (
        typeof task.recoveryMode !== 'string' ||
        !RECOVERY_MODES.has(task.recoveryMode as RecoveryMode)
      ) {
        throw new ScenarioValidationError(
          `${path}.recoveryMode`,
          'expected break, none, rest, or sleep',
        );
      }
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
      validateResourceCosts(task.resourceDrainsPerHour, `${path}.resourceDrainsPerHour`);
      validateMaskingDemand(task.maskingDemand, `${path}.maskingDemand`);
      numberValue(task.somaticDemand, `${path}.somaticDemand`, 0, 1);
      validateValueTurns(task.valueTurns, `${path}.valueTurns`);
      return task;
    },
  );
  uniqueIds(taskOperators, 'scenario.taskOperators');

  const characters = arrayValue(file.characters, 'scenario.characters').map((item, index) => {
    const path = `scenario.characters[${index}]`;
    const placement = objectValue(item, path);
    identifierValue(placement.instanceId, `${path}.instanceId`);
    parseResourceAddress(placement.profile, `${path}.profile`, 'character-profile');
    if (typeof placement.agency !== 'string' || !AGENCY_MODES.has(placement.agency)) {
      throw new ScenarioValidationError(`${path}.agency`, 'expected invoker or responder');
    }
    const narrativeOverrides = arrayValue(
      placement.narrativeOverrides,
      `${path}.narrativeOverrides`,
    );
    const overrideClaimIds = new Set<string>();
    narrativeOverrides.forEach((entry, overrideIndex) => {
      const overridePath = `${path}.narrativeOverrides[${overrideIndex}]`;
      const override = objectValue(entry, overridePath);
      const claimId = identifierValue(override.claimId, `${overridePath}.claimId`);
      if (overrideClaimIds.has(claimId)) {
        throw new ScenarioValidationError(`${overridePath}.claimId`, 'duplicate claim override');
      }
      overrideClaimIds.add(claimId);
      if (override.commitment !== undefined) {
        numberValue(override.commitment, `${overridePath}.commitment`, 0, 1);
      }
      if (override.confidence !== undefined) {
        numberValue(override.confidence, `${overridePath}.confidence`, 0, 1);
      }
    });
    validateLayerPosition(placement.position, `${path}.position`);
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

    validateSomaticSources(
      placement.initialSomaticSources,
      `${path}.initialSomaticSources`,
      'activity',
    );

    const normPerspectives = arrayValue(placement.normPerspectives, `${path}.normPerspectives`).map(
      (entry, perspectiveIndex) => {
        const perspectivePath = `${path}.normPerspectives[${perspectiveIndex}]`;
        const perspective = objectValue(entry, perspectivePath);
        parseResourceAddress(perspective.norm, `${perspectivePath}.norm`, 'norm');
        if (typeof perspective.affiliated !== 'boolean') {
          throw new ScenarioValidationError(`${perspectivePath}.affiliated`, 'expected a boolean');
        }
        numberValue(perspective.internalization, `${perspectivePath}.internalization`, 0, 1);
        numberValue(perspective.legibility, `${perspectivePath}.legibility`, 0, 1);
        return perspective;
      },
    );
    const perspectiveKeys = normPerspectives.map(perspective =>
      resourceAddressKey(
        parseResourceAddress(perspective.norm, `${path}.normPerspectives.norm`, 'norm'),
      ),
    );
    if (new Set(perspectiveKeys).size !== perspectiveKeys.length) {
      throw new ScenarioValidationError(`${path}.normPerspectives`, 'duplicate norm perspective');
    }

    const schedule = arrayValue(placement.schedule, `${path}.schedule`).map(
      (entry, scheduleIndex) => {
        const schedulePath = `${path}.schedule[${scheduleIndex}]`;
        const block = objectValue(entry, schedulePath);
        integerValue(block.startMinute, `${schedulePath}.startMinute`, 0, 1439);
        identifierValue(block.locationId, `${schedulePath}.locationId`);
        stringValue(block.activity, `${schedulePath}.activity`);
        if (
          typeof block.recoveryMode !== 'string' ||
          !RECOVERY_MODES.has(block.recoveryMode as RecoveryMode)
        ) {
          throw new ScenarioValidationError(
            `${schedulePath}.recoveryMode`,
            'expected break, none, rest, or sleep',
          );
        }
        validateResourceCosts(block.resourceDrainsPerHour, `${schedulePath}.resourceDrainsPerHour`);
        validateMaskingDemand(block.maskingDemand, `${schedulePath}.maskingDemand`);
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
    numberValue(dyad.exposureDebt, `${path}.exposureDebt`, 0, 1);
    numberValue(dyad.predictionError, `${path}.predictionError`, 0, 1);
    numberValue(dyad.suspicion, `${path}.suspicion`, 0, 1);
    const validatorClaimIds = arrayValue(dyad.validatorClaimIds, `${path}.validatorClaimIds`);
    validatorClaimIds.forEach((claimId, claimIndex) => {
      identifierValue(claimId, `${path}.validatorClaimIds[${claimIndex}]`);
    });
    if (new Set(validatorClaimIds).size !== validatorClaimIds.length) {
      throw new ScenarioValidationError(`${path}.validatorClaimIds`, 'duplicate claim identifier');
    }
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
      arrayValue(item.knownByIds, `${path}.knownByIds`).forEach((instanceId, agentIndex) => {
        identifierValue(instanceId, `${path}.knownByIds[${agentIndex}]`);
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
    integerValue(opportunity.atMinute, `${path}.atMinute`, startMinute, Number.MAX_SAFE_INTEGER);
    numberValue(opportunity.disclosureBenefit, `${path}.disclosureBenefit`, 0, 4);
    numberValue(opportunity.networkConductivity, `${path}.networkConductivity`, 0, 1);
    const audiences = arrayValue(opportunity.audienceIds, `${path}.audienceIds`);
    if (audiences.length === 0) {
      throw new ScenarioValidationError(`${path}.audienceIds`, 'expected at least one audience');
    }
    audiences.forEach((instanceId, agentIndex) => {
      identifierValue(instanceId, `${path}.audienceIds[${agentIndex}]`);
    });
    if (new Set(audiences).size !== audiences.length) {
      throw new ScenarioValidationError(`${path}.audienceIds`, 'duplicate agent identifier');
    }
    return opportunity;
  });
  uniqueIds(disclosureOpportunities, 'scenario.disclosureOpportunities');

  const relationshipEvents = arrayValue(file.relationshipEvents, 'scenario.relationshipEvents').map(
    (entry, index) => {
      const path = `scenario.relationshipEvents[${index}]`;
      const event = objectValue(entry, path);
      identifierValue(event.id, `${path}.id`);
      identifierValue(event.observerId, `${path}.observerId`);
      identifierValue(event.subjectId, `${path}.subjectId`);
      integerValue(event.atMinute, `${path}.atMinute`, startMinute, Number.MAX_SAFE_INTEGER);
      stringValue(event.summary, `${path}.summary`);
      const turn = numberValue(event.stanceTurn, `${path}.stanceTurn`, -1, 1);
      if (turn === 0) {
        throw new ScenarioValidationError(`${path}.stanceTurn`, 'expected a non-zero turn');
      }
      return event;
    },
  );
  uniqueIds(relationshipEvents, 'scenario.relationshipEvents');

  const relationshipRequests = arrayValue(
    file.relationshipRequests,
    'scenario.relationshipRequests',
  ).map((entry, index) => {
    const path = `scenario.relationshipRequests[${index}]`;
    const request = objectValue(entry, path);
    identifierValue(request.id, `${path}.id`);
    identifierValue(request.requesterId, `${path}.requesterId`);
    identifierValue(request.responderId, `${path}.responderId`);
    integerValue(request.atMinute, `${path}.atMinute`, startMinute, Number.MAX_SAFE_INTEGER);
    stringValue(request.label, `${path}.label`);
    numberValue(request.magnitude, `${path}.magnitude`, 0, 1);
    return request;
  });
  uniqueIds(relationshipRequests, 'scenario.relationshipRequests');

  const appraisalEvents = arrayValue(file.appraisalEvents, 'scenario.appraisalEvents').map(
    (entry, index) => {
      const path = `scenario.appraisalEvents[${index}]`;
      const event = objectValue(entry, path);
      identifierValue(event.id, `${path}.id`);
      identifierValue(event.instanceId, `${path}.instanceId`);
      integerValue(event.atMinute, `${path}.atMinute`, startMinute, Number.MAX_SAFE_INTEGER);
      stringValue(event.summary, `${path}.summary`);
      numberValue(event.threat, `${path}.threat`, 0, 1);
      numberValue(event.copingPotential, `${path}.copingPotential`, 0, 1);
      validateValueTurns(event.turns, `${path}.turns`);
      if (event.socialTargetId !== null) {
        identifierValue(event.socialTargetId, `${path}.socialTargetId`);
      }
      for (const field of ['localized', 'believedLeverage', 'exitAvailable']) {
        if (typeof event[field] !== 'boolean') {
          throw new ScenarioValidationError(`${path}.${field}`, 'expected a boolean');
        }
      }
      return event;
    },
  );
  uniqueIds(appraisalEvents, 'scenario.appraisalEvents');

  const reputationGroups = arrayValue(file.reputationGroups, 'scenario.reputationGroups').map(
    (entry, index) => {
      const path = `scenario.reputationGroups[${index}]`;
      const group = objectValue(entry, path);
      identifierValue(group.id, `${path}.id`);
      stringValue(group.label, `${path}.label`);
      const memberIds = arrayValue(group.memberIds, `${path}.memberIds`);
      memberIds.forEach((memberId, memberIndex) => {
        identifierValue(memberId, `${path}.memberIds[${memberIndex}]`);
      });
      if (new Set(memberIds).size !== memberIds.length) {
        throw new ScenarioValidationError(`${path}.memberIds`, 'duplicate agent identifier');
      }
      return group;
    },
  );
  uniqueIds(reputationGroups, 'scenario.reputationGroups');

  const aspirationOpportunities = arrayValue(
    file.aspirationOpportunities,
    'scenario.aspirationOpportunities',
  ).map((entry, index) => {
    const path = `scenario.aspirationOpportunities[${index}]`;
    const opportunity = objectValue(entry, path);
    identifierValue(opportunity.id, `${path}.id`);
    identifierValue(opportunity.actorId, `${path}.actorId`);
    identifierValue(opportunity.claimId, `${path}.claimId`);
    stringValue(opportunity.label, `${path}.label`);
    integerValue(opportunity.atMinute, `${path}.atMinute`, startMinute, Number.MAX_SAFE_INTEGER);
    numberValue(opportunity.commitment, `${path}.commitment`, 0, 1);
    if (opportunity.deadlineMinute !== null) {
      const deadline = integerValue(
        opportunity.deadlineMinute,
        `${path}.deadlineMinute`,
        0,
        Number.MAX_SAFE_INTEGER,
      );
      if (deadline <= (opportunity.atMinute as number)) {
        throw new ScenarioValidationError(
          `${path}.deadlineMinute`,
          'expected a deadline after availability',
        );
      }
    }
    integerValue(opportunity.urgencyHorizonMinutes, `${path}.urgencyHorizonMinutes`, 1, 100_000);
    validateFactConditions(opportunity.desired, `${path}.desired`, true);
    validateValueTurns(opportunity.successTurns, `${path}.successTurns`);
    validateValueTurns(opportunity.failureTurns, `${path}.failureTurns`);
    validateClaimExpressions(opportunity.claimExpressions, `${path}.claimExpressions`);
    return opportunity;
  });
  uniqueIds(aspirationOpportunities, 'scenario.aspirationOpportunities');

  const narrativeEvents = arrayValue(file.narrativeEvents, 'scenario.narrativeEvents').map(
    (entry, index) => {
      const path = `scenario.narrativeEvents[${index}]`;
      const event = objectValue(entry, path);
      identifierValue(event.id, `${path}.id`);
      integerValue(event.atMinute, `${path}.atMinute`, startMinute, Number.MAX_SAFE_INTEGER);
      stringValue(event.summary, `${path}.summary`);
      if (event.eventType === 'claim-evidence') {
        identifierValue(event.actorId, `${path}.actorId`);
        identifierValue(event.claimId, `${path}.claimId`);
        const alignment = numberValue(event.alignment, `${path}.alignment`, -1, 1);
        if (alignment === 0) {
          throw new ScenarioValidationError(`${path}.alignment`, 'expected a non-zero alignment');
        }
      } else if (event.eventType === 'self-deprecation-agreement') {
        identifierValue(event.actorId, `${path}.actorId`);
        identifierValue(event.responderId, `${path}.responderId`);
        identifierValue(event.claimId, `${path}.claimId`);
        if (event.disclosureItemId !== null) {
          identifierValue(event.disclosureItemId, `${path}.disclosureItemId`);
        }
      } else if (event.eventType === 'attribution') {
        identifierValue(event.sourceId, `${path}.sourceId`);
        identifierValue(event.subjectId, `${path}.subjectId`);
        identifierValue(event.audienceId, `${path}.audienceId`);
        identifierValue(event.selfClaimId, `${path}.selfClaimId`);
        stringValue(event.claim, `${path}.claim`);
        if (event.audienceType !== 'agent' && event.audienceType !== 'group') {
          throw new ScenarioValidationError(`${path}.audienceType`, 'expected agent or group');
        }
        numberValue(event.compatibility, `${path}.compatibility`, -1, 1);
        numberValue(event.confidence, `${path}.confidence`, 0, 1);
      } else {
        throw new ScenarioValidationError(
          `${path}.eventType`,
          'expected attribution, claim-evidence, or self-deprecation-agreement',
        );
      }
      return event;
    },
  );
  uniqueIds(narrativeEvents, 'scenario.narrativeEvents');

  const observationEvents = arrayValue(file.observationEvents, 'scenario.observationEvents').map(
    (entry, index) => {
      const path = `scenario.observationEvents[${index}]`;
      const event = objectValue(entry, path);
      identifierValue(event.id, `${path}.id`);
      identifierValue(event.subjectId, `${path}.subjectId`);
      integerValue(event.atMinute, `${path}.atMinute`, startMinute, Number.MAX_SAFE_INTEGER);
      if (event.eventType !== 'mind-model' && event.eventType !== 'norm') {
        throw new ScenarioValidationError(`${path}.eventType`, 'expected mind-model or norm');
      }
      if (typeof event.channel !== 'string' || !OBSERVATION_CHANNEL_SET.has(event.channel)) {
        throw new ScenarioValidationError(`${path}.channel`, 'expected hearing or sight');
      }
      numberValue(event.audibleRadiusMeters, `${path}.audibleRadiusMeters`, 0, 10_000);
      numberValue(event.visualProminence, `${path}.visualProminence`, 0, 1);
      numberValue(event.interpretationDifficulty, `${path}.interpretationDifficulty`, 0, 1);
      if (event.eventType === 'mind-model') {
        if (typeof event.dimension !== 'string' || !MIND_MODEL_DIMENSION_SET.has(event.dimension)) {
          throw new ScenarioValidationError(`${path}.dimension`, 'expected disclosure or empathy');
        }
        numberValue(event.diagnosticity, `${path}.diagnosticity`, 0, 1);
        numberValue(event.observedValue, `${path}.observedValue`, 0, 1);
      } else {
        parseResourceAddress(event.norm, `${path}.norm`, 'norm');
        stringValue(event.summary, `${path}.summary`);
        validateValueTurns(event.baselineTurns, `${path}.baselineTurns`);
        const compatibility = numberValue(event.compatibility, `${path}.compatibility`, -1, 1);
        if (compatibility === 0) {
          throw new ScenarioValidationError(`${path}.compatibility`, 'expected a non-zero value');
        }
      }
      const observerIds = arrayValue(event.observerIds, `${path}.observerIds`);
      if (observerIds.length === 0) {
        throw new ScenarioValidationError(`${path}.observerIds`, 'expected at least one observer');
      }
      observerIds.forEach((observerId, observerIndex) => {
        identifierValue(observerId, `${path}.observerIds[${observerIndex}]`);
      });
      if (new Set(observerIds).size !== observerIds.length) {
        throw new ScenarioValidationError(`${path}.observerIds`, 'duplicate agent identifier');
      }
      return event;
    },
  );
  uniqueIds(observationEvents, 'scenario.observationEvents');

  const incidentEvents = arrayValue(file.incidentEvents, 'scenario.incidentEvents').map(
    (entry, index) => {
      const path = `scenario.incidentEvents[${index}]`;
      const event = objectValue(entry, path);
      identifierValue(event.id, `${path}.id`);
      identifierValue(event.affectedInstanceId, `${path}.affectedInstanceId`);
      if (event.actorId !== null) identifierValue(event.actorId, `${path}.actorId`);
      integerValue(event.atMinute, `${path}.atMinute`, startMinute, Number.MAX_SAFE_INTEGER);
      stringValue(event.summary, `${path}.summary`);
      if (typeof event.rootImpact !== 'string' || !INCIDENT_ROOT_IMPACT_SET.has(event.rootImpact)) {
        throw new ScenarioValidationError(`${path}.rootImpact`, 'expected a known root impact');
      }
      if (typeof event.attribution !== 'string' || !INCIDENT_ATTRIBUTIONS.has(event.attribution)) {
        throw new ScenarioValidationError(`${path}.attribution`, 'expected a known attribution');
      }
      if (typeof event.publicity !== 'string' || !INCIDENT_PUBLICITY.has(event.publicity)) {
        throw new ScenarioValidationError(
          `${path}.publicity`,
          'expected private, witnessed, or public',
        );
      }
      if (typeof event.volition !== 'string' || !INCIDENT_VOLITIONS.has(event.volition)) {
        throw new ScenarioValidationError(`${path}.volition`, 'expected a known volition');
      }
      numberValue(event.magnitude, `${path}.magnitude`, Number.EPSILON, 1);
      numberValue(event.audibleRadiusMeters, `${path}.audibleRadiusMeters`, 0, 10_000);
      numberValue(event.visualProminence, `${path}.visualProminence`, 0, 1);
      numberValue(event.interpretationDifficulty, `${path}.interpretationDifficulty`, 0, 1);
      const observerIds = arrayValue(event.observerIds, `${path}.observerIds`);
      if (observerIds.length === 0) {
        throw new ScenarioValidationError(`${path}.observerIds`, 'expected at least one observer');
      }
      observerIds.forEach((observerId, observerIndex) => {
        identifierValue(observerId, `${path}.observerIds[${observerIndex}]`);
      });
      if (new Set(observerIds).size !== observerIds.length) {
        throw new ScenarioValidationError(`${path}.observerIds`, 'duplicate agent identifier');
      }
      const context = objectValue(event.context, `${path}.context`);
      if (context.locationId !== null) {
        identifierValue(context.locationId, `${path}.context.locationId`);
      }
      for (const field of ['groupIds', 'institutionIds']) {
        const ids = arrayValue(context[field], `${path}.context.${field}`);
        ids.forEach((id, idIndex) => {
          identifierValue(id, `${path}.context.${field}[${idIndex}]`);
        });
        if (new Set(ids).size !== ids.length) {
          throw new ScenarioValidationError(`${path}.context.${field}`, 'duplicate identifier');
        }
      }
      if (event.generation !== null) {
        const generation = objectValue(event.generation, `${path}.generation`);
        if (generation.algorithm !== 'verusim-incident-v1') {
          throw new ScenarioValidationError(
            `${path}.generation.algorithm`,
            'expected verusim-incident-v1',
          );
        }
        integerValue(generation.seed, `${path}.generation.seed`, 0, 0xffff_ffff);
        const samplerStart = integerValue(
          generation.samplerStart,
          `${path}.generation.samplerStart`,
          0,
          Number.MAX_SAFE_INTEGER,
        );
        const samplerEnd = integerValue(
          generation.samplerEnd,
          `${path}.generation.samplerEnd`,
          samplerStart,
          Number.MAX_SAFE_INTEGER,
        );
        identifierValue(generation.templateId, `${path}.generation.templateId`);
        const weights = arrayValue(
          generation.eligibleWeights,
          `${path}.generation.eligibleWeights`,
        );
        weights.forEach((weightValue, weightIndex) => {
          const weightPath = `${path}.generation.eligibleWeights[${weightIndex}]`;
          const weight = objectValue(weightValue, weightPath);
          identifierValue(weight.instanceId, `${weightPath}.instanceId`);
          numberValue(weight.weight, `${weightPath}.weight`, Number.EPSILON);
        });
        const draws = arrayValue(generation.draws, `${path}.generation.draws`);
        if (samplerEnd !== samplerStart + draws.length) {
          throw new ScenarioValidationError(
            `${path}.generation.samplerEnd`,
            'must equal samplerStart plus draw count',
          );
        }
        draws.forEach((drawValue, drawIndex) => {
          const drawPath = `${path}.generation.draws[${drawIndex}]`;
          const draw = objectValue(drawValue, drawPath);
          stringValue(draw.label, `${drawPath}.label`);
          numberValue(draw.minimum, `${drawPath}.minimum`);
          const maximum = numberValue(draw.maximum, `${drawPath}.maximum`);
          if (maximum < (draw.minimum as number)) {
            throw new ScenarioValidationError(`${drawPath}.maximum`, 'must not be below minimum');
          }
          integerValue(
            draw.position,
            `${drawPath}.position`,
            samplerStart + drawIndex,
            samplerStart + drawIndex,
          );
          numberValue(draw.unit, `${drawPath}.unit`, 0, 1);
          numberValue(draw.value, `${drawPath}.value`, draw.minimum as number, maximum);
        });
      }
      return event;
    },
  );
  uniqueIds(incidentEvents, 'scenario.incidentEvents');

  const displayEvents = arrayValue(file.displayEvents, 'scenario.displayEvents').map(
    (entry, index) => {
      const path = `scenario.displayEvents[${index}]`;
      const event = objectValue(entry, path);
      identifierValue(event.id, `${path}.id`);
      identifierValue(event.displayId, `${path}.displayId`);
      identifierValue(event.wearerId, `${path}.wearerId`);
      integerValue(event.atMinute, `${path}.atMinute`, startMinute, Number.MAX_SAFE_INTEGER);
      stringValue(event.summary, `${path}.summary`);
      stringValue(event.statusMarker, `${path}.statusMarker`);
      if (typeof event.domainContested !== 'boolean') {
        throw new ScenarioValidationError(`${path}.domainContested`, 'expected a boolean');
      }
      numberValue(event.magnitude, `${path}.magnitude`, Number.EPSILON, 1);
      numberValue(event.habituationPerExposure, `${path}.habituationPerExposure`, 0, 1);
      numberValue(event.visualProminence, `${path}.visualProminence`, 0, 1);
      const observerIds = arrayValue(event.observerIds, `${path}.observerIds`);
      if (observerIds.length === 0) {
        throw new ScenarioValidationError(`${path}.observerIds`, 'expected at least one observer');
      }
      observerIds.forEach((observerId, observerIndex) => {
        identifierValue(observerId, `${path}.observerIds[${observerIndex}]`);
      });
      if (new Set(observerIds).size !== observerIds.length) {
        throw new ScenarioValidationError(`${path}.observerIds`, 'duplicate agent identifier');
      }
      const context = objectValue(event.context, `${path}.context`);
      if (context.locationId !== null) {
        identifierValue(context.locationId, `${path}.context.locationId`);
      }
      for (const field of ['groupIds', 'institutionIds']) {
        const ids = arrayValue(context[field], `${path}.context.${field}`);
        ids.forEach((id, idIndex) => {
          identifierValue(id, `${path}.context.${field}[${idIndex}]`);
        });
        if (new Set(ids).size !== ids.length) {
          throw new ScenarioValidationError(`${path}.context.${field}`, 'duplicate identifier');
        }
      }
      return event;
    },
  );
  uniqueIds(displayEvents, 'scenario.displayEvents');

  const somaticEvents = arrayValue(file.somaticEvents, 'scenario.somaticEvents').map(
    (entry, index) => {
      const path = `scenario.somaticEvents[${index}]`;
      const event = objectValue(entry, path);
      identifierValue(event.id, `${path}.id`);
      identifierValue(event.instanceId, `${path}.instanceId`);
      integerValue(event.atMinute, `${path}.atMinute`, startMinute, Number.MAX_SAFE_INTEGER);
      identifierValue(event.sourceId, `${path}.sourceId`);
      stringValue(event.summary, `${path}.summary`);
      numberValue(event.visualProminence, `${path}.visualProminence`, 0, 1);
      if (event.operation !== 'clear' && event.operation !== 'set') {
        throw new ScenarioValidationError(`${path}.operation`, 'expected clear or set');
      }
      if (event.operation === 'clear') {
        if (event.source !== null) {
          throw new ScenarioValidationError(`${path}.source`, 'expected null for a clear event');
        }
      } else {
        const source = validateSomaticSource(event.source, `${path}.source`, 'event');
        if (source.id !== event.sourceId) {
          throw new ScenarioValidationError(`${path}.source.id`, 'must match sourceId');
        }
      }
      const observerIds = arrayValue(event.observerIds, `${path}.observerIds`);
      observerIds.forEach((observerId, observerIndex) => {
        identifierValue(observerId, `${path}.observerIds[${observerIndex}]`);
      });
      if (new Set(observerIds).size !== observerIds.length) {
        throw new ScenarioValidationError(`${path}.observerIds`, 'duplicate agent identifier');
      }
      return event;
    },
  );
  uniqueIds(somaticEvents, 'scenario.somaticEvents');

  const opportunities = arrayValue(
    file.behaviorOpportunities,
    'scenario.behaviorOpportunities',
  ).map((entry, index) => {
    const path = `scenario.behaviorOpportunities[${index}]`;
    const opportunity = objectValue(entry, path);
    identifierValue(opportunity.id, `${path}.id`);
    identifierValue(opportunity.actorId, `${path}.actorId`);
    if (opportunity.targetId !== null) identifierValue(opportunity.targetId, `${path}.targetId`);
    integerValue(opportunity.atMinute, `${path}.atMinute`, startMinute, Number.MAX_SAFE_INTEGER);

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
        validateClaimExpressions(candidate.claimExpressions, `${candidatePath}.claimExpressions`);
        numberValue(candidate.repercussionSeverity, `${candidatePath}.repercussionSeverity`, 0, 4);
        if (typeof candidate.selfDirected !== 'boolean') {
          throw new ScenarioValidationError(`${candidatePath}.selfDirected`, 'expected a boolean');
        }
        numberValue(candidate.somaticDemand, `${candidatePath}.somaticDemand`, 0, 1);
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
