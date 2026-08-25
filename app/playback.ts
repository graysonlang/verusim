import type { SimulationState, TimeRateId } from '../src/model/types.js';
import { advanceLayerPosition } from '../src/simulation/navigation.js';
import { advanceSimulation } from '../src/simulation/runtime.js';
import type { ClockFormat } from './preferences.js';

export interface PlaybackRate {
  id: TimeRateId;
  label: string;
  rate: number;
}

export const PLAYBACK_RATES = [
  { id: 'real-time', label: 'Real-time', rate: 1 },
  { id: '2x', label: '2x', rate: 2 },
  { id: '5x', label: '5x', rate: 5 },
  { id: '10x', label: '10x', rate: 10 },
  { id: '15x', label: '15x', rate: 15 },
  { id: '1-minute-per-second', label: '1 m/s', rate: 60 },
  { id: '2-minutes-per-second', label: '2 m/s', rate: 120 },
  { id: '5-minutes-per-second', label: '5 m/s', rate: 300 },
  { id: '10-minutes-per-second', label: '10 m/s', rate: 600 },
  { id: '30-minutes-per-second', label: '30 m/s', rate: 1800 },
  { id: '60-minutes-per-second', label: '60 m/s', rate: 3600 },
] as const satisfies readonly PlaybackRate[];

export type PlaybackRateId = TimeRateId;

export interface PlaybackAdvance {
  carriedSeconds: number;
  ticks: number;
}

export function projectPlaybackMovement(
  state: SimulationState,
  nextState: SimulationState,
  partialTickSeconds: number,
): SimulationState {
  if (!Number.isFinite(partialTickSeconds) || partialTickSeconds < 0) {
    throw new RangeError('partialTickSeconds must be a non-negative finite number');
  }
  if (partialTickSeconds > state.scenario.tickSeconds) {
    throw new RangeError('partialTickSeconds cannot exceed the scenario tick cadence');
  }
  if (partialTickSeconds === 0) return state;
  const nextAgents = new Map(nextState.characters.map(agent => [agent.id, agent]));
  let changed = false;
  const agents = state.characters.map(agent => {
    const nextAgent = nextAgents.get(agent.id);
    if (nextAgent === undefined) {
      throw new RangeError(`Missing next-tick agent "${agent.id}"`);
    }
    const position = advanceLayerPosition(
      state.environment,
      agent.position,
      nextAgent.position,
      (agent.walkingMetersPerMinute / 60) * partialTickSeconds,
    );
    if (position === agent.position) return agent;
    changed = true;
    return { ...agent, position };
  });
  return changed ? { ...state, characters: agents } : state;
}

export function projectPlaybackState(
  state: SimulationState,
  partialTickSeconds: number,
): SimulationState {
  if (!Number.isFinite(partialTickSeconds) || partialTickSeconds < 0) {
    throw new RangeError('partialTickSeconds must be a non-negative finite number');
  }
  if (partialTickSeconds > state.scenario.tickSeconds) {
    throw new RangeError('partialTickSeconds cannot exceed the scenario tick cadence');
  }
  if (partialTickSeconds === 0) return state;
  return projectPlaybackMovement(state, advanceSimulation(state, 1), partialTickSeconds);
}

export function playbackRateShowsSeconds(rate: PlaybackRate): boolean {
  return rate.rate < 60;
}

export function formatWorkbenchTime(
  second: number,
  clockFormat: ClockFormat = '12-hour',
  showSeconds = false,
): string {
  const totalSeconds = Math.floor(second + 1e-6);
  const day = Math.floor(totalSeconds / 86400) + 1;
  const secondOfDay = ((totalSeconds % 86400) + 86400) % 86400;
  const hour = Math.floor(secondOfDay / 3600);
  const minutePart = Math.floor((secondOfDay % 3600) / 60);
  const secondPart = secondOfDay % 60;
  const dayPrefix = day === 1 ? '' : `Day ${day}, `;
  const seconds = showSeconds ? `:${String(secondPart).padStart(2, '0')}` : '';
  if (clockFormat === '24-hour') {
    return `${dayPrefix}${String(hour).padStart(2, '0')}:${String(minutePart).padStart(2, '0')}${seconds}`;
  }
  const period = hour < 12 ? 'am' : 'pm';
  const clockHour = hour % 12 || 12;
  return `${dayPrefix}${clockHour}:${String(minutePart).padStart(2, '0')}${seconds} ${period}`;
}

export function playbackRateForId(id: PlaybackRateId): (typeof PLAYBACK_RATES)[number] {
  const rate = PLAYBACK_RATES.find(candidate => candidate.id === id);
  if (rate === undefined) throw new RangeError(`Unknown playback rate "${id}"`);
  return rate;
}

export function accumulatePlayback(
  carriedSeconds: number,
  elapsedSeconds: number,
  rate: PlaybackRate,
  tickSeconds: number,
): PlaybackAdvance {
  if (!Number.isFinite(carriedSeconds) || carriedSeconds < 0) {
    throw new RangeError('carriedSeconds must be a non-negative finite number');
  }
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError('elapsedSeconds must be a non-negative finite number');
  }
  if (!Number.isFinite(tickSeconds) || tickSeconds <= 0) {
    throw new RangeError('tickSeconds must be a positive finite number');
  }
  const availableSeconds = carriedSeconds + elapsedSeconds * rate.rate;
  const ticks = Math.floor((availableSeconds + tickSeconds * 1e-9) / tickSeconds);
  return {
    carriedSeconds: Math.max(0, availableSeconds - ticks * tickSeconds),
    ticks,
  };
}
