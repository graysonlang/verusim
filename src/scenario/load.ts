import type { PreparedScenario, SimulationState } from '../model/types.js';
import {
  createSimulationFromPrepared,
  createSimulationFromPreparedSnapshot,
} from '../simulation/runtime.js';
import { prepareScenarioFromLibraries, validatePreparedScenario } from './prepare.js';
import { parseSnapshot } from './snapshot.js';

interface LegacyScenarioInput {
  characterLibrary: unknown;
  environmentLibrary: unknown;
  scenario: unknown;
}

interface PreparedSnapshotInput {
  prepared: PreparedScenario;
  snapshot: unknown;
}

interface LegacySnapshotInput {
  characterLibrary: unknown;
  environmentLibrary: unknown;
  snapshot: unknown;
}

export function createSimulation(input: PreparedScenario | LegacyScenarioInput): SimulationState {
  const prepared =
    'type' in input ? validatePreparedScenario(input) : prepareScenarioFromLibraries(input);
  return createSimulationFromPrepared(prepared);
}

export function createSimulationFromSnapshot(
  input: PreparedSnapshotInput | LegacySnapshotInput,
): SimulationState {
  const snapshot = parseSnapshot(input.snapshot);
  const prepared =
    'prepared' in input
      ? validatePreparedScenario(input.prepared)
      : prepareScenarioFromLibraries({
          characterLibrary: input.characterLibrary,
          environmentLibrary: input.environmentLibrary,
          scenario: snapshot.scenario,
        });
  return createSimulationFromPreparedSnapshot({ prepared, snapshot });
}
