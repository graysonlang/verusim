import type { SimulationState, TimeRateId } from '../src/model/types.js';
import { advanceLayerPosition } from '../src/simulation/navigation.js';
import type { ClockFormat } from './preferences.js';

export interface PlaybackRate {
  id: TimeRateId;
  label: string;
  simulatedMinutesPerSecond: number;
}

export const PLAYBACK_RATES = [
  { id: 'real-time', label: 'Real-time', simulatedMinutesPerSecond: 1 / 60 },
  { id: '2x', label: '2x', simulatedMinutesPerSecond: 2 / 60 },
  { id: '5x', label: '5x', simulatedMinutesPerSecond: 5 / 60 },
  { id: '10x', label: '10x', simulatedMinutesPerSecond: 10 / 60 },
  { id: '15x', label: '15x', simulatedMinutesPerSecond: 15 / 60 },
  { id: '1-minute-per-second', label: '1 m/s', simulatedMinutesPerSecond: 1 },
  { id: '2-minutes-per-second', label: '2 m/s', simulatedMinutesPerSecond: 2 },
  { id: '5-minutes-per-second', label: '5 m/s', simulatedMinutesPerSecond: 5 },
  { id: '10-minutes-per-second', label: '10 m/s', simulatedMinutesPerSecond: 10 },
  { id: '30-minutes-per-second', label: '30 m/s', simulatedMinutesPerSecond: 30 },
  { id: '60-minutes-per-second', label: '60 m/s', simulatedMinutesPerSecond: 60 },
] as const satisfies readonly PlaybackRate[];

export type PlaybackRateId = TimeRateId;

export interface PlaybackAdvance {
  carriedMinutes: number;
  ticks: number;
}

export function projectPlaybackMovement(
  state: SimulationState,
  nextState: SimulationState,
  partialTickMinutes: number,
): SimulationState {
  if (!Number.isFinite(partialTickMinutes) || partialTickMinutes < 0) {
    throw new RangeError('partialTickMinutes must be a non-negative finite number');
  }
  if (partialTickMinutes > state.scenario.tickMinutes) {
    throw new RangeError('partialTickMinutes cannot exceed the scenario tick cadence');
  }
  if (partialTickMinutes === 0) return state;
  const nextAgents = new Map(nextState.agents.map(agent => [agent.id, agent]));
  let changed = false;
  const agents = state.agents.map(agent => {
    const nextAgent = nextAgents.get(agent.id);
    if (nextAgent === undefined) {
      throw new RangeError(`Missing next-tick agent "${agent.id}"`);
    }
    const position = advanceLayerPosition(
      state.environment,
      agent.position,
      nextAgent.position,
      agent.walkingMetersPerMinute * partialTickMinutes,
    );
    if (position === agent.position) return agent;
    changed = true;
    return { ...agent, position };
  });
  return changed ? { ...state, agents } : state;
}

export function formatWorkbenchTime(minute: number, clockFormat: ClockFormat = '12-hour'): string {
  const day = Math.floor(minute / 1440) + 1;
  const minuteOfDay = ((minute % 1440) + 1440) % 1440;
  const hour = Math.floor(minuteOfDay / 60);
  const minutePart = minuteOfDay % 60;
  if (clockFormat === '24-hour') {
    return `Day ${day}, ${String(hour).padStart(2, '0')}:${String(minutePart).padStart(2, '0')}`;
  }
  const period = hour < 12 ? 'am' : 'pm';
  const clockHour = hour % 12 || 12;
  return `Day ${day}, ${clockHour}:${String(minutePart).padStart(2, '0')} ${period}`;
}

export function playbackRateForId(id: PlaybackRateId): (typeof PLAYBACK_RATES)[number] {
  const rate = PLAYBACK_RATES.find(candidate => candidate.id === id);
  if (rate === undefined) throw new RangeError(`Unknown playback rate "${id}"`);
  return rate;
}

export function accumulatePlayback(
  carriedMinutes: number,
  elapsedSeconds: number,
  rate: PlaybackRate,
  tickMinutes: number,
): PlaybackAdvance {
  if (!Number.isFinite(carriedMinutes) || carriedMinutes < 0) {
    throw new RangeError('carriedMinutes must be a non-negative finite number');
  }
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError('elapsedSeconds must be a non-negative finite number');
  }
  if (!Number.isFinite(tickMinutes) || tickMinutes <= 0) {
    throw new RangeError('tickMinutes must be a positive finite number');
  }
  const availableMinutes = carriedMinutes + elapsedSeconds * rate.simulatedMinutesPerSecond;
  const ticks = Math.floor((availableMinutes + tickMinutes * 1e-9) / tickMinutes);
  return {
    carriedMinutes: Math.max(0, availableMinutes - ticks * tickMinutes),
    ticks,
  };
}
