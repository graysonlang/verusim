import type { SimulationState, TimeRateId } from '../src/model/types.js';
import { routePositionAtSecond } from '../src/simulation/navigation.js';
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

/** Real seconds of logical time a single frame may commit before the rest waits as backlog. */
export const DEFAULT_FRAME_COMMIT_REAL_SECONDS = 0.5;

/**
 * Playback time the workbench has received from the wall clock but not committed.
 * `carriedSeconds` is the fractional logical second below the integer domain and
 * survives pause, resume, and rate changes; `backlogSeconds` is whole due work the
 * solver has not yet caught up on, which is committed later rather than dropped.
 */
export interface PlaybackClock {
  backlogSeconds: number;
  carriedSeconds: number;
}

export const IDLE_PLAYBACK_CLOCK: PlaybackClock = Object.freeze({
  backlogSeconds: 0,
  carriedSeconds: 0,
});

export interface PlaybackFrame {
  clock: PlaybackClock;
  commitSeconds: number;
}

export interface PlaybackDiagnostics {
  backlogSeconds: number;
  committedSeconds: number;
  frameMs: number;
  solverMs: number;
}

function assertClock(clock: PlaybackClock): void {
  if (
    !Number.isFinite(clock.carriedSeconds) ||
    clock.carriedSeconds < 0 ||
    clock.carriedSeconds >= 1
  ) {
    throw new RangeError('carriedSeconds must be in [0, 1)');
  }
  if (!Number.isInteger(clock.backlogSeconds) || clock.backlogSeconds < 0) {
    throw new RangeError('backlogSeconds must be a non-negative integer');
  }
}

/**
 * Turn elapsed wall time at a playback rate into whole logical seconds to commit now.
 * Whole seconds beyond `maxCommitSeconds` stay in the backlog for later frames, so a
 * slow solver or a stalled frame makes logical time lag rather than lose due work.
 */
export function planPlaybackFrame(
  clock: PlaybackClock,
  elapsedRealSeconds: number,
  rate: PlaybackRate,
  maxCommitSeconds: number = Math.max(1, Math.ceil(rate.rate * DEFAULT_FRAME_COMMIT_REAL_SECONDS)),
): PlaybackFrame {
  assertClock(clock);
  if (!Number.isFinite(elapsedRealSeconds) || elapsedRealSeconds < 0) {
    throw new RangeError('elapsedRealSeconds must be a non-negative finite number');
  }
  if (!Number.isInteger(maxCommitSeconds) || maxCommitSeconds < 1) {
    throw new RangeError('maxCommitSeconds must be a positive integer');
  }
  const available = clock.carriedSeconds + elapsedRealSeconds * rate.rate;
  const wholeSeconds = Math.floor(available + 1e-9);
  const dueSeconds = clock.backlogSeconds + wholeSeconds;
  const commitSeconds = Math.min(dueSeconds, maxCommitSeconds);
  return {
    clock: {
      backlogSeconds: dueSeconds - commitSeconds,
      carriedSeconds: Math.min(Math.max(0, available - wholeSeconds), 1 - Number.EPSILON),
    },
    commitSeconds,
  };
}

/**
 * Frame projection between committed movement samples.
 * Each character with a committed route is placed along that route at the
 * fractional logical second; nothing else changes, and no character is
 * advanced by an evaluator or moved beyond its committed route.
 */
export function projectPlaybackState(
  state: SimulationState,
  fractionalSeconds: number,
): SimulationState {
  if (!Number.isFinite(fractionalSeconds) || fractionalSeconds < 0 || fractionalSeconds >= 1) {
    throw new RangeError('fractionalSeconds must be in [0, 1)');
  }
  if (fractionalSeconds === 0) return state;
  const at = state.second + fractionalSeconds;
  let changed = false;
  const characters = state.characters.map(character => {
    if (character.route === null) return character;
    const position = routePositionAtSecond(character.route, at);
    if (position === character.position) return character;
    changed = true;
    return { ...character, position };
  });
  return changed ? { ...state, characters } : state;
}

export function formatPlaybackDiagnostics(diagnostics: PlaybackDiagnostics): string {
  return `solver ${diagnostics.solverMs.toFixed(1)} ms / frame ${diagnostics.frameMs.toFixed(1)} ms / committed ${diagnostics.committedSeconds} s / backlog ${diagnostics.backlogSeconds} s`;
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
