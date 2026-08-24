import type { HeightClass, PhysicalBuild, WeightClass } from '../model/types.js';

interface BuildClassContribution {
  grossStrength: number;
  movementMultiplier: number;
  physicalPresence: number;
}

export interface BuildEffects {
  grossStrengthModifier: number;
  physicalPresenceModifier: number;
  walkingPaceMultiplier: number;
}

export const DEFAULT_WALKING_METERS_PER_MINUTE = 80;

const HEIGHT_CONTRIBUTIONS: Record<HeightClass, BuildClassContribution> = {
  average: { grossStrength: 0, movementMultiplier: 1, physicalPresence: 0 },
  short: { grossStrength: -0.08, movementMultiplier: 0.97, physicalPresence: -0.12 },
  tall: { grossStrength: 0.08, movementMultiplier: 1.04, physicalPresence: 0.12 },
};

const WEIGHT_CONTRIBUTIONS: Record<WeightClass, BuildClassContribution> = {
  average: { grossStrength: 0, movementMultiplier: 1, physicalPresence: 0 },
  heavy: { grossStrength: 0.16, movementMultiplier: 0.94, physicalPresence: 0.1 },
  light: { grossStrength: -0.14, movementMultiplier: 1.04, physicalPresence: -0.08 },
};

export function deriveBuildEffects(build: PhysicalBuild): BuildEffects {
  const height = HEIGHT_CONTRIBUTIONS[build.heightClass];
  const weight = WEIGHT_CONTRIBUTIONS[build.weightClass];
  return {
    grossStrengthModifier: height.grossStrength + weight.grossStrength,
    physicalPresenceModifier: height.physicalPresence + weight.physicalPresence,
    walkingPaceMultiplier: height.movementMultiplier * weight.movementMultiplier,
  };
}

export function applyBuildToWalkingPace(metersPerMinute: number, build: PhysicalBuild): number {
  return metersPerMinute * deriveBuildEffects(build).walkingPaceMultiplier;
}
