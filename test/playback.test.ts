import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IDLE_PLAYBACK_CLOCK,
  PLAYBACK_RATES,
  formatPlaybackDiagnostics,
  formatWorkbenchTime,
  planPlaybackFrame,
  playbackRateForId,
  playbackRateShowsSeconds,
  projectPlaybackState,
} from '../app/playback.js';
import scenario from '../content/scenarios/market-morning.json';
import {
  advanceTo,
  createSimulation,
  locationCenter,
  navigationDistance,
  redirectCharacter,
  routePositionAtSecond,
} from '../src/index.js';
import { characters, environments } from './fixtures.js';

describe('workbench playback', () => {
  it('formats the visible clock as 12-hour time', () => {
    assert.equal(formatWorkbenchTime(0), '12:00 am');
    assert.equal(formatWorkbenchTime(57600), '4:00 pm');
    assert.equal(formatWorkbenchTime(86700), 'Day 2, 12:05 am');
    assert.equal(formatWorkbenchTime(28200 + 7, '12-hour', true), '7:50:07 am');
  });

  it('formats the visible clock as 24-hour time when requested', () => {
    assert.equal(formatWorkbenchTime(0, '24-hour'), '00:00');
    assert.equal(formatWorkbenchTime(57600, '24-hour'), '16:00');
    assert.equal(formatWorkbenchTime(86700, '24-hour'), 'Day 2, 00:05');
    assert.equal(formatWorkbenchTime(86730, '24-hour', true), 'Day 2, 00:05:30');
  });

  it('expresses every rate as simulated seconds per real second', () => {
    assert.equal(playbackRateForId('real-time').rate, 1);
    assert.equal(playbackRateForId('1-minute-per-second').rate, 60);
    assert.equal(playbackRateForId('60-minutes-per-second').rate, 3600);
    assert.deepEqual(
      PLAYBACK_RATES.map(rate => rate.rate),
      [1, 2, 5, 10, 15, 60, 120, 300, 600, 1800, 3600],
    );
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
    assert.equal(playbackRateShowsSeconds(playbackRateForId('15x')), true);
    assert.equal(playbackRateShowsSeconds(playbackRateForId('1-minute-per-second')), false);
  });

  it('carries fractional logical seconds until a whole second is available', () => {
    const rate = playbackRateForId('real-time');
    const partial = planPlaybackFrame(IDLE_PLAYBACK_CLOCK, 0.4, rate);
    assert.equal(partial.commitSeconds, 0);
    assert.ok(Math.abs(partial.clock.carriedSeconds - 0.4) < 1e-9);
    const whole = planPlaybackFrame(partial.clock, 0.6, rate);
    assert.equal(whole.commitSeconds, 1);
    assert.ok(whole.clock.carriedSeconds < 1e-9);
    assert.equal(whole.clock.backlogSeconds, 0);
  });

  it('carries fractional time across playback rate changes', () => {
    const realTime = planPlaybackFrame(IDLE_PLAYBACK_CLOCK, 0.3, playbackRateForId('real-time'));
    assert.equal(realTime.commitSeconds, 0);
    const doubled = planPlaybackFrame(realTime.clock, 0.35, playbackRateForId('2x'));
    assert.equal(doubled.commitSeconds, 1);
    assert.ok(doubled.clock.carriedSeconds < 1e-9);
    assert.throws(
      () => planPlaybackFrame({ backlogSeconds: 0, carriedSeconds: 1 }, 0, playbackRateForId('2x')),
      RangeError,
    );
    assert.throws(
      () => planPlaybackFrame(IDLE_PLAYBACK_CLOCK, -1, playbackRateForId('2x')),
      RangeError,
    );
  });

  it('projects frames along committed routes without advancing anything else', () => {
    const initial = createSimulation({
      characterLibrary: characters,
      environmentLibrary: environments,
      scenario,
    });
    const mara = initial.characters.find(character => character.id === 'mara');
    assert.ok(mara);
    const farthest = initial.environment.locations
      .map(location => ({
        distance: navigationDistance(initial.environment, mara.position, locationCenter(location)),
        location,
      }))
      .filter(entry => Number.isFinite(entry.distance))
      .toSorted((left, right) => right.distance - left.distance)[0];
    assert.ok(farthest);
    const walking = advanceTo(
      redirectCharacter(initial, 'mara', farthest.location.id),
      initial.second + 1,
    );
    const committed = walking.characters.find(character => character.id === 'mara');
    assert.ok(committed?.route);

    const halfway = projectPlaybackState(walking, 0.5);
    const projected = halfway.characters.find(character => character.id === 'mara');
    assert.ok(projected);
    assert.deepEqual(
      projected.position,
      routePositionAtSecond(committed.route, walking.second + 0.5),
    );
    assert.notDeepEqual(projected.position, committed.position);
    assert.equal(halfway.second, walking.second);
    assert.equal(halfway.tick, walking.tick);
    assert.deepEqual(
      halfway.characters.filter(character => character.route === null),
      walking.characters.filter(character => character.route === null),
    );
    assert.equal(projectPlaybackState(walking, 0), walking);
    assert.throws(() => projectPlaybackState(walking, 1), RangeError);
    assert.throws(() => projectPlaybackState(walking, -0.1), RangeError);
  });

  it('commits at most a frame budget and keeps the remainder as backlog', () => {
    const rate = playbackRateForId('10-minutes-per-second');
    const steady = planPlaybackFrame(IDLE_PLAYBACK_CLOCK, 0.5, rate);
    assert.deepEqual(steady, {
      clock: { backlogSeconds: 0, carriedSeconds: 0 },
      commitSeconds: 300,
    });
    const stalled = planPlaybackFrame(IDLE_PLAYBACK_CLOCK, 2, rate);
    assert.deepEqual(stalled, {
      clock: { backlogSeconds: 900, carriedSeconds: 0 },
      commitSeconds: 300,
    });
    const draining = planPlaybackFrame(stalled.clock, 0, rate);
    assert.deepEqual(draining, {
      clock: { backlogSeconds: 600, carriedSeconds: 0 },
      commitSeconds: 300,
    });
    assert.deepEqual(planPlaybackFrame(stalled.clock, 0, rate, 900), {
      clock: { backlogSeconds: 0, carriedSeconds: 0 },
      commitSeconds: 900,
    });
    assert.throws(() => planPlaybackFrame(IDLE_PLAYBACK_CLOCK, 0, rate, 0), RangeError);
    assert.equal(
      formatPlaybackDiagnostics({
        backlogSeconds: 600,
        committedSeconds: 300,
        frameMs: 16.66,
        solverMs: 2.04,
      }),
      'solver 2.0 ms / frame 16.7 ms / committed 300 s / backlog 600 s',
    );
  });
});
