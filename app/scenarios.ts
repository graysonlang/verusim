import bakerDeadline from '../scenarios/baker-deadline.json';
import cascadeRoom from '../scenarios/cascade-room.json';
import disclosureAudience from '../scenarios/disclosure-audience.json';
import endicottMargueritte from '../scenarios/endicott-margueritte.json';
import highwaymanRoad from '../scenarios/highwayman-road.json';
import highwaymanSquare from '../scenarios/highwayman-square.json';
import innkeeperCoping from '../scenarios/innkeeper-coping.json';
import marketMorning from '../scenarios/market-morning.json';
import pottsfield from '../scenarios/pottsfield.json';
import relationshipMomentum from '../scenarios/relationship-momentum.json';
import { parseScenario, type ScenarioFile } from '../src/index.js';

export interface BuiltInScenario {
  id: string;
  scenario: ScenarioFile;
  summary: string;
  title: string;
}

function builtInScenario(value: unknown): BuiltInScenario {
  const scenario = parseScenario(value);
  return {
    id: scenario.id,
    scenario,
    summary: scenario.summary,
    title: scenario.title,
  };
}

export const BUILT_IN_SCENARIOS: readonly BuiltInScenario[] = [
  marketMorning,
  bakerDeadline,
  disclosureAudience,
  endicottMargueritte,
  pottsfield,
  relationshipMomentum,
  innkeeperCoping,
  cascadeRoom,
  highwaymanRoad,
  highwaymanSquare,
].map(builtInScenario);

export const DEFAULT_BUILT_IN_SCENARIO = BUILT_IN_SCENARIOS[0] as BuiltInScenario;
