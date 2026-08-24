import { VALUE_IDS, type SimulationAgent, type ValueMap } from '../model/types.js';
import { effectiveValueWeight } from './history.js';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function effectiveValueWeights(agent: SimulationAgent): ValueMap<number> {
  const weights = {} as ValueMap<number>;
  for (const valueId of VALUE_IDS) {
    const state = agent.values[valueId];
    const deprivation = clamp(Math.max(0, -state.charge) + state.deficitIntegral, 0, 1);
    const inflation = 1 + deprivation * deprivation * 3;
    weights[valueId] = effectiveValueWeight(agent, valueId) * inflation;
  }
  return weights;
}
