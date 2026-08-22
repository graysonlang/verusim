import {
  VALUE_IDS,
  type CharacterPlacement,
  type ScenarioFile,
  type SimulationState,
  type ValueMap,
  type ValueState,
} from '../model/types.js';

export function serializeScenario(state: SimulationState): ScenarioFile {
  const sourcePlacements = new Map(
    state.scenario.characters.map(placement => [placement.instanceId, placement]),
  );
  const characters: CharacterPlacement[] = state.agents.map(agent => {
    const source = sourcePlacements.get(agent.id);
    if (source === undefined)
      throw new Error(`Simulation agent "${agent.id}" has no scenario placement`);
    const initialValues = {} as ValueMap<ValueState>;
    for (const valueId of VALUE_IDS) initialValues[valueId] = { ...agent.values[valueId] };
    return {
      characterId: agent.profile.id,
      initialResources: { ...agent.resources },
      initialValues,
      instanceId: agent.id,
      position: { ...agent.position },
      schedule: source.schedule.map(block => ({ ...block })),
      walkingMetersPerMinute: agent.walkingMetersPerMinute,
    };
  });
  return {
    ...state.scenario,
    characters,
    startMinute: state.minute,
  };
}
