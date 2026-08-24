import type { SimulationAgent, SimulationState } from '../model/types.js';
import { describeAgent, type MovementSpeedClass } from '../simulation/observe.js';

const MAX_TRACE_REFERENCES = 8;

export interface TextObservationProjection {
  agentId: string;
  medium: 'text';
  minute: number;
  sourceTraceIds: string[];
  summary: string;
  tells: string[];
}

export interface EmbodiedObservationProjection {
  action: string;
  agentId: string;
  attention: 'available' | 'elsewhere' | 'fixed' | 'survival';
  expression: string;
  medium: 'embodied';
  minute: number;
  motion: MovementSpeedClass;
  posture: 'braced' | 'collapsed' | 'guarded' | 'neutral' | 'placating' | 'rigid';
  sourceTraceIds: string[];
}

function agentFor(state: SimulationState, agentId: string): SimulationAgent {
  const agent = state.agents.find(candidate => candidate.id === agentId);
  if (agent === undefined) throw new RangeError(`Unknown observation agent "${agentId}"`);
  return agent;
}

function sourceTraceIds(state: SimulationState, agentId: string): string[] {
  return state.trace.entries
    .filter(entry => entry.agentId === agentId)
    .slice(-MAX_TRACE_REFERENCES)
    .map(entry => entry.id);
}

function somaticText(agent: SimulationAgent): string | null {
  if (agent.somatic.level >= 4) return 'Cannot act without help';
  if (agent.somatic.level === 3) return 'Focused entirely on immediate survival';
  if (agent.somatic.level === 2) return 'Moves with visible difficulty';
  if (agent.somatic.level === 1) return 'Looks uncomfortable';
  return null;
}

export function projectTextObservation(
  state: SimulationState,
  agentId: string,
): TextObservationProjection {
  const agent = agentFor(state, agentId);
  const observed = describeAgent(agent);
  const tells = [
    somaticText(agent),
    observed.cascadeTell,
    observed.outletTell,
    observed.narrativeTell,
    observed.stateOfMind,
  ].filter((tell): tell is string => tell !== null);
  return {
    agentId,
    medium: 'text',
    minute: state.minute,
    sourceTraceIds: sourceTraceIds(state, agentId),
    summary: `${agent.profile.name} is ${observed.mood} while ${agent.currentActivity.toLowerCase()}.`,
    tells: [...new Set(tells)],
  };
}

function embodiedPosture(agent: SimulationAgent): EmbodiedObservationProjection['posture'] {
  if (agent.somatic.level >= 4 || agent.cascade === 'flop') return 'collapsed';
  if (agent.cascade === 'fight') return 'braced';
  if (agent.cascade === 'freeze') return 'rigid';
  if (agent.cascade === 'fawn') return 'placating';
  if (agent.cascade === 'flight' || agent.somatic.level >= 2) return 'guarded';
  return 'neutral';
}

function embodiedAttention(agent: SimulationAgent): EmbodiedObservationProjection['attention'] {
  if (agent.somatic.level >= 3) return 'survival';
  if (agent.cascade === 'freeze' || agent.cascade === 'fight') return 'fixed';
  if (agent.currentOutlet !== null || agent.cascade !== 'none') return 'elsewhere';
  return 'available';
}

export function projectEmbodiedObservation(
  state: SimulationState,
  agentId: string,
): EmbodiedObservationProjection {
  const agent = agentFor(state, agentId);
  const observed = describeAgent(agent);
  return {
    action: agent.currentActivity,
    agentId,
    attention: embodiedAttention(agent),
    expression: observed.mood,
    medium: 'embodied',
    minute: state.minute,
    motion: observed.movementSpeedClass,
    posture: embodiedPosture(agent),
    sourceTraceIds: sourceTraceIds(state, agentId),
  };
}
