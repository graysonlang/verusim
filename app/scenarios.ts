import bakerDeadline from '../scenarios/baker-deadline.json';
import aldersEdgeTown from '../scenarios/alders-edge-town.json';
import cascadeRoom from '../scenarios/cascade-room.json';
import disclosureAudience from '../scenarios/disclosure-audience.json';
import endicottMargueritte from '../scenarios/endicott-margueritte.json';
import highwaymanRoad from '../scenarios/highwayman-road.json';
import highwaymanSquare from '../scenarios/highwayman-square.json';
import innkeeperCoping from '../scenarios/innkeeper-coping.json';
import marketMorning from '../scenarios/market-morning.json';
import narrativeAgency from '../scenarios/narrative-agency.json';
import pottsfield from '../scenarios/pottsfield.json';
import relationshipMomentum from '../scenarios/relationship-momentum.json';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import {
  createResourceCatalog,
  prepareScenario,
  type PreparedScenario,
  type ResourceCatalog,
  type ScenarioFile,
} from '../src/index.js';

export interface BuiltInScenario {
  id: string;
  prepared: PreparedScenario;
  scenario: ScenarioFile;
  summary: string;
  title: string;
}

export const BUILT_IN_RESOURCE_CATALOG: ResourceCatalog = createResourceCatalog(BUILT_IN_RESOURCES);

function builtInScenario(value: unknown): BuiltInScenario {
  const prepared = prepareScenario({ catalog: BUILT_IN_RESOURCE_CATALOG, scenario: value });
  const { scenario } = prepared;
  return {
    id: scenario.id,
    prepared,
    scenario,
    summary: scenario.summary,
    title: scenario.title,
  };
}

export const BUILT_IN_SCENARIOS: readonly BuiltInScenario[] = [
  marketMorning,
  aldersEdgeTown,
  bakerDeadline,
  disclosureAudience,
  endicottMargueritte,
  pottsfield,
  relationshipMomentum,
  innkeeperCoping,
  cascadeRoom,
  narrativeAgency,
  highwaymanRoad,
  highwaymanSquare,
].map(builtInScenario);

export const DEFAULT_BUILT_IN_SCENARIO = BUILT_IN_SCENARIOS[0] as BuiltInScenario;
