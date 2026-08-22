import { VALUE_IDS, type SimulationAgent, type ValueId } from '../model/types.js';

const VALUE_LABELS: Record<ValueId, string> = {
  safety: 'safety',
  belonging: 'belonging',
  respect: 'respect',
  autonomy: 'autonomy',
  competence: 'competence',
  fairness: 'fairness',
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export interface AgentObservation {
  allostaticLoad: number;
  arousal: number;
  dominantValue: ValueId;
  mood: string;
  stateOfMind: string;
  valence: number;
}

export function describeAgent(agent: SimulationAgent): AgentObservation {
  let dominantValue: ValueId = VALUE_IDS[0];
  let dominantPressure = Number.NEGATIVE_INFINITY;
  let weightedCharge = 0;
  let totalWeight = 0;
  let allostaticLoad = 0;

  for (const valueId of VALUE_IDS) {
    const state = agent.values[valueId];
    const weight = agent.profile.values[valueId].weight;
    const pressure = weight * (Math.max(0, -state.charge) + state.deficitIntegral);
    if (pressure > dominantPressure) {
      dominantPressure = pressure;
      dominantValue = valueId;
    }
    weightedCharge += state.charge * weight;
    totalWeight += weight;
    allostaticLoad += Math.max(0, -state.charge) + state.deficitIntegral;
  }

  const valence = clamp(weightedCharge / Math.max(totalWeight, 0.001), -1, 1);
  allostaticLoad = clamp(allostaticLoad / VALUE_IDS.length, 0, 1);
  const arousal = clamp(
    agent.profile.constitution.baselineArousal +
      allostaticLoad * agent.profile.constitution.reactivity -
      agent.resources.regulationReserve * 0.2,
    0,
    1,
  );

  let mood = 'steady';
  if (valence < -0.3 && arousal >= 0.55) mood = 'strained';
  else if (valence < -0.3) mood = 'low';
  else if (valence > 0.3 && arousal >= 0.55) mood = 'bright';
  else if (valence > 0.3) mood = 'content';
  else if (arousal >= 0.7) mood = 'alert';

  const stateOfMind =
    dominantPressure < 0.08
      ? `Present with ${agent.currentActivity.toLowerCase()}`
      : `Protecting ${VALUE_LABELS[dominantValue]}`;

  return { allostaticLoad, arousal, dominantValue, mood, stateOfMind, valence };
}

export function formatSimulationTime(minute: number): string {
  const day = Math.floor(minute / 1440) + 1;
  const minuteOfDay = ((minute % 1440) + 1440) % 1440;
  const hour = Math.floor(minuteOfDay / 60);
  const minutePart = minuteOfDay % 60;
  return `Day ${day}, ${String(hour).padStart(2, '0')}:${String(minutePart).padStart(2, '0')}`;
}
