import {
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  secondOfDay,
} from '../model/time.js';
import { clamp } from '../model/retention.js';
import { VALUE_IDS, type CharacterInstance, type ValueId } from '../model/types.js';
import { allostaticLoadFor } from './coping.js';
import { effectiveValueWeight } from './history.js';

const VALUE_LABELS: Record<ValueId, string> = {
  safety: 'safety',
  belonging: 'belonging',
  respect: 'respect',
  autonomy: 'autonomy',
  competence: 'competence',
  fairness: 'fairness',
};

export type MovementSpeedClass =
  | 'still'
  | 'crawling'
  | 'plodding'
  | 'strolling'
  | 'walking'
  | 'jogging'
  | 'running'
  | 'sprinting';

export const MOVEMENT_SPEED_LABELS: Record<MovementSpeedClass, string> = {
  crawling: 'Crawling',
  jogging: 'Jogging',
  plodding: 'Plodding',
  running: 'Running',
  sprinting: 'Sprinting',
  still: 'Still',
  strolling: 'Strolling / ambling',
  walking: 'Walking',
};

export function classifyMovementSpeed(metersPerMinute: number): MovementSpeedClass {
  if (metersPerMinute < 0.5) return 'still';
  if (metersPerMinute < 12) return 'crawling';
  if (metersPerMinute < 30) return 'plodding';
  if (metersPerMinute < 60) return 'strolling';
  if (metersPerMinute < 110) return 'walking';
  if (metersPerMinute < 180) return 'jogging';
  if (metersPerMinute < 300) return 'running';
  return 'sprinting';
}

export interface CharacterObservation {
  allostaticLoad: number;
  arousal: number;
  cascadeTell: string | null;
  dominantValue: ValueId;
  mood: string;
  movementMetersPerMinute: number;
  movementSpeedClass: MovementSpeedClass;
  narrativeTell: string | null;
  outletTell: string | null;
  resourceStrain: number;
  stateOfMind: string;
  valence: number;
  valueValence: number;
}

export function describeCharacter(agent: CharacterInstance): CharacterObservation {
  let dominantValue: ValueId = VALUE_IDS[0];
  let dominantPressure = Number.NEGATIVE_INFINITY;
  let weightedCharge = 0;
  let totalWeight = 0;

  for (const valueId of VALUE_IDS) {
    const state = agent.values[valueId];
    const weight = effectiveValueWeight(agent, valueId);
    const pressure = weight * (Math.max(0, -state.charge) + state.deficitIntegral);
    if (pressure > dominantPressure) {
      dominantPressure = pressure;
      dominantValue = valueId;
    }
    weightedCharge += state.charge * weight;
    totalWeight += weight;
  }

  const valueValence = clamp(weightedCharge / Math.max(totalWeight, 0.001), -1, 1);
  const socialDepletion = clamp((0.5 - agent.resources.socialBattery) / 0.5, 0, 1);
  const physicalDepletion = clamp((0.3 - agent.resources.physicalStamina) / 0.3, 0, 1);
  const resourceStrain = clamp(socialDepletion * 0.38 + physicalDepletion * 0.16, 0, 1);
  const valence = clamp(valueValence - resourceStrain, -1, 1);
  const allostaticLoad = allostaticLoadFor(agent);
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

  const cascadeTell =
    agent.cascade === 'freeze'
      ? 'Goes still'
      : agent.cascade === 'fight'
        ? 'Sets against the threat'
        : agent.cascade === 'flight'
          ? 'Tracks an exit'
          : agent.cascade === 'fawn'
            ? 'Appeases the threat'
            : agent.cascade === 'flop'
              ? 'Shuts down'
              : null;
  const outletTell =
    agent.currentOutlet === null
      ? null
      : `${agent.currentOutlet.operation}: ${agent.currentOutlet.label}`;
  const narrativeTell =
    agent.memories.findLast(memory => memory.type === 'narrative')?.summary ?? null;
  const stateOfMind =
    cascadeTell ??
    outletTell ??
    narrativeTell ??
    (dominantPressure < 0.08
      ? `Present with ${agent.currentActivity.toLowerCase()}`
      : `Protecting ${VALUE_LABELS[dominantValue]}`);
  const remainingDistance = Math.hypot(
    agent.destination.x - agent.position.x,
    agent.destination.y - agent.position.y,
  );
  const movementMetersPerMinute = remainingDistance < 0.01 ? 0 : agent.walkingMetersPerMinute;

  return {
    allostaticLoad,
    arousal,
    cascadeTell,
    dominantValue,
    mood,
    movementMetersPerMinute,
    movementSpeedClass: classifyMovementSpeed(movementMetersPerMinute),
    narrativeTell,
    outletTell,
    resourceStrain,
    stateOfMind,
    valence,
    valueValence,
  };
}

export function formatSimulationTime(second: number): string {
  const day = Math.floor(second / SECONDS_PER_DAY) + 1;
  const daySecond = secondOfDay(second);
  const hour = Math.floor(daySecond / SECONDS_PER_HOUR);
  const minutePart = Math.floor((daySecond % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return `Day ${day}, ${String(hour).padStart(2, '0')}:${String(minutePart).padStart(2, '0')}`;
}
