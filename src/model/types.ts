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

export interface Point {
  x: number;
  y: number;
}

export interface Bounds extends Point {
  height: number;
  width: number;
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
  schemaVersion: 3;
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
  ambientTurnsPerHour?: Partial<ValueMap<number>>;
  behaviorOpportunities: BehaviorOpportunity[];
  characters: CharacterPlacement[];
  disclosureItems: DisclosureItemSeed[];
  disclosureOpportunities: DisclosureOpportunity[];
  dyads: DyadSeed[];
  environmentId: string;
  id: string;
  schemaVersion: 3;
  startMinute: number;
  summary: string;
  tickMinutes: number;
  title: string;
}

export interface RuntimeMemory {
  id: string;
  minute: number;
  summary: string;
  type: 'activity' | 'aftermath' | 'disclosure' | 'formative' | 'intervention';
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

export interface TraceEntry {
  agentId: string | null;
  causes: string[];
  id: string;
  kind:
    | 'activity'
    | 'aftermath'
    | 'appraisal'
    | 'decision'
    | 'disclosure-appraisal'
    | 'disclosure-decision'
    | 'intervention'
    | 'relationship'
    | 'scenario'
    | 'value-turn';
  minute: number;
  summary: string;
  tick: number;
}

export interface SimulationState {
  agents: SimulationAgent[];
  decisions: DecisionRecord[];
  disclosureDecisions: DisclosureDecisionRecord[];
  disclosureItems: DisclosureItemSeed[];
  dyads: DyadState[];
  environment: EnvironmentDefinition;
  minute: number;
  resolvedDisclosureOpportunityIds: string[];
  resolvedOpportunityIds: string[];
  scenario: ScenarioFile;
  tick: number;
  trace: TraceEntry[];
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
  agents: SimulationAgentSnapshot[];
  decisions: DecisionRecord[];
  disclosureDecisions: DisclosureDecisionRecord[];
  disclosureItems: DisclosureItemSeed[];
  dyads: DyadState[];
  environmentId: string;
  minute: number;
  resolvedDisclosureOpportunityIds: string[];
  resolvedOpportunityIds: string[];
  scenario: ScenarioFile;
  schemaVersion: 1;
  tick: number;
  trace: TraceEntry[];
  type: 'verusim-snapshot';
}
