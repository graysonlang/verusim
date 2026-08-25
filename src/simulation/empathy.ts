import { clamp } from '../model/retention.js';
import {
  SOCIAL_FEATURE_IDS,
  type EmpathyEvaluation,
  type SimulationState,
  type SocialFeatureMap,
} from '../model/types.js';
import { effectiveEmpathy } from './history.js';

const DISTANT_FEATURES: SocialFeatureMap = {
  category: 0,
  familiarity: 0,
  kinship: 0,
  reciprocity: 0,
  similarity: 0,
};

export function evaluateEmpathy(
  state: SimulationState,
  observerId: string,
  subjectId: string,
  perceivedThreat = 0,
): EmpathyEvaluation {
  const observer = state.agents.find(agent => agent.id === observerId);
  if (observer === undefined) throw new RangeError(`Unknown empathy observer "${observerId}"`);
  const subject = state.agents.find(agent => agent.id === subjectId);
  if (subject === undefined) throw new RangeError(`Unknown empathy subject "${subjectId}"`);

  const envelope = effectiveEmpathy(observer);
  const threatLoad = clamp(perceivedThreat * envelope.threatSensitivity, 0, 1);
  let features: SocialFeatureMap;
  let distance: number;

  if (observerId === subjectId) {
    features = {
      category: 1,
      familiarity: 1,
      kinship: 1,
      reciprocity: 1,
      similarity: 1,
    };
    distance = envelope.selfPosition;
  } else {
    features =
      state.dyads.find(
        relation => relation.observerId === observerId && relation.subjectId === subjectId,
      )?.features ?? DISTANT_FEATURES;
    let weightedDistance = 0;
    let totalWeight = 0;
    for (const featureId of SOCIAL_FEATURE_IDS) {
      let weight = envelope.featureWeights[featureId];
      let affinity = features[featureId];
      if (featureId === 'kinship') weight *= 1 + threatLoad * 2;
      if (featureId === 'familiarity') {
        weight *= 1 - threatLoad * 0.85;
        affinity *= 1 - threatLoad * 0.65;
      }
      weightedDistance += weight * (1 - affinity);
      totalWeight += weight;
    }
    distance = totalWeight === 0 ? 1 : clamp(weightedDistance / totalWeight, 0, 1);
  }

  const effectiveFloor = envelope.floor * (1 - threatLoad);
  const empathy =
    effectiveFloor + (envelope.ceiling - effectiveFloor) * Math.exp(-envelope.steepness * distance);
  return {
    distance,
    empathy: clamp(empathy, 0, 1),
    effectiveFloor,
    features: { ...features },
    observerId,
    subjectId,
  };
}
