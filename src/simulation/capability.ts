import {
  CAPABILITY_IDS,
  type AgentCapabilityCheck,
  type CapabilityCheck,
  type CapabilityId,
  type CapabilityResolution,
  type CapabilityResolutionBand,
  type SimulationAgent,
} from '../model/types.js';
import { traceTerm } from './trace.js';

const CAPABILITY_ID_SET = new Set<string>(CAPABILITY_IDS);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function unitValue(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite number from 0 through 1`);
  }
  return value;
}

function modifierValue(value: number, name: string): number {
  if (!Number.isFinite(value) || value < -1 || value > 1) {
    throw new RangeError(`${name} must be a finite number from -1 through 1`);
  }
  return value;
}

function nonemptySource(value: string, name: string): string {
  if (value.trim() === '') throw new RangeError(`${name} must be a non-empty source`);
  return value;
}

function geometricMean(values: number[]): number {
  return values.reduce((product, value) => product * value, 1) ** (1 / values.length);
}

export function capabilityAvailability(agent: SimulationAgent, capabilityId: CapabilityId): number {
  switch (capabilityId) {
    case 'acuity':
      return geometricMean([agent.resources.executiveBudget, agent.resources.physicalStamina]);
    case 'evidenceCalibration':
      return geometricMean([agent.resources.executiveBudget, agent.resources.regulationReserve]);
    case 'expressiveControl':
      return geometricMean([
        agent.resources.executiveBudget,
        agent.resources.regulationReserve,
        agent.resources.socialBattery,
      ]);
  }
}

function availabilitySources(agentId: string, capabilityId: CapabilityId): string[] {
  switch (capabilityId) {
    case 'acuity':
      return [
        `agents.${agentId}.resources.executiveBudget`,
        `agents.${agentId}.resources.physicalStamina`,
      ];
    case 'evidenceCalibration':
      return [
        `agents.${agentId}.resources.executiveBudget`,
        `agents.${agentId}.resources.regulationReserve`,
      ];
    case 'expressiveControl':
      return [
        `agents.${agentId}.resources.executiveBudget`,
        `agents.${agentId}.resources.regulationReserve`,
        `agents.${agentId}.resources.socialBattery`,
      ];
  }
}

export function capabilityBand(margin: number): CapabilityResolutionBand {
  if (!Number.isFinite(margin)) throw new RangeError('margin must be finite');
  if (margin >= 0.6) return 'strong-yes';
  if (margin >= 0.2) return 'weak-yes';
  if (margin > -0.2) return 'so-so';
  if (margin > -0.6) return 'weak-no';
  return 'strong-no';
}

export function resolveCapabilityCheck(input: CapabilityCheck): CapabilityResolution {
  if (!CAPABILITY_ID_SET.has(input.capabilityId)) {
    throw new RangeError(`unknown capability "${input.capabilityId}"`);
  }
  const baseCapability = unitValue(input.baseCapability, 'baseCapability');
  const availableCapacity = unitValue(input.availableCapacity, 'availableCapacity');
  const difficulty = unitValue(input.difficulty, 'difficulty');
  nonemptySource(input.capabilitySource, 'capabilitySource');
  nonemptySource(input.difficultySource, 'difficultySource');
  if (input.availableCapacitySources.length === 0) {
    throw new RangeError('availableCapacitySources must contain at least one source');
  }
  input.availableCapacitySources.forEach((source, index) => {
    nonemptySource(source, `availableCapacitySources[${index}]`);
  });
  const modifierIds = new Set<string>();
  const modifiers = input.modifiers.map((modifier, index) => {
    if (modifier.id.trim() === '') {
      throw new RangeError(`modifiers[${index}].id must be non-empty`);
    }
    if (modifierIds.has(modifier.id)) {
      throw new RangeError(`duplicate capability modifier "${modifier.id}"`);
    }
    modifierIds.add(modifier.id);
    return {
      ...modifier,
      source: nonemptySource(modifier.source, `modifiers[${index}].source`),
      value: modifierValue(modifier.value, `modifiers[${index}].value`),
    };
  });
  const effectiveCapability = baseCapability * availableCapacity;
  const terms = [
    traceTerm('base-capability', baseCapability, input.capabilitySource),
    traceTerm('available-capacity', availableCapacity, ...input.availableCapacitySources),
    traceTerm(
      'effective-capability',
      effectiveCapability,
      input.capabilitySource,
      ...input.availableCapacitySources,
    ),
    traceTerm('difficulty', difficulty, input.difficultySource),
    ...modifiers.map(modifier =>
      traceTerm(`modifier:${modifier.id}`, modifier.value, modifier.source),
    ),
  ];
  if (!input.applicable || !input.known) {
    return {
      availableCapacity,
      band: input.applicable ? 'pass' : 'strike',
      baseCapability,
      capabilityId: input.capabilityId,
      difficulty,
      effectiveCapability,
      margin: null,
      modifiers,
      terms,
    };
  }
  const margin = clamp(
    effectiveCapability -
      difficulty +
      modifiers.reduce((total, modifier) => total + modifier.value, 0),
    -1,
    1,
  );
  return {
    availableCapacity,
    band: capabilityBand(margin),
    baseCapability,
    capabilityId: input.capabilityId,
    difficulty,
    effectiveCapability,
    margin,
    modifiers,
    terms: [...terms, traceTerm('margin', margin, ...terms.flatMap(term => term.sources))],
  };
}

export function resolveAgentCapabilityCheck(
  agent: SimulationAgent,
  input: AgentCapabilityCheck,
): CapabilityResolution {
  return resolveCapabilityCheck({
    ...input,
    availableCapacity: capabilityAvailability(agent, input.capabilityId),
    availableCapacitySources: availabilitySources(agent.id, input.capabilityId),
    baseCapability: agent.profile.capabilities[input.capabilityId],
    capabilitySource: `agents.${agent.id}.profile.capabilities.${input.capabilityId}`,
  });
}
