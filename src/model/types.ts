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

export type AgentCapabilityCheck = Omit<
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

export interface FormativeEvent {
  age: number;
  attribution: string | null;
  copingPotential: number;
  summary: string;
  turn: number;
  value: ValueId;
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
  id: string;
  identity: IdentityMarker[];
  name: string;
  narrativeClaims: string[];
  outletPreferences: OutletPreference[];
  physical: PhysicalProfile;
  role: string;
  satisfierPreferences: SatisfierPreference[];
  summary: string;
  values: ValueMap<ValueDisposition>;
}

export interface CharacterLibraryFile {
  characters: CharacterDefinition[];
  schemaVersion: 6;
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

export interface EnvironmentArea extends Bounds {
  id: string;
  kind: AreaKind;
  label?: string;
}

export interface LocationDefinition extends Bounds {
  id: string;
  kind: string;
  name: string;
}

export interface EnvironmentDefinition {
  areas: EnvironmentArea[];
  height: number;
  id: string;
  locations: LocationDefinition[];
  name: string;
  outletAffordances: OutletAffordance[];
  width: number;
}

export interface EnvironmentLibraryFile {
  environments: EnvironmentDefinition[];
  schemaVersion: 2;
}

export type ReinforcementSchedule = 'fixed' | 'variable-ratio';

export interface OutletAffordance {
  displacesRepair: boolean;
  durationMinutes: number;
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
  startMinute: number;
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
  characterId: string;
  initialResources?: Partial<ResourceState>;
  initialValues?: Partial<ValueMap<Partial<ValueState>>>;
  instanceId: string;
  normPerspectives: NormPerspective[];
  position: Point;
  schedule: ScheduleBlock[];
  walkingMetersPerMinute?: number;
}

export interface NormPerspective {
  legibility: number;
  member: boolean;
  normId: string;
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
}

export type DyadState = DyadSeed;

export interface RelationshipEvent {
  atMinute: number;
  id: string;
  observerId: string;
  stanceTurn: number;
  subjectId: string;
  summary: string;
}

export interface RelationshipRequestOpportunity {
  atMinute: number;
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
  atMinute: number;
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
  atMinute: number;
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
  normId: string;
  summary: string;
}

export type ObservationEvent = MindModelObservationEvent | NormObservationEvent;

export interface LocalNorm {
  compatibilityTurns: Partial<ValueMap<number>>;
  id: string;
  label: string;
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
  activationMinute: number;
  actorId: string;
  commitment: number;
  deadlineMinute: number | null;
  desired: FactCondition[];
  failureTurns: Partial<ValueMap<number>>;
  id: string;
  label: string;
  source: GoalSource;
  successTurns: Partial<ValueMap<number>>;
  urgencyHorizonMinutes: number;
}

export interface TaskOperator {
  actorIds: string[];
  availableFromMinute: number | null;
  availableUntilMinute: number | null;
  contractViolation: number;
  durationMinutes: number;
  effects: FactEffect[];
  id: string;
  label: string;
  locationId: string;
  maskingDemand: MaskingDemand | null;
  preconditions: FactCondition[];
  recoveryMode: RecoveryMode;
  resourceCosts: Partial<ResourceState>;
  resourceDrainsPerHour: Partial<ResourceState>;
  valueTurns: Partial<ValueMap<number>>;
}

export interface ActionImpact {
  subjectId: string;
  turns: Partial<ValueMap<number>>;
}

export interface ActionCandidate {
  contractViolation: number;
  id: string;
  impacts: ActionImpact[];
  label: string;
  narrativeExpression: number;
  operation: string;
  repercussionSeverity: number;
}

export interface DecisionContext {
  enforcementPresence: number;
  networkConductivity: number;
  perceivedThreat: number;
  witnessIds: string[];
}

export interface BehaviorOpportunity {
  actorId: string;
  atMinute: number;
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
  appraisalEvents: AppraisalEvent[];
  behaviorOpportunities: BehaviorOpportunity[];
  characters: CharacterPlacement[];
  disclosureItems: DisclosureItemSeed[];
  disclosureOpportunities: DisclosureOpportunity[];
  dyads: DyadSeed[];
  environmentId: string;
  environmentConditions: EnvironmentConditions;
  id: string;
  initialTimeRate?: TimeRateId;
  localNorms: LocalNorm[];
  observationEvents: ObservationEvent[];
  relationshipEvents: RelationshipEvent[];
  relationshipRequests: RelationshipRequestOpportunity[];
  schemaVersion: 10;
  startMinute: number;
  summary: string;
  taskOperators: TaskOperator[];
  tickMinutes: number;
  title: string;
  worldFacts: WorldFact[];
}

export interface RuntimeMemory {
  emotionalTurn?: number;
  id: string;
  minute: number;
  subjectId?: string;
  summary: string;
  type:
    | 'activity'
    | 'aftermath'
    | 'disclosure'
    | 'formative'
    | 'goal'
    | 'intervention'
    | 'relationship'
    | 'task';
}

export interface AppraisalEvent {
  agentId: string;
  atMinute: number;
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

export interface SimulationAgent {
  cascade: CascadePosition;
  cascadeDwellUntilMinute: number;
  cascadeLoad: number;
  cascadeTargetId: string | null;
  currentOutlet: OutletSelection | null;
  currentActivity: string;
  currentLocationId: string | null;
  destination: Point;
  id: string;
  memories: RuntimeMemory[];
  outletHistory: OutletUseState[];
  position: Point;
  profile: CharacterDefinition;
  resources: ResourceState;
  schedule: ScheduleBlock[];
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
  | 'gate'
  | 'goal'
  | 'intervention'
  | 'intention'
  | 'norm-appraisal'
  | 'observation'
  | 'outlet'
  | 'prediction'
  | 'relationship'
  | 'resource'
  | 'scenario'
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
  agentId: string | null;
  id: string;
  kind: TraceKind;
  minute: number;
  selection: TraceSelection | null;
  summary: string;
  terms: TraceTerm[];
  tick: number;
}

export interface CausalTrace {
  entries: TraceEntry[];
  schemaVersion: 1;
}

export interface SimulationState {
  appraisalRecords: AppraisalRecord[];
  agendaDecisions: AgendaDecisionRecord[];
  agendaGoals: AgendaGoalState[];
  agents: SimulationAgent[];
  decisions: DecisionRecord[];
  disclosureDecisions: DisclosureDecisionRecord[];
  disclosureItems: DisclosureItemSeed[];
  dyads: DyadState[];
  environment: EnvironmentDefinition;
  intentions: TaskIntention[];
  minute: number;
  observations: ObservationRecord[];
  plans: AgendaPlan[];
  relationshipDecisions: RelationshipDecisionRecord[];
  resolvedDisclosureOpportunityIds: string[];
  resolvedObservationEventIds: string[];
  resolvedOpportunityIds: string[];
  resolvedAppraisalEventIds: string[];
  resolvedRelationshipEventIds: string[];
  resolvedRelationshipRequestIds: string[];
  scenario: ScenarioFile;
  tick: number;
  trace: CausalTrace;
  worldFacts: WorldFact[];
  worldRevision: number;
}

export interface OutletSelection {
  affordanceId: string;
  label: string;
  operation: OutletOperation;
  remainingMinutes: number;
  startedMinute: number;
  targetValueId: ValueId;
  yield: number;
}

export interface OutletUseState {
  affordanceId: string;
  habituation: number;
  uses: number;
}

export interface AppraisalRecord {
  agentId: string;
  appliedTurns: Partial<ValueMap<number>>;
  cascadeLoad: number;
  copingPotential: number;
  effectiveCoping: number;
  eventId: string;
  id: string;
  minute: number;
  nextCascade: CascadePosition;
  previousCascade: CascadePosition;
  socialTargetId: string | null;
  tick: number;
}

export interface ScenarioContent {
  characterLibrary: CharacterLibraryFile;
  environmentLibrary: EnvironmentLibraryFile;
  scenario: ScenarioFile;
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
  minute: number;
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
  minute: number;
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
  minute: number;
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
  minute: number;
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
  baselineTurns: Partial<ValueMap<number>>;
  channel: ObservationChannel;
  compatibilityTurns: Partial<ValueMap<number>>;
  eventId: string;
  eventType: 'norm';
  id: string;
  legibility: number;
  legibilityBand: CapabilityResolutionBand | null;
  legibilityMargin: number | null;
  member: boolean;
  minute: number;
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

export type AgendaGoalStatus = 'active' | 'blocked' | 'completed' | 'failed' | 'pending';

export interface AgendaGoalState extends AgendaGoalSeed {
  lastPlannedWorldRevision: number | null;
  resolvedMinute: number | null;
  status: AgendaGoalStatus;
}

export interface PlanCandidateEvaluation {
  appraisal: ActionAppraisal;
  estimatedCompletionMinute: number;
  estimatedDurationMinutes: number;
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
  minute: number;
  selectedPlanId: string | null;
  tick: number;
  worldRevision: number;
}

export interface AgendaPlan {
  actorId: string;
  createdMinute: number;
  estimatedCompletionMinute: number;
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
  remainingMinutes: number;
  startedMinute: number | null;
  taskId: string;
}

export interface SimulationAgentSnapshot {
  cascade: CascadePosition;
  cascadeDwellUntilMinute: number;
  cascadeLoad: number;
  cascadeTargetId: string | null;
  currentOutlet: OutletSelection | null;
  currentActivity: string;
  currentLocationId: string | null;
  destination: Point;
  id: string;
  memories: RuntimeMemory[];
  outletHistory: OutletUseState[];
  position: Point;
  profileId: string;
  resources: ResourceState;
  schedule: ScheduleBlock[];
  values: ValueMap<ValueState>;
  walkingMetersPerMinute: number;
}

export interface SimulationSnapshotFile {
  appraisalRecords: AppraisalRecord[];
  agendaDecisions: AgendaDecisionRecord[];
  agendaGoals: AgendaGoalState[];
  agents: SimulationAgentSnapshot[];
  decisions: DecisionRecord[];
  disclosureDecisions: DisclosureDecisionRecord[];
  disclosureItems: DisclosureItemSeed[];
  dyads: DyadState[];
  environmentId: string;
  intentions: TaskIntention[];
  minute: number;
  observations: ObservationRecord[];
  plans: AgendaPlan[];
  relationshipDecisions: RelationshipDecisionRecord[];
  resolvedDisclosureOpportunityIds: string[];
  resolvedObservationEventIds: string[];
  resolvedOpportunityIds: string[];
  resolvedAppraisalEventIds: string[];
  resolvedRelationshipEventIds: string[];
  resolvedRelationshipRequestIds: string[];
  scenario: ScenarioFile;
  schemaVersion: 7;
  tick: number;
  trace: CausalTrace;
  type: 'verusim-snapshot';
  worldFacts: WorldFact[];
  worldRevision: number;
}
