import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PLAYBACK_RATES,
  accumulatePlayback,
  formatWorkbenchTime,
  playbackRateForId,
  projectPlaybackMovement,
} from '../app/playback.js';
import scenario from '../content/scenarios/market-morning.json';
import { advanceSimulation, createSimulation, navigationDistance } from '../src/index.js';
import { characters, environments } from './fixtures.js';

describe('workbench playback', () => {
  it('formats the visible clock as 12-hour time', () => {
    assert.equal(formatWorkbenchTime(0), 'Day 1, 12:00 am');
    assert.equal(formatWorkbenchTime(960), 'Day 1, 4:00 pm');
    assert.equal(formatWorkbenchTime(1445), 'Day 2, 12:05 am');
  });

  it('formats the visible clock as 24-hour time when requested', () => {
    assert.equal(formatWorkbenchTime(0, '24-hour'), 'Day 1, 00:00');
    assert.equal(formatWorkbenchTime(960, '24-hour'), 'Day 1, 16:00');
    assert.equal(formatWorkbenchTime(1445, '24-hour'), 'Day 2, 00:05');
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

  it('projects each partial tick at the authoritative walking pace and endpoint', () => {
    const beforeDeparture = advanceSimulation(
      createSimulation({
        characterLibrary: characters,
        environmentLibrary: environments,
        scenario,
      }),
      9,
    );
    const next = advanceSimulation(beforeDeparture, 1);
    const currentMara = beforeDeparture.agents.find(agent => agent.id === 'mara');
    const nextMara = next.agents.find(agent => agent.id === 'mara');
    assert.ok(currentMara);
    assert.ok(nextMara);
    assert.ok(
      navigationDistance(beforeDeparture.environment, currentMara.position, nextMara.position) > 0,
    );

    const halfway = projectPlaybackMovement(beforeDeparture, next, 0.5);
    const halfwayMara = halfway.agents.find(agent => agent.id === 'mara');
    assert.ok(halfwayMara);
    assert.ok(
      Math.abs(
        navigationDistance(
          beforeDeparture.environment,
          currentMara.position,
          halfwayMara.position,
        ) -
          currentMara.walkingMetersPerMinute * 0.5,
      ) < 1e-9,
    );
    assert.deepEqual(
      beforeDeparture.agents.find(agent => agent.id === 'mara'),
      currentMara,
    );

    const endpoint = projectPlaybackMovement(beforeDeparture, next, 1);
    assert.deepEqual(
      endpoint.agents.map(agent => agent.position),
      next.agents.map(agent => agent.position),
    );
    assert.equal(endpoint.minute, beforeDeparture.minute);
    assert.equal(endpoint.tick, beforeDeparture.tick);
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
