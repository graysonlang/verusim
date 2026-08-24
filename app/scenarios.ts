import bakerDeadline from '../content/scenarios/baker-deadline.json';
import aldersEdgeTown from '../content/scenarios/alders-edge-town.json';
import cascadeRoom from '../content/scenarios/cascade-room.json';
import disclosureAudience from '../content/scenarios/disclosure-audience.json';
import endicottMargueritte from '../content/scenarios/endicott-margueritte.json';
import highwaymanRoad from '../content/scenarios/highwayman-road.json';
import highwaymanSquare from '../content/scenarios/highwayman-square.json';
import innkeeperCoping from '../content/scenarios/innkeeper-coping.json';
import marketMorning from '../content/scenarios/market-morning.json';
import narrativeAgency from '../content/scenarios/narrative-agency.json';
import pottsfield from '../content/scenarios/pottsfield.json';
import pottsfieldCharterDay from '../content/scenarios/pottsfield-charter-day.json';
import relationshipMomentum from '../content/scenarios/relationship-momentum.json';
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
  pottsfieldCharterDay,
  relationshipMomentum,
  innkeeperCoping,
  cascadeRoom,
  narrativeAgency,
  highwaymanRoad,
  highwaymanSquare,
].map(builtInScenario);

export const DEFAULT_BUILT_IN_SCENARIO = BUILT_IN_SCENARIOS[0] as BuiltInScenario;
