import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PLAYBACK_RATES,
  accumulatePlayback,
  formatWorkbenchTime,
  playbackRateForId,
} from '../app/playback.js';

describe('workbench playback', () => {
  it('formats the visible clock as 12-hour time', () => {
    assert.equal(formatWorkbenchTime(0), 'Day 1, 12:00 am');
    assert.equal(formatWorkbenchTime(960), 'Day 1, 4:00 pm');
    assert.equal(formatWorkbenchTime(1445), 'Day 2, 12:05 am');
  });

  it('maps real-time and minute-per-second rates to simulated time', () => {
    assert.equal(playbackRateForId('real-time').simulatedMinutesPerSecond, 1 / 60);
    assert.equal(playbackRateForId('15x').simulatedMinutesPerSecond, 15 / 60);
    assert.equal(playbackRateForId('60-minutes-per-second').simulatedMinutesPerSecond, 60);
    assert.deepEqual(
      PLAYBACK_RATES.map(rate => rate.label),
      [
        'Real-time',
        '2x',
        '5x',
        '10x',
        '15x',
        '1 m/s',
        '2 m/s',
        '5 m/s',
        '10 m/s',
        '30 m/s',
        '60 m/s',
      ],
    );
  });

  it('carries partial simulated minutes until a complete tick is available', () => {
    const rate = playbackRateForId('real-time');
    const partial = accumulatePlayback(0, 30, rate, 1);
    assert.equal(partial.ticks, 0);
    assert.equal(partial.carriedMinutes, 0.5);
    assert.deepEqual(accumulatePlayback(partial.carriedMinutes, 30, rate, 1), {
      carriedMinutes: 0,
      ticks: 1,
    });
  });

  it('batches accelerated time according to the loaded scenario cadence', () => {
    const rate = playbackRateForId('10-minutes-per-second');
    assert.deepEqual(accumulatePlayback(0, 0.5, rate, 1), {
      carriedMinutes: 0,
      ticks: 5,
    });
    assert.deepEqual(accumulatePlayback(0, 0.5, rate, 5), {
      carriedMinutes: 0,
      ticks: 1,
    });
  });
});
