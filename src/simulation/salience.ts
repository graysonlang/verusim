import { clamp } from '../model/retention.js';
import { VALUE_IDS, type CharacterInstance, type ValueMap } from '../model/types.js';
import { effectiveValueWeight } from './history.js';

export function effectiveValueWeights(agent: CharacterInstance): ValueMap<number> {
  const weights = {} as ValueMap<number>;
  for (const valueId of VALUE_IDS) {
    const state = agent.values[valueId];
    const deprivation = clamp(Math.max(0, -state.charge) + state.deficitIntegral, 0, 1);
    const inflation = 1 + deprivation * deprivation * 3;
    weights[valueId] = effectiveValueWeight(agent, valueId) * inflation;
  }
  return weights;
}
