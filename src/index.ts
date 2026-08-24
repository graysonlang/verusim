// `__APP_VERSION__` and `__COMMIT_SHA__` are substituted at build time by
// esbuild's `define` (see scripts/build.mjs). They are not runtime globals.
/* global __APP_VERSION__, __COMMIT_SHA__ */

export {
  CAPABILITY_IDS,
  HEIGHT_CLASSES,
  MIND_MODEL_DIMENSIONS,
  OBSERVATION_CHANNELS,
  OBSERVATION_EVENT_TYPES,
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
} from './model/types.js';
export type * from './model/types.js';
export {
  characterBehaviorDistance,
  generateCharacterCohort,
  generateCharacterProfile,
} from './generation/character.js';
export type {
  CharacterGenerationProvenance,
  CharacterGenerationRequest,
  CharacterRoleBundle,
  CohortGenerationAttempt,
  CohortGenerationRequest,
  GeneratedCharacterCohort,
  GeneratedCharacterProfile,
  GeneratedFormativeEventProvenance,
  IntegerGenerationRange,
  NumericGenerationRange,
  RealizedGenerationDraw,
  RoleFormativeEventTemplate,
  RoleIdentityMarker,
  RoleOutletPreference,
} from './generation/character.js';
export { deriveCharacterCheckpoint } from './model/history.js';
export {
  DEFAULT_RESOURCE_PACKAGE_ID,
  parseCharacterLibrary,
  parseEnvironmentLibrary,
  parseResourceFile,
  parseScenario,
  resourceAddressKey,
} from './scenario/parse.js';
export {
  createResourceCatalog,
  createResourceCatalogFromLibraries,
  dependencyClosure,
  prepareScenario,
  prepareScenarioFromLibraries,
  prepareScenarioFromSource,
} from './scenario/prepare.js';
export { createSimulation, createSimulationFromSnapshot } from './scenario/load.js';
export { serializeScenario, serializeSnapshot } from './scenario/serialize.js';
export { parseSnapshot } from './scenario/snapshot.js';
export {
  advanceIntentions,
  intendedTask,
  prepareAgenda,
  setWorldFactAmount,
} from './simulation/agenda.js';
export { appraiseAction } from './simulation/appraisal.js';
export {
  capabilityAvailability,
  capabilityBand,
  resolveAgentCapabilityCheck,
  resolveCapabilityCheck,
} from './simulation/capability.js';
export { evaluateOpportunity, resolveOpportunity } from './simulation/decision.js';
export {
  evaluateDisclosureOpportunity,
  resolveDisclosureOpportunity,
} from './simulation/disclosure.js';
export { evaluateEmpathy } from './simulation/empathy.js';
export {
  advanceCoping,
  allostaticLoadFor,
  resolveAppraisalEvent,
} from './simulation/coping.js';
export {
  effectiveCascadePrior,
  effectiveContractAdherence,
  effectiveDisclosure,
  effectiveEmpathy,
  effectiveIdentity,
  effectiveOutletPreferences,
  effectiveSatisfierPreferences,
  effectiveValueWeight,
  initializeHistoryDerivedState,
} from './simulation/history.js';
export {
  applyAgentValueTurns,
  applyValueTurns,
  reactiveValueTurn,
  reactiveValueTurns,
} from './simulation/value-turn.js';
export {
  advanceSimulation,
  createSimulationFromPrepared,
  createSimulationFromPreparedSnapshot,
  setAgentResource,
  setAgentValueCharge,
} from './simulation/runtime.js';
export {
  MOVEMENT_SPEED_LABELS,
  classifyMovementSpeed,
  describeAgent,
  formatSimulationTime,
} from './simulation/observe.js';
export type { MovementSpeedClass } from './simulation/observe.js';
export {
  DEFAULT_WALKING_METERS_PER_MINUTE,
  applyBuildToWalkingPace,
  deriveBuildEffects,
} from './simulation/physical.js';
export type { BuildEffects } from './simulation/physical.js';
export { resolveObservationEvent } from './simulation/prediction.js';
export { resolveNormObservationEvent } from './simulation/norms.js';
export {
  areasAtPosition,
  environmentLayersTopDown,
  environmentSpatialContextAt,
  relativeLayerLevel,
} from './simulation/environment.js';
export {
  claimExpressionPayoff,
  createNarrativeState,
  prepareNarrativeAgency,
  promoteToInvoker,
  resolveNarrativeEvent,
} from './simulation/narrative.js';
export {
  evaluateRelationshipRequest,
  exposureDebtFor,
  resolveDyadMode,
  resolveRelationshipEvent,
  resolveRelationshipRequest,
  turnDyad,
} from './simulation/relationship.js';
export {
  DAY_PERIOD_IDS,
  DAY_PERIOD_LABELS,
  daylightScheduleForSeason,
  dayPeriodAtMinute,
} from './simulation/atmosphere.js';
export type { DayPeriod } from './simulation/atmosphere.js';
export { effectiveValueWeights } from './simulation/salience.js';
export {
  evaluateEavesdropping,
  evaluateProximity,
  evaluateSpatialPerception,
} from './simulation/spatial.js';
export {
  advanceLayerPosition,
  findNavigationRoute,
  locationCenter,
  navigationDistance,
  sameLayerPosition,
} from './simulation/navigation.js';

export const buildInfo = Object.freeze({
  version: __APP_VERSION__,
  commit: __COMMIT_SHA__,
});
