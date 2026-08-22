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

export interface CharacterDefinition {
  constitution: Constitution;
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
  schemaVersion: 1;
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

export interface ScenarioFile {
  ambientTurnsPerHour?: Partial<ValueMap<number>>;
  characters: CharacterPlacement[];
  environmentId: string;
  id: string;
  schemaVersion: 1;
  startMinute: number;
  summary: string;
  tickMinutes: number;
  title: string;
}

export interface RuntimeMemory {
  id: string;
  minute: number;
  summary: string;
  type: 'activity' | 'formative' | 'intervention';
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
  kind: 'activity' | 'intervention' | 'scenario' | 'value-turn';
  minute: number;
  summary: string;
  tick: number;
}

export interface SimulationState {
  agents: SimulationAgent[];
  environment: EnvironmentDefinition;
  minute: number;
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
