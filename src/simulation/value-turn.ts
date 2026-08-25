import { clamp } from '../model/retention.js';
import {
  VALUE_IDS,
  type CharacterInstance,
  type ValueMap,
  type ValueState,
} from '../model/types.js';

export function reactiveValueTurn(reactivity: number, turn: number): number {
  return turn * reactivity;
}

export function reactiveValueTurns(
  agent: CharacterInstance,
  turns: Partial<ValueMap<number>>,
): Partial<ValueMap<number>> {
  const result: Partial<ValueMap<number>> = {};
  for (const valueId of VALUE_IDS) {
    const turn = turns[valueId];
    if (turn !== undefined) {
      result[valueId] = reactiveValueTurn(agent.profile.constitution.reactivity, turn);
    }
  }
  return result;
}

export function applyValueTurns(
  values: ValueMap<ValueState>,
  turns: Partial<ValueMap<number>>,
): ValueMap<ValueState> {
  const next = {} as ValueMap<ValueState>;
  for (const valueId of VALUE_IDS) {
    next[valueId] = {
      ...values[valueId],
      charge: clamp(values[valueId].charge + (turns[valueId] ?? 0), -1, 1),
    };
  }
  return next;
}

export function applyCharacterValueTurns(
  agent: CharacterInstance,
  turns: Partial<ValueMap<number>>,
): CharacterInstance {
  return { ...agent, values: applyValueTurns(agent.values, turns) };
}
