export interface PlaybackRate {
  id: string;
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

export type PlaybackRateId = (typeof PLAYBACK_RATES)[number]['id'];

export const DEFAULT_PLAYBACK_RATE_ID: PlaybackRateId = 'real-time';

export interface PlaybackAdvance {
  carriedMinutes: number;
  ticks: number;
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
