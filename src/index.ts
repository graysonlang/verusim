// `__APP_VERSION__` and `__COMMIT_SHA__` are substituted at build time by
// esbuild's `define` (see scripts/build.mjs). They are not runtime globals.
/* global __APP_VERSION__, __COMMIT_SHA__ */

export {
  applyTransaction,
  createAuthoringGraph,
  documentById,
  documentIdentity,
  redoTransaction,
  relocateDocument,
  scenarioDocumentId,
  undoTransaction,
  type AuthoringDiagnostic,
  type AuthoringDocument,
  type AuthoringDocumentKind,
  type AuthoringEdit,
  type AuthoringGraph,
  type AuthoringHistoryEntry,
  type AuthoringProvenance,
  type AuthoringTransaction,
} from './authoring/graph.js';
export {
  prepareRevision,
  startRevision,
  type AuthoringRevision,
  type RevisionSimulation,
} from './authoring/revision.js';
export {
  ENSEMBLE_ALGORITHM,
  gradeOutcome,
  materializeVariant,
  runEnsemble,
  runVariant,
  type EnsembleDimension,
  type EnsembleOptions,
  type EnsembleReport,
  type EnsembleRun,
  type EnsembleVariant,
  type Falsifier,
  type FalsifierGrade,
  type FalsifierGradeRecord,
  type FalsifierOutcome,
  type FalsifierVerdict,
  type VariantReport,
  type VignetteDefinition,
} from './acceptance/ensemble.js';
export { endicottMarguerittevignette, pottsfieldVignette } from './acceptance/vignettes.js';
export {
  RETENTION_BY_TIER,
  SYSTEM_TRACE_ENTRIES,
  memoryWindow,
  recordWindows,
  retainCharacterRecord,
  traceWindow,
  type TierRetention,
} from './model/retention.js';
export { CHARACTER_TIERS, type CharacterTier } from './model/types.js';
export { canonicalJson, contentDigest } from './scenario/digest.js';
export { validatePreparedScenario } from './scenario/prepare.js';
export { validateSnapshotReferences } from './scenario/snapshot-references.js';
export {
  CAPABILITY_IDS,
  HEIGHT_CLASSES,
  INCIDENT_ROOT_IMPACTS,
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
export {
  generatePrecontactDyads,
  generateRecentCohortHistory,
} from './generation/cohort-context.js';
export { generateEnvironmentLayout } from './generation/environment.js';
export { generateIncident } from './generation/incident.js';
export {
  parseGenerationProject,
  prepareGenerationProject,
  validateGenerationProject,
} from './generation/project.js';
export type {
  CharacterGenerationProvenance,
  CharacterGenerationRequest,
  CharacterRoleBundle,
  CohortGenerationAttempt,
  CohortGenerationRequest,
  GeneratedCharacterCohort,
  GeneratedCharacterProfile,
  GeneratedFormativeEventProvenance,
  RoleFormativeEventTemplate,
  RoleIdentityMarker,
  RoleOutletPreference,
} from './generation/character.js';
export type {
  CohortContextMember,
  GeneratedPrecontactDyads,
  GeneratedRecentCohortHistory,
  PrecontactDyadProvenance,
  PrecontactGenerationRequest,
  PrecontactKind,
  PrecontactSeedInput,
  RecentCohortEventProvenance,
  RecentCohortHistoryRequest,
  RecentFormativeEventTemplate,
} from './generation/cohort-context.js';
export type {
  EnvironmentAreaTemplate,
  EnvironmentConnectorTemplate,
  EnvironmentGenerationBlueprint,
  EnvironmentGenerationProvenance,
  EnvironmentGenerationRequest,
  EnvironmentLayerTemplate,
  EnvironmentLocationTemplate,
  FractionalBoundsTemplate,
  FractionalLayerPositionTemplate,
  GeneratedEnvironmentLayout,
} from './generation/environment.js';
export type {
  GeneratedIncident,
  IncidentGenerationRequest,
  IncidentSamplingProvenance,
  IncidentTemplate,
} from './generation/incident.js';
export type {
  GenerationProjectFile,
  GenerationValidationDiagnostic,
  GenerationValidationReport,
  GenerationValidationSummary,
  PreparedGenerationProject,
} from './generation/project.js';
export type {
  IntegerGenerationRange,
  NumericGenerationRange,
  RealizedGenerationDraw,
} from './generation/sampler.js';
export {
  CADENCE_TIERS,
  DEFAULT_CADENCE_POLICY,
  cadenceLogicalTick,
  catchUpConstantRate,
  createCadenceSession,
  flushCadence,
  parseCadenceSave,
  resumeCadenceSave,
  retierCadence,
  scheduleCadence,
  serializeCadenceSave,
} from './integration/cadence.js';
export type {
  CadencePolicy,
  CadenceSaveFile,
  CadenceSession,
  CadenceTier,
} from './integration/cadence.js';
export {
  projectEmbodiedObservation,
  projectTextObservation,
} from './integration/observation.js';
export type {
  EmbodiedObservationProjection,
  TextObservationProjection,
} from './integration/observation.js';
export {
  LOW_STAKES_EXCHANGE_MAX,
  evaluateOrbitExchange,
  resolveOrbitExchange,
} from './integration/orbit.js';
export type { LowStakesExchange, OrbitSettlement } from './integration/orbit.js';
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
  ADULT_BASELINE_CHANGE_CAP_PER_YEAR,
  BASELINE_PLASTICITY_YEAR_SECONDS,
  advanceBaselinePlasticity,
  baselinePlasticityRateForAge,
} from './simulation/plasticity.js';
export type {
  BaselinePlasticityAdvance,
  BaselinePlasticitySignal,
} from './simulation/plasticity.js';
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
  resolveCharacterCapabilityCheck,
  resolveCapabilityCheck,
} from './simulation/capability.js';
export { evaluateOpportunity, resolveOpportunity } from './simulation/decision.js';
export {
  evaluateDisclosureOpportunity,
  resolveDisclosureOpportunity,
} from './simulation/disclosure.js';
export { evaluateEmpathy } from './simulation/empathy.js';
export { resolveDisplayEvent } from './simulation/display.js';
export { resolveIncidentEvent } from './simulation/incident.js';
export {
  advanceSomaticState,
  applySomaticResourceTax,
  createSomaticState,
  deriveSomaticState,
  resolveSomaticEvent,
  somaticActivityLabel,
  somaticActionAvailable,
} from './simulation/somatic.js';
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
  effectiveNormInternalization,
  effectiveOutletPreferences,
  effectiveSatisfierPreferences,
  effectiveValueWeight,
  initializeHistoryDerivedState,
} from './simulation/history.js';
export {
  applyCharacterValueTurns,
  applyValueTurns,
  reactiveValueTurn,
  reactiveValueTurns,
} from './simulation/value-turn.js';
export {
  advanceSimulation,
  createSimulationFromPrepared,
  createSimulationFromPreparedSnapshot,
  setCharacterResource,
  setCharacterValueCharge,
} from './simulation/runtime.js';
export {
  MOVEMENT_SPEED_LABELS,
  classifyMovementSpeed,
  describeCharacter,
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
  dayPeriodAtSecond,
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
