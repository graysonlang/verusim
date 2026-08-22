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
  constitution: Constitution;
  contractAdherence: number;
  disclosure: DisclosureEnvelope;
  empathy: EmpathyEnvelope;
  formativeEvents: FormativeEvent[];
  id: string;
  identity: IdentityMarker[];
  name: string;
  narrativeClaims: string[];
  role: string;
  summary: string;
  values: ValueMap<ValueDisposition>;
}

export interface CharacterLibraryFile {
  characters: CharacterDefinition[];
  schemaVersion: 4;
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
  width: number;
}

export interface EnvironmentLibraryFile {
  environments: EnvironmentDefinition[];
  schemaVersion: 1;
}

export interface ScheduleBlock {
  activity: string;
  locationId: string;
  startMinute: number;
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
  position: Point;
  schedule: ScheduleBlock[];
  walkingMetersPerMinute?: number;
}

export type DyadMode = 'courteous' | 'contesting' | 'guarded' | 'ruptured' | 'warm';

export interface DyadSeed {
  behaviorVariance: number;
  estimateConfidence: number;
  estimatedDisclosure: number;
  estimatedEmpathy: number;
  features: SocialFeatureMap;
  integratedHistory: number;
  mode: DyadMode;
  observerId: string;
  predictionError: number;
  stance: number;
  subjectId: string;
}

export type DyadState = DyadSeed;

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
  preconditions: FactCondition[];
  resourceCosts: Partial<ResourceState>;
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

export interface ScenarioFile {
  agendaGoals: AgendaGoalSeed[];
  ambientTurnsPerHour?: Partial<ValueMap<number>>;
  behaviorOpportunities: BehaviorOpportunity[];
  characters: CharacterPlacement[];
  disclosureItems: DisclosureItemSeed[];
  disclosureOpportunities: DisclosureOpportunity[];
  dyads: DyadSeed[];
  environmentId: string;
  id: string;
  schemaVersion: 4;
  startMinute: number;
  summary: string;
  taskOperators: TaskOperator[];
  tickMinutes: number;
  title: string;
  worldFacts: WorldFact[];
}

export interface RuntimeMemory {
  id: string;
  minute: number;
  summary: string;
  type: 'activity' | 'aftermath' | 'disclosure' | 'formative' | 'goal' | 'intervention' | 'task';
}

export type CascadePosition = 'none' | 'freeze' | 'fight' | 'flight' | 'fawn' | 'flop';

export interface SimulationAgent {
  cascade: CascadePosition;
  currentActivity: string;
  currentLocationId: string | null;
  destination: Point;
  id: string;
  memories: RuntimeMemory[];
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
  | 'decision'
  | 'disclosure-appraisal'
  | 'disclosure-decision'
  | 'gate'
  | 'goal'
  | 'intervention'
  | 'intention'
  | 'relationship'
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
  plans: AgendaPlan[];
  resolvedDisclosureOpportunityIds: string[];
  resolvedOpportunityIds: string[];
  scenario: ScenarioFile;
  tick: number;
  trace: CausalTrace;
  worldFacts: WorldFact[];
  worldRevision: number;
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
  currentActivity: string;
  currentLocationId: string | null;
  destination: Point;
  id: string;
  memories: RuntimeMemory[];
  position: Point;
  profileId: string;
  resources: ResourceState;
  schedule: ScheduleBlock[];
  values: ValueMap<ValueState>;
  walkingMetersPerMinute: number;
}

export interface SimulationSnapshotFile {
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
  plans: AgendaPlan[];
  resolvedDisclosureOpportunityIds: string[];
  resolvedOpportunityIds: string[];
  scenario: ScenarioFile;
  schemaVersion: 3;
  tick: number;
  trace: CausalTrace;
  type: 'verusim-snapshot';
  worldFacts: WorldFact[];
  worldRevision: number;
}
