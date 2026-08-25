export const VALUE_IDS = [
  'safety',
  'belonging',
  'respect',
  'autonomy',
  'competence',
  'fairness',
] as const;

export type ValueId = (typeof VALUE_IDS)[number];

export type ValueMap<Value> = { [Key in ValueId]: Value };

export const RESOURCE_KINDS = [
  'character-profile',
  'environment-layout',
  'norm',
  'social-contract',
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const CHARACTER_TIERS = ['principal', 'secondary', 'background'] as const;
export type CharacterTier = (typeof CHARACTER_TIERS)[number];

export interface ResourceAddress {
  kind: ResourceKind;
  packageId: string;
  resourceId: string;
}

export interface CharacterProfileAddress extends ResourceAddress {
  kind: 'character-profile';
}

export interface EnvironmentLayoutAddress extends ResourceAddress {
  kind: 'environment-layout';
}

export interface NormAddress extends ResourceAddress {
  kind: 'norm';
}

export interface SocialContractAddress extends ResourceAddress {
  kind: 'social-contract';
}

export const SOCIAL_FEATURE_IDS = [
  'kinship',
  'familiarity',
  'similarity',
  'reciprocity',
  'category',
] as const;

export type SocialFeatureId = (typeof SOCIAL_FEATURE_IDS)[number];

export type SocialFeatureMap = { [Key in SocialFeatureId]: number };

export const CAPABILITY_IDS = ['acuity', 'evidenceCalibration', 'expressiveControl'] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export type CapabilityMap<Value> = { [Key in CapabilityId]: Value };

export const HEIGHT_CLASSES = ['short', 'average', 'tall'] as const;

export type HeightClass = (typeof HEIGHT_CLASSES)[number];

export const WEIGHT_CLASSES = ['light', 'average', 'heavy'] as const;

export type WeightClass = (typeof WEIGHT_CLASSES)[number];

export const SEX_IDS = ['female', 'male', 'intersex', 'unspecified'] as const;

export type Sex = (typeof SEX_IDS)[number];

export interface PhysicalBuild {
  heightClass: HeightClass;
  weightClass: WeightClass;
}

export interface PhysicalProfile {
  ageYears: number;
  build: PhysicalBuild;
  comeliness: number;
  sex: Sex;
}

export type CapabilityResolutionBand =
  | 'strong-yes'
  | 'weak-yes'
  | 'so-so'
  | 'weak-no'
  | 'strong-no'
  | 'strike'
  | 'pass';

export interface CapabilityModifier {
  id: string;
  source: string;
  value: number;
}

export interface CapabilityCheck {
  applicable: boolean;
  availableCapacity: number;
  availableCapacitySources: string[];
  baseCapability: number;
  capabilitySource: string;
  capabilityId: CapabilityId;
  difficulty: number;
  difficultySource: string;
  known: boolean;
  modifiers: CapabilityModifier[];
}

export type CharacterCapabilityCheck = Omit<
  CapabilityCheck,
  'availableCapacity' | 'availableCapacitySources' | 'baseCapability' | 'capabilitySource'
>;

export interface CapabilityResolution {
  availableCapacity: number;
  band: CapabilityResolutionBand;
  baseCapability: number;
  capabilityId: CapabilityId;
  difficulty: number;
  effectiveCapability: number;
  margin: number | null;
  modifiers: CapabilityModifier[];
  terms: TraceTerm[];
}

export interface Point {
  x: number;
  y: number;
}

export interface LayerPosition extends Point {
  layerId: string;
}

export interface Bounds extends Point {
  height: number;
  width: number;
}

export type ProximityBand = 'contact' | 'intimate' | 'personal' | 'social' | 'public';

export interface ProximityAssessment {
  band: ProximityBand;
  comfortableDistanceMeters: number;
  discomfort: number;
  distanceMeters: number;
  observerId: string;
  relationshipCloseness: number;
  socialBattery: number;
  subjectId: string;
  terms: TraceTerm[];
  valueTurns: Partial<ValueMap<number>>;
}

export interface SensoryAssessment {
  acuity: number;
  available: boolean;
  maxRangeMeters: number;
  occlusion: number;
  strength: number;
}

export interface SpatialPerceptionAssessment {
  distanceMeters: number;
  hearing: SensoryAssessment;
  observerId: string;
  sight: SensoryAssessment;
  subjectId: string;
  terms: TraceTerm[];
}

export type EavesdroppingReason = 'concealed' | 'exposed' | 'out-of-earshot';

export interface EavesdroppingAssessment {
  concealment: number;
  detectedBySpeaker: boolean;
  hearing: SensoryAssessment;
  listenerId: string;
  possible: boolean;
  proximity: ProximityAssessment;
  reason: EavesdroppingReason;
  speakerId: string;
  terms: TraceTerm[];
}

export interface Constitution {
  baselineArousal: number;
  habituationRate: number;
  reactivity: number;
  recoveryRate: number;
  socialValence: number;
  threshold: number;
}

export interface ValueDisposition {
  initialCharge: number;
  initialDeficit: number;
  initialVariance: number;
  weight: number;
}

export interface IdentityMarker {
  centrality: number;
  marker: string;
}

export type NarrativeClaimKind = 'affirm' | 'deny' | 'deserve';

export interface NarrativeClaimSeed {
  commitment: number;
  confidence: number;
  id: string;
  kind: NarrativeClaimKind;
  statement: string;
}

export interface FormativeEvent {
  age: number;
  attribution: string | null;
  copingPotential: number;
  summary: string;
  turn: number;
  value: ValueId;
}

export type HistoryDerivedEmpathyOverride = Partial<Omit<EmpathyEnvelope, 'featureWeights'>> & {
  featureWeights?: Partial<SocialFeatureMap>;
};

export interface HistoryDerivedOverrides {
  cascadePriors?: Partial<CascadePriorMap>;
  contractAdherence?: number;
  disclosure?: Partial<DisclosureEnvelope>;
  empathy?: HistoryDerivedEmpathyOverride;
  identity?: IdentityMarker[];
  normInternalizations?: Record<string, number>;
  outletPreferences?: OutletPreference[];
  satisfierPreferences?: SatisfierPreference[];
  valueWeights?: Partial<ValueMap<number>>;
}

export interface FormativeDispositionRecord {
  age: number;
  appliedTurn: number;
  attribution: string | null;
  authoredTurn: number;
  copingPotential: number;
  eventId: string;
  eventIndex: number;
  memoryId: string;
  previousCharge: number;
  previousWeight: number;
  profileId: string;
  resultingCharge: number;
  resultingWeight: number;
  source: string;
  valueId: ValueId;
}

export type BaselinePlasticityMechanism =
  | 'outlet-promotion'
  | 'rewarded-masking'
  | 'rupture-crystallization';

export type BaselinePlasticityTargetKind = 'cascade-prior' | 'identity-marker';

export interface BaselinePlasticityTarget {
  id: string;
  kind: BaselinePlasticityTargetKind;
}

export interface BaselinePlasticityAccumulator {
  appliedChange: number;
  earnedChange: number;
  integratedYears: number;
  key: string;
  mechanism: BaselinePlasticityMechanism;
  target: BaselinePlasticityTarget;
}

export interface BaselinePlasticityRecord {
  ageYears: number;
  appliedChange: number;
  integratedYears: number;
  mechanism: BaselinePlasticityMechanism;
  second: number;
  previous: number;
  resulting: number;
  source: string;
  target: BaselinePlasticityTarget;
}

export interface BaselinePlasticityState {
  accumulators: BaselinePlasticityAccumulator[];
  records: BaselinePlasticityRecord[];
}

export interface HistoryDerivedState {
  formativeRecords: FormativeDispositionRecord[];
  overrides: HistoryDerivedOverrides;
  plasticity: BaselinePlasticityState;
}

export interface FormativeMemoryProvenance {
  age: number;
  attribution: string | null;
  copingPotential: number;
  eventId: string;
  eventIndex: number;
  profileId: string;
  source: string;
  turn: number;
  valueId: ValueId;
}

export interface EmpathyEnvelope {
  ceiling: number;
  featureWeights: SocialFeatureMap;
  floor: number;
  selfPosition: number;
  steepness: number;
  threatSensitivity: number;
}

export interface DisclosureEnvelope {
  intimateSafety: number;
  strangerSafety: number;
  troughDepth: number;
  troughPosition: number;
  troughWidth: number;
}

export interface CharacterDefinition {
  capabilities: CapabilityMap<number>;
  cascadePriors: CascadePriorMap;
  constitution: Constitution;
  contractAdherence: number;
  disclosure: DisclosureEnvelope;
  empathy: EmpathyEnvelope;
  formativeEvents: FormativeEvent[];
  characterId: string;
  identity: IdentityMarker[];
  name: string;
  narrativeClaims: NarrativeClaimSeed[];
  outletPreferences: OutletPreference[];
  physical: PhysicalProfile;
  profileId: string;
  role: string;
  satisfierPreferences: SatisfierPreference[];
  summary: string;
  values: ValueMap<ValueDisposition>;
}

export interface CharacterLibraryFile {
  characters: CharacterDefinition[];
  schemaVersion: 7;
}

export interface CharacterProfileResourceFile {
  address: CharacterProfileAddress;
  profile: CharacterDefinition;
  schemaVersion: 1;
}

export const OUTLET_OPERATIONS = [
  'discharge',
  'numb',
  'substitute',
  'regulate',
  'control',
  'avoid',
] as const;

export type OutletOperation = (typeof OUTLET_OPERATIONS)[number];

export type CascadePriorMap = Record<Exclude<CascadePosition, 'none'>, number>;

export interface OutletPreference {
  operation: OutletOperation;
  rank: number;
}

export type SatisfierType = 'deficit' | 'surplus';

export interface SatisfierPreference {
  flavor: string;
  type: SatisfierType;
  valueId: ValueId;
}

export type AreaKind = 'building' | 'field' | 'forest' | 'grass' | 'market' | 'path' | 'water';

export interface EnvironmentCover {
  hearingOcclusion: number;
  overhead: number;
  sightOcclusion: number;
}

export type EnvironmentEnclosure = 'exterior' | 'interior';

export interface EnvironmentArea extends Bounds {
  cover: EnvironmentCover;
  enclosure: EnvironmentEnclosure;
  id: string;
  kind: AreaKind;
  layerId: string;
  label?: string;
}

export interface LocationDefinition extends Bounds {
  id: string;
  kind: string;
  layerId: string;
  name: string;
}

export interface EnvironmentLayer {
  elevationMeters: number;
  id: string;
  name: string;
}

export type EnvironmentConnectorKind = 'ladder' | 'ramp' | 'stairs';

export interface EnvironmentConnector {
  from: LayerPosition;
  id: string;
  kind: EnvironmentConnectorKind;
  to: LayerPosition;
  traversalDistanceMeters: number;
}

export interface EnvironmentDefinition {
  areas: EnvironmentArea[];
  connectors: EnvironmentConnector[];
  environmentId: string;
  height: number;
  layoutId: string;
  layers: EnvironmentLayer[];
  locations: LocationDefinition[];
  name: string;
  outletAffordances: OutletAffordance[];
  width: number;
}

export interface EnvironmentLibraryFile {
  environments: EnvironmentDefinition[];
  schemaVersion: 4;
}

export interface EnvironmentLayoutResourceFile {
  address: EnvironmentLayoutAddress;
  layout: EnvironmentDefinition;
  schemaVersion: 4;
}

export interface NormDefinition {
  compatibilityTurns: Partial<ValueMap<number>>;
  interpretations: NormInterpretation[];
  label: string;
}

export interface NormResourceFile {
  address: NormAddress;
  norm: NormDefinition;
  schemaVersion: 2;
}

export interface SocialContractDefinition {
  enforcementSeverity: number;
  label: string;
  norms: NormAddress[];
  summary: string;
}

export interface SocialContractResourceFile {
  address: SocialContractAddress;
  contract: SocialContractDefinition;
  schemaVersion: 2;
}

export type ResourceFile =
  | CharacterProfileResourceFile
  | EnvironmentLayoutResourceFile
  | NormResourceFile
  | SocialContractResourceFile;

export interface AuthoredResource {
  source: string;
  value: unknown;
}

export interface ResourceCatalogEntry {
  address: ResourceAddress;
  resource: ResourceFile;
  source: string;
}

export interface ResourceCatalog {
  entries: readonly ResourceCatalogEntry[];
}

export interface ContentSource {
  read(address: ResourceAddress): Promise<unknown>;
}

export interface ResourceLock {
  /** Canonical content digest of every locked resource, or null for snapshots saved before digests existed. */
  digest: string | null;
  resources: readonly ResourceAddress[];
}

export type ReinforcementSchedule = 'fixed' | 'variable-ratio';

export interface OutletAffordance {
  displacesRepair: boolean;
  durationSeconds: number;
  id: string;
  label: string;
  operation: OutletOperation;
  potency: number;
  reinforcementSchedule: ReinforcementSchedule;
  satisfierFlavor: string | null;
  targetValueId: ValueId;
  toleranceBuild: number;
  valueDamage: number;
}

export type RecoveryMode = 'break' | 'none' | 'rest' | 'sleep';

export interface ScheduleBlock {
  activity: string;
  locationId: string;
  maskingDemand: MaskingDemand | null;
  recoveryMode: RecoveryMode;
  resourceDrainsPerHour: Partial<ResourceState>;
  startSecond: number;
}

export interface MaskingDemand {
  audienceCount: number;
  exposureRisk: number;
  fabricated: boolean;
  presentationGap: number;
}

export interface ValueState {
  charge: number;
  deficitIntegral: number;
  variance: number;
}

export interface ResourceState {
  executiveBudget: number;
  physicalStamina: number;
  regulationReserve: number;
  socialBattery: number;
}

export interface CharacterPlacement {
  agency: AgencyMode;
  profile: CharacterProfileAddress;
  initialResources?: Partial<ResourceState>;
  initialSomaticSources: SomaticSourceSeed[];
  initialValues?: Partial<ValueMap<Partial<ValueState>>>;
  instanceId: string;
  narrativeOverrides: NarrativeClaimOverride[];
  normPerspectives: NormPerspective[];
  position: LayerPosition;
  schedule: ScheduleBlock[];
  tier: CharacterTier;
  walkingMetersPerMinute?: number;
}

export type AgencyMode = 'invoker' | 'responder';

export interface NarrativeClaimOverride {
  claimId: string;
  commitment?: number;
  confidence?: number;
}

export interface NormPerspective {
  affiliated: boolean;
  internalization: number;
  legibility: number;
  norm: NormAddress;
}

export type DyadMode = 'courteous' | 'contesting' | 'guarded' | 'ruptured' | 'warm';

export interface DyadSeed {
  behaviorVariance: number;
  estimateConfidence: number;
  estimatedDisclosure: number;
  estimatedEmpathy: number;
  exposureDebt: number;
  features: SocialFeatureMap;
  integratedHistory: number;
  mode: DyadMode;
  observerId: string;
  predictionError: number;
  stance: number;
  subjectId: string;
  suspicion: number;
  validatorClaimIds: string[];
}

export type DyadState = DyadSeed;

export interface RelationshipEvent {
  atSecond: number;
  id: string;
  observerId: string;
  stanceTurn: number;
  subjectId: string;
  summary: string;
}

export interface RelationshipRequestOpportunity {
  atSecond: number;
  id: string;
  label: string;
  magnitude: number;
  requesterId: string;
  responderId: string;
}

export interface DisclosureItemSeed {
  id: string;
  knownByIds: string[];
  ownerId: string;
  shameCharge: number;
  summary: string;
}

export interface DisclosureOpportunity {
  atSecond: number;
  audienceIds: string[];
  disclosureBenefit: number;
  id: string;
  itemId: string;
  networkConductivity: number;
  ownerId: string;
}

export const MIND_MODEL_DIMENSIONS = ['empathy', 'disclosure'] as const;

export type MindModelDimension = (typeof MIND_MODEL_DIMENSIONS)[number];

export const OBSERVATION_CHANNELS = ['hearing', 'sight'] as const;

export type ObservationChannel = (typeof OBSERVATION_CHANNELS)[number];

export const OBSERVATION_EVENT_TYPES = ['mind-model', 'norm'] as const;

export type ObservationEventType = (typeof OBSERVATION_EVENT_TYPES)[number];

export interface ObservationEventBase {
  atSecond: number;
  audibleRadiusMeters: number;
  channel: ObservationChannel;
  id: string;
  interpretationDifficulty: number;
  observerIds: string[];
  subjectId: string;
  visualProminence: number;
}

export interface MindModelObservationEvent extends ObservationEventBase {
  diagnosticity: number;
  dimension: MindModelDimension;
  eventType: 'mind-model';
  observedValue: number;
}

export interface NormObservationEvent extends ObservationEventBase {
  baselineTurns: Partial<ValueMap<number>>;
  compatibility: number;
  eventType: 'norm';
  norm: NormAddress;
  summary: string;
}

export type ObservationEvent = MindModelObservationEvent | NormObservationEvent;

export const INCIDENT_ROOT_IMPACTS = [
  'accidental-disclosure',
  'material-gain',
  'material-loss',
  'norm-violation',
  'obligation-created',
  'physical-harm-risk',
  'public-status-shift',
] as const;

export type IncidentRootImpact = (typeof INCIDENT_ROOT_IMPACTS)[number];

export type IncidentAttribution = 'ambiguous' | 'nobody' | 'other' | 'self';
export type IncidentPerceivedAttribution = Exclude<IncidentAttribution, 'ambiguous'>;
export type IncidentPublicity = 'private' | 'public' | 'witnessed';
export type IncidentVolition = 'careless' | 'deliberate' | 'involuntary';

export interface NormInterpretation {
  identityStake: number;
  rootImpact: IncidentRootImpact;
  turns: Partial<ValueMap<number>>;
}

export interface IncidentGenerationDraw {
  label: string;
  maximum: number;
  minimum: number;
  position: number;
  unit: number;
  value: number;
}

export interface IncidentGenerationMetadata {
  algorithm: 'verusim-incident-v1';
  draws: IncidentGenerationDraw[];
  eligibleWeights: Array<{ instanceId: string; weight: number }>;
  samplerEnd: number;
  samplerStart: number;
  seed: number;
  templateId: string;
}

export interface IncidentContext {
  groupIds: string[];
  institutionIds: string[];
  locationId: string | null;
}

export interface IncidentEvent {
  actorId: string | null;
  affectedInstanceId: string;
  atSecond: number;
  attribution: IncidentAttribution;
  audibleRadiusMeters: number;
  context: IncidentContext;
  generation: IncidentGenerationMetadata | null;
  id: string;
  interpretationDifficulty: number;
  magnitude: number;
  observerIds: string[];
  publicity: IncidentPublicity;
  rootImpact: IncidentRootImpact;
  summary: string;
  visualProminence: number;
  volition: IncidentVolition;
}

export interface DisplayEvent {
  atSecond: number;
  context: IncidentContext;
  displayId: string;
  domainContested: boolean;
  habituationPerExposure: number;
  id: string;
  magnitude: number;
  observerIds: string[];
  statusMarker: string;
  summary: string;
  visualProminence: number;
  wearerId: string;
}

export type SomaticCadence = 'fluctuating' | 'steady';
export type SomaticPreemption = 'dead' | 'emergency' | 'incapacitated' | 'none';
export type SomaticLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface SomaticSourceSeed {
  attentionTax: number;
  cadence: SomaticCadence;
  copingPotential: number;
  id: string;
  impairment: number;
  label: string;
  origin: 'activity' | 'environment' | 'event';
  pain: number;
  preemption: SomaticPreemption;
  perceivedUrgency: number;
  visible: number;
}

export interface SomaticSourceState extends SomaticSourceSeed {
  habituation: number;
}

export interface SomaticState {
  attentionTax: number;
  impairment: number;
  level: SomaticLevel;
  pain: number;
  perceivedUrgency: number;
  sources: SomaticSourceState[];
  threatContribution: number;
}

export interface SomaticEvent {
  instanceId: string;
  atSecond: number;
  id: string;
  observerIds: string[];
  operation: 'clear' | 'set';
  source: SomaticSourceSeed | null;
  sourceId: string;
  summary: string;
  visualProminence: number;
}

export interface LegacyLocalNorm extends NormDefinition {
  address: NormAddress;
}

export const SOCIAL_CONTRACT_SCOPE_KINDS = ['event', 'group', 'institution', 'location'] as const;

export type SocialContractScopeKind = (typeof SOCIAL_CONTRACT_SCOPE_KINDS)[number];

export type SocialContractScope =
  | { eventId: string; kind: 'event' }
  | { groupId: string; kind: 'group' }
  | { institutionId: string; kind: 'institution' }
  | { kind: 'location'; locationId: string };

export interface SocialContractPlacement {
  contract: SocialContractAddress;
  enforcementPresence: number;
  id: string;
  scope: SocialContractScope;
}

export interface WorldFact {
  amount: number;
  id: string;
}

export interface FactCondition {
  factId: string;
  minimum: number;
}

export interface FactEffect {
  delta: number;
  factId: string;
}

export type GoalSource = 'aspiration' | 'need' | 'obligation' | 'scenario' | 'want';

export interface AgendaGoalSeed {
  activationSecond: number;
  actorId: string;
  commitment: number;
  claimExpressions: ClaimExpression[];
  deadlineSecond: number | null;
  desired: FactCondition[];
  failureTurns: Partial<ValueMap<number>>;
  id: string;
  label: string;
  source: GoalSource;
  successTurns: Partial<ValueMap<number>>;
  urgencyHorizonSeconds: number;
}

export interface TaskOperator {
  actorIds: string[];
  availableFromSecond: number | null;
  availableUntilSecond: number | null;
  contractViolation: number;
  claimExpressions: ClaimExpression[];
  durationSeconds: number;
  effects: FactEffect[];
  id: string;
  label: string;
  locationId: string;
  maskingDemand: MaskingDemand | null;
  preconditions: FactCondition[];
  recoveryMode: RecoveryMode;
  resourceCosts: Partial<ResourceState>;
  resourceDrainsPerHour: Partial<ResourceState>;
  somaticDemand: number;
  valueTurns: Partial<ValueMap<number>>;
}

export interface ActionImpact {
  subjectId: string;
  turns: Partial<ValueMap<number>>;
}

export interface ActionCandidate {
  claimExpressions: ClaimExpression[];
  contractViolation: number;
  id: string;
  impacts: ActionImpact[];
  label: string;
  operation: string;
  repercussionSeverity: number;
  selfDirected: boolean;
  somaticDemand: number;
}

export interface ClaimExpression {
  claimId: string;
  strength: number;
  valueId: ValueId;
}

export interface AspirationOpportunity {
  atSecond: number;
  actorId: string;
  claimExpressions: ClaimExpression[];
  claimId: string;
  commitment: number;
  deadlineSecond: number | null;
  desired: FactCondition[];
  failureTurns: Partial<ValueMap<number>>;
  id: string;
  label: string;
  successTurns: Partial<ValueMap<number>>;
  urgencyHorizonSeconds: number;
}

export interface ReputationGroup {
  id: string;
  label: string;
  memberIds: string[];
}

export interface ClaimEvidenceEvent {
  actorId: string;
  alignment: number;
  atSecond: number;
  claimId: string;
  eventType: 'claim-evidence';
  id: string;
  summary: string;
}

export interface SelfDeprecationAgreementEvent {
  actorId: string;
  atSecond: number;
  claimId: string;
  disclosureItemId: string | null;
  eventType: 'self-deprecation-agreement';
  id: string;
  responderId: string;
  summary: string;
}

export interface AttributionEvent {
  atSecond: number;
  audienceId: string;
  audienceType: 'agent' | 'group';
  claim: string;
  compatibility: number;
  confidence: number;
  eventType: 'attribution';
  id: string;
  selfClaimId: string;
  sourceId: string;
  subjectId: string;
  summary: string;
}

export type NarrativeEvent = AttributionEvent | ClaimEvidenceEvent | SelfDeprecationAgreementEvent;

export interface DecisionContext {
  enforcementPresence: number;
  networkConductivity: number;
  perceivedThreat: number;
  witnessIds: string[];
}

export interface BehaviorOpportunity {
  actorId: string;
  atSecond: number;
  candidates: ActionCandidate[];
  context: DecisionContext;
  id: string;
  targetId: string | null;
}

export const TIME_RATE_IDS = [
  'real-time',
  '2x',
  '5x',
  '10x',
  '15x',
  '1-minute-per-second',
  '2-minutes-per-second',
  '5-minutes-per-second',
  '10-minutes-per-second',
  '30-minutes-per-second',
  '60-minutes-per-second',
] as const;

export type TimeRateId = (typeof TIME_RATE_IDS)[number];

export const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'] as const;

export type Season = (typeof SEASON_IDS)[number];

export const WEATHER_IDS = ['clear', 'cloudy', 'fog', 'overcast', 'rain', 'storm', 'snow'] as const;

export type WeatherCondition = (typeof WEATHER_IDS)[number];

export interface EnvironmentConditions {
  season: Season;
  temperatureCelsius: number;
  weather: WeatherCondition;
}

export interface ScenarioFile {
  agendaGoals: AgendaGoalSeed[];
  ambientTurnsPerHour?: Partial<ValueMap<number>>;
  ambientSomaticSources: SomaticSourceSeed[];
  appraisalEvents: AppraisalEvent[];
  aspirationOpportunities: AspirationOpportunity[];
  behaviorOpportunities: BehaviorOpportunity[];
  characters: CharacterPlacement[];
  disclosureItems: DisclosureItemSeed[];
  disclosureOpportunities: DisclosureOpportunity[];
  displayEvents: DisplayEvent[];
  dyads: DyadSeed[];
  environment: EnvironmentLayoutAddress;
  environmentConditions: EnvironmentConditions;
  id: string;
  incidentEvents: IncidentEvent[];
  initialTimeRate?: TimeRateId;
  legacyLocalNorms: LegacyLocalNorm[];
  narrativeEvents: NarrativeEvent[];
  observationEvents: ObservationEvent[];
  relationshipEvents: RelationshipEvent[];
  relationshipRequests: RelationshipRequestOpportunity[];
  reputationGroups: ReputationGroup[];
  schemaVersion: 19;
  socialContractPlacements: SocialContractPlacement[];
  somaticEvents: SomaticEvent[];
  startSecond: number;
  summary: string;
  taskOperators: TaskOperator[];
  tickSeconds: number;
  title: string;
  worldFacts: WorldFact[];
}

export interface RuntimeMemory {
  emotionalTurn?: number;
  id: string;
  second: number;
  provenance?: FormativeMemoryProvenance;
  subjectId?: string;
  summary: string;
  type:
    | 'activity'
    | 'aftermath'
    | 'disclosure'
    | 'formative'
    | 'goal'
    | 'intervention'
    | 'narrative'
    | 'relationship'
    | 'task';
}

export interface AppraisalEvent {
  instanceId: string;
  atSecond: number;
  believedLeverage: boolean;
  copingPotential: number;
  exitAvailable: boolean;
  id: string;
  localized: boolean;
  socialTargetId: string | null;
  summary: string;
  threat: number;
  turns: Partial<ValueMap<number>>;
}

export type CascadePosition = 'none' | 'freeze' | 'fight' | 'flight' | 'fawn' | 'flop';

export interface CharacterInstance {
  cascade: CascadePosition;
  cascadeDwellUntilSecond: number;
  cascadeLoad: number;
  cascadeTargetId: string | null;
  currentOutlet: OutletSelection | null;
  currentActivity: string;
  currentLocationId: string | null;
  destination: LayerPosition;
  history: HistoryDerivedState;
  id: string;
  memories: RuntimeMemory[];
  narrative: NarrativeState | null;
  outletHistory: OutletUseState[];
  positionalRespect: PositionalRespectState;
  position: LayerPosition;
  profile: CharacterDefinition;
  resources: ResourceState;
  schedule: ScheduleBlock[];
  somatic: SomaticState;
  tier: CharacterTier;
  values: ValueMap<ValueState>;
  walkingMetersPerMinute: number;
}

export type TraceKind =
  | 'activity'
  | 'aftermath'
  | 'agenda'
  | 'appraisal'
  | 'cascade'
  | 'decision'
  | 'disclosure-appraisal'
  | 'disclosure-decision'
  | 'display-appraisal'
  | 'gate'
  | 'goal'
  | 'intervention'
  | 'intention'
  | 'incident-appraisal'
  | 'norm-appraisal'
  | 'narrative'
  | 'observation'
  | 'outlet'
  | 'prediction'
  | 'reputation'
  | 'relationship'
  | 'resource'
  | 'scenario'
  | 'somatic'
  | 'task'
  | 'value-turn';

export type TraceScalar = boolean | number | string | null;

export interface TraceTerm {
  id: string;
  sources: string[];
  value: TraceScalar;
}

export type TraceSelectionRule =
  | 'highest-score-then-authored-order'
  | 'highest-utility-then-authored-order'
  | 'positive-utility'
  | 'preempt-gate';

export interface TraceSelection {
  rule: TraceSelectionRule;
  selectedId: string | null;
}

export interface TraceEntry {
  instanceId: string | null;
  id: string;
  kind: TraceKind;
  second: number;
  sequence: number;
  selection: TraceSelection | null;
  summary: string;
  terms: TraceTerm[];
  tick: number;
}

/** A trace entry before `appendTrace` assigns its per-character sequence. */
export type TraceEntryInput = Omit<TraceEntry, 'sequence'>;

export interface CausalTrace {
  entries: TraceEntry[];
  schemaVersion: 2;
  /** Next-sequence counters per character instance, plus `*` for entries with no character. */
  sequences: Record<string, number>;
  /** Retention window per character instance, derived from placement tier. */
  windows: Record<string, number>;
}

export interface SimulationState {
  appraisalRecords: AppraisalRecord[];
  agendaDecisions: AgendaDecisionRecord[];
  agendaGoals: AgendaGoalState[];
  characters: CharacterInstance[];
  decisions: DecisionRecord[];
  disclosureDecisions: DisclosureDecisionRecord[];
  disclosureItems: DisclosureItemSeed[];
  displayExposures: DisplayExposureState[];
  displayRecords: DisplayResolutionRecord[];
  dyads: DyadState[];
  environment: EnvironmentDefinition;
  incidentRecords: IncidentAppraisalRecord[];
  intentions: TaskIntention[];
  second: number;
  narrativeRecords: NarrativeRecord[];
  norms: readonly NormResourceFile[];
  observations: ObservationRecord[];
  plans: AgendaPlan[];
  relationshipDecisions: RelationshipDecisionRecord[];
  reputations: AttributedNarrative[];
  resourceLock: ResourceLock;
  resolvedDisclosureOpportunityIds: string[];
  resolvedDisplayEventIds: string[];
  resolvedIncidentEventIds: string[];
  resolvedObservationEventIds: string[];
  resolvedOpportunityIds: string[];
  resolvedAppraisalEventIds: string[];
  resolvedAspirationOpportunityIds: string[];
  resolvedNarrativeEventIds: string[];
  resolvedRelationshipEventIds: string[];
  resolvedRelationshipRequestIds: string[];
  resolvedSomaticEventIds: string[];
  scenario: ScenarioFile;
  socialContracts: readonly SocialContractResourceFile[];
  somaticRecords: SomaticResolutionRecord[];
  tick: number;
  trace: CausalTrace;
  worldFacts: WorldFact[];
  worldRevision: number;
}

export interface OutletSelection {
  affordanceId: string;
  label: string;
  operation: OutletOperation;
  remainingSeconds: number;
  startedSecond: number;
  targetValueId: ValueId;
  yield: number;
}

export interface OutletUseState {
  affordanceId: string;
  habituation: number;
  uses: number;
}

export interface AppraisalRecord {
  instanceId: string;
  appliedTurns: Partial<ValueMap<number>>;
  cascadeLoad: number;
  copingPotential: number;
  effectiveCoping: number;
  eventId: string;
  id: string;
  second: number;
  nextCascade: CascadePosition;
  previousCascade: CascadePosition;
  socialTargetId: string | null;
  somaticImpairment: number;
  somaticThreatContribution: number;
  tick: number;
}

export interface ScenarioContent {
  characterLibrary: CharacterLibraryFile;
  environmentLibrary: EnvironmentLibraryFile;
  norms: NormResourceFile[];
  scenario: ScenarioFile;
  socialContracts: SocialContractResourceFile[];
}

export interface PreparedCharacterPlacement {
  placement: CharacterPlacement;
  profile: CharacterDefinition;
}

export interface PreparedScenario {
  characters: readonly PreparedCharacterPlacement[];
  environment: EnvironmentDefinition;
  norms: readonly NormResourceFile[];
  resourceLock: ResourceLock;
  scenario: ScenarioFile;
  schemaVersion: 2;
  socialContracts: readonly SocialContractResourceFile[];
  type: 'verusim-prepared-scenario';
}

export interface ValueImpact {
  empathy: number;
  subjectId: string;
  turns: Partial<ValueMap<number>>;
}

export interface ActionAppraisalInput {
  contractViolationCost: number;
  impacts: ValueImpact[];
  narrativeExpression: number;
  repercussionCost: number;
  valueWeights: ValueMap<number>;
}

export interface AppraisalContribution {
  amount: number;
  empathy: number;
  subjectId: string;
  turn: number;
  value: ValueId;
  weight: number;
}

export interface ActionAppraisal {
  contractViolationCost: number;
  contributions: AppraisalContribution[];
  narrativeExpression: number;
  repercussionCost: number;
  turnFelt: number;
  utility: number;
}

export interface EmpathyEvaluation {
  distance: number;
  empathy: number;
  effectiveFloor: number;
  features: SocialFeatureMap;
  observerId: string;
  subjectId: string;
}

export interface WitnessEvaluation {
  actorEmpathy: number;
  reportProbability: number;
  targetEmpathy: number;
  witnessId: string;
}

export interface RepercussionEvaluation {
  cost: number;
  probability: number;
  witnesses: WitnessEvaluation[];
}

export interface CandidateEvaluation {
  appraisal: ActionAppraisal;
  candidateId: string;
  effectiveValueWeights: ValueMap<number>;
  empathy: EmpathyEvaluation[];
  label: string;
  operation: string;
  repercussion: RepercussionEvaluation;
}

export interface DecisionRecord {
  actorId: string;
  candidates: CandidateEvaluation[];
  id: string;
  second: number;
  opportunityId: string;
  selectedCandidateId: string;
  targetId: string | null;
  tick: number;
}

export interface DisclosureAudienceEvaluation {
  audienceId: string;
  disclosureSafety: number;
  embeddedness: number;
  estimatedEmpathy: number;
  exposureRisk: number;
  subjectiveCost: number;
}

export interface DisclosureDecisionRecord {
  audiences: DisclosureAudienceEvaluation[];
  disclosureBenefit: number;
  id: string;
  itemId: string;
  second: number;
  opportunityId: string;
  outcome: 'conceal' | 'disclose';
  ownerId: string;
  tick: number;
  utility: number;
  worstAudienceId: string | null;
  worstCost: number;
}

export interface RelationshipDecisionRecord {
  cooperationPosition: number;
  id: string;
  magnitude: number;
  second: number;
  newStance: number;
  outcome: 'accepted' | 'refused';
  previousStance: number;
  requesterId: string;
  responderId: string;
  stanceTurn: number;
  tick: number;
}

export type ObservationOutcome = 'confirmed' | 'corrected' | 'missed' | 'suspected';

export interface MindModelObservationRecord {
  calibrationBand: CapabilityResolutionBand | null;
  calibrationMargin: number | null;
  channel: ObservationChannel;
  diagnosticity: number;
  dimension: MindModelDimension;
  effectiveEvidence: number;
  evidenceStrength: number;
  eventId: string;
  eventType: 'mind-model';
  gateThreshold: number | null;
  id: string;
  second: number;
  newConfidence: number | null;
  newEstimate: number | null;
  newPredictionError: number | null;
  newSuspicion: number | null;
  observedValue: number;
  observerId: string;
  outcome: ObservationOutcome;
  perceptionStrength: number;
  predictedValue: number | null;
  previousConfidence: number | null;
  previousEstimate: number | null;
  previousPredictionError: number | null;
  previousSuspicion: number | null;
  rawError: number | null;
  subjectId: string;
  tick: number;
}

export type NormObservationOutcome = 'appraised' | 'missed';

export interface NormObservationRecord {
  affiliated: boolean;
  baselineTurns: Partial<ValueMap<number>>;
  channel: ObservationChannel;
  compatibilityTurns: Partial<ValueMap<number>>;
  eventId: string;
  eventType: 'norm';
  id: string;
  legibility: number;
  legibilityBand: CapabilityResolutionBand | null;
  legibilityMargin: number | null;
  internalization: number;
  second: number;
  normId: string;
  observerId: string;
  outcome: NormObservationOutcome;
  perceptionStrength: number;
  subjectId: string;
  subjectiveTurn: number | null;
  subjectiveTurns: Partial<ValueMap<number>>;
  tick: number;
}

export type ObservationRecord = MindModelObservationRecord | NormObservationRecord;

export interface IncidentContractTerm {
  affiliated: boolean;
  contractId: string;
  conventionalTurns: Partial<ValueMap<number>>;
  enforcementPressure: number;
  identityStake: number;
  internalization: number;
  legibility: number;
  normId: string;
}

export interface IncidentAppraisalRecord {
  baselineTurns: Partial<ValueMap<number>>;
  contractTerms: IncidentContractTerm[];
  eventId: string;
  id: string;
  second: number;
  observerId: string;
  outcome: 'appraised' | 'missed';
  perceivedAttribution: IncidentPerceivedAttribution | null;
  perceptionStrength: number;
  shameTurn: number;
  subjectiveTurns: Partial<ValueMap<number>>;
  tick: number;
}

export type DisplayResponse = 'admiration' | 'disdain' | 'envy' | 'indifference' | 'missed';

export interface DisplayExposureState {
  displayId: string;
  exposures: number;
  habituation: number;
  observerId: string;
}

export interface PositionalRespectReference {
  relevance: number;
  standing: number;
  subjectId: string;
}

export interface PositionalRespectState {
  ambientCount: number;
  ambientStanding: number;
  references: PositionalRespectReference[];
}

export interface DisplayObserverAppraisal {
  admirationTurn: number;
  comparability: number;
  contractTerms: IncidentContractTerm[];
  eventId: string;
  exposureAfter: number;
  exposureBefore: number;
  id: string;
  markerCentrality: number;
  second: number;
  observerId: string;
  outcome: DisplayResponse;
  perceptionStrength: number;
  positionalTurn: number;
  rankSimilarity: number;
  subjectiveTurns: Partial<ValueMap<number>>;
  tick: number;
}

export interface DisplayResolutionRecord {
  appraisals: DisplayObserverAppraisal[];
  eventId: string;
  id: string;
  second: number;
  perceivedAudienceCount: number;
  tick: number;
  wearerId: string;
  wearerYield: number;
}

export type SomaticCrowdResponse = 'concern' | 'freeze' | 'help' | 'ignore' | 'leave';

export interface SomaticObservationRecord {
  calibrationBand: CapabilityResolutionBand | null;
  calibrationMargin: number | null;
  empathy: number;
  eventId: string;
  helpProbability: number;
  id: string;
  inferredSeverity: number | null;
  second: number;
  observerId: string;
  outcome: 'missed' | 'observed';
  perceptionStrength: number;
  response: SomaticCrowdResponse | null;
  subjectId: string;
  tick: number;
  witnessCount: number;
}

export interface SomaticResolutionRecord {
  eventId: string;
  id: string;
  levelAfter: SomaticLevel;
  levelBefore: SomaticLevel;
  second: number;
  observations: SomaticObservationRecord[];
  subjectId: string;
  tick: number;
}

export type AgendaGoalStatus = 'active' | 'blocked' | 'completed' | 'failed' | 'pending';

export interface AgendaGoalState extends AgendaGoalSeed {
  lastPlannedWorldRevision: number | null;
  resolvedSecond: number | null;
  status: AgendaGoalStatus;
}

export interface PlanCandidateEvaluation {
  appraisal: ActionAppraisal;
  estimatedCompletionSecond: number;
  estimatedDurationSeconds: number;
  goalId: string;
  goalUtility: number;
  id: string;
  resourceCost: number;
  resourceCosts: ResourceState;
  score: number;
  taskIds: string[];
  taskUtility: number;
  urgency: number;
}

export interface AgendaDecisionRecord {
  actorId: string;
  candidates: PlanCandidateEvaluation[];
  id: string;
  second: number;
  selectedPlanId: string | null;
  tick: number;
  worldRevision: number;
}

export interface AgendaPlan {
  actorId: string;
  createdSecond: number;
  estimatedCompletionSecond: number;
  goalId: string;
  id: string;
  score: number;
  taskIds: string[];
}

export type TaskIntentionPhase = 'travel' | 'waiting' | 'work';

export interface TaskIntention {
  actorId: string;
  goalId: string;
  phase: TaskIntentionPhase;
  planId: string;
  remainingSeconds: number;
  startedSecond: number | null;
  taskId: string;
}

export interface CharacterInstanceSnapshot {
  cascade: CascadePosition;
  cascadeDwellUntilSecond: number;
  cascadeLoad: number;
  cascadeTargetId: string | null;
  currentOutlet: OutletSelection | null;
  currentActivity: string;
  currentLocationId: string | null;
  destination: LayerPosition;
  history: HistoryDerivedState;
  id: string;
  memories: RuntimeMemory[];
  narrative: NarrativeState | null;
  outletHistory: OutletUseState[];
  positionalRespect: PositionalRespectState;
  position: LayerPosition;
  profile: CharacterProfileAddress;
  resources: ResourceState;
  schedule: ScheduleBlock[];
  somatic: SomaticState;
  tier: CharacterTier;
  values: ValueMap<ValueState>;
  walkingMetersPerMinute: number;
}

export interface SimulationSnapshotFile {
  appraisalRecords: AppraisalRecord[];
  agendaDecisions: AgendaDecisionRecord[];
  agendaGoals: AgendaGoalState[];
  characters: CharacterInstanceSnapshot[];
  decisions: DecisionRecord[];
  disclosureDecisions: DisclosureDecisionRecord[];
  disclosureItems: DisclosureItemSeed[];
  displayExposures: DisplayExposureState[];
  displayRecords: DisplayResolutionRecord[];
  dyads: DyadState[];
  environment: EnvironmentLayoutAddress;
  incidentRecords: IncidentAppraisalRecord[];
  intentions: TaskIntention[];
  second: number;
  narrativeRecords: NarrativeRecord[];
  observations: ObservationRecord[];
  plans: AgendaPlan[];
  relationshipDecisions: RelationshipDecisionRecord[];
  reputations: AttributedNarrative[];
  resourceLock: ResourceLock;
  resolvedDisclosureOpportunityIds: string[];
  resolvedDisplayEventIds: string[];
  resolvedIncidentEventIds: string[];
  resolvedObservationEventIds: string[];
  resolvedOpportunityIds: string[];
  resolvedNarrativeEventIds: string[];
  resolvedAppraisalEventIds: string[];
  resolvedAspirationOpportunityIds: string[];
  resolvedRelationshipEventIds: string[];
  resolvedRelationshipRequestIds: string[];
  resolvedSomaticEventIds: string[];
  scenario: ScenarioFile;
  schemaVersion: 19;
  somaticRecords: SomaticResolutionRecord[];
  tick: number;
  trace: CausalTrace;
  type: 'verusim-snapshot';
  worldFacts: WorldFact[];
  worldRevision: number;
}

export interface NarrativeClaimState extends NarrativeClaimSeed {
  confirmations: number;
  reinterpretations: number;
  revisions: number;
  wearIn: number;
}

export interface NarrativeState {
  claims: NarrativeClaimState[];
  promotedSecond: number;
}

export type NarrativeDisposition =
  | 'accepted'
  | 'confirmed'
  | 'fishing'
  | 'genuine'
  | 'preemptive-shame'
  | 'reinterpreted'
  | 'resisted'
  | 'revised'
  | 'status-lowering'
  | 'wore-in';

export interface NarrativeRecord {
  actorId: string;
  claimId: string;
  disposition: NarrativeDisposition;
  eventId: string;
  id: string;
  second: number;
  regulationCost: number;
  summary: string;
  tick: number;
}

export interface AttributedNarrative {
  audienceId: string;
  audienceType: 'agent' | 'group';
  claim: string;
  confidence: number;
  firstSecond: number;
  lastSecond: number;
  repetitions: number;
  sourceIds: string[];
  subjectId: string;
}
