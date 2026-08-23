import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_APPLICATION_PREFERENCES,
  PREFERENCES_KEY,
  initialTimeRateForScenario,
  loadPreferences,
  parsePreferences,
  savePreferences,
} from '../app/preferences.js';
import { formatDistance, formatMovementRate, formatMovementSpeed } from '../app/units.js';

describe('application preferences', () => {
  it('defaults to one simulated minute per second, 12-hour time, and meters', () => {
    assert.deepEqual(parsePreferences(null), DEFAULT_APPLICATION_PREFERENCES);
    assert.deepEqual(parsePreferences({}), DEFAULT_APPLICATION_PREFERENCES);
  });

  it('accepts valid fields and falls back field by field', () => {
    assert.deepEqual(
      parsePreferences({
        clockFormat: '24-hour',
        defaultTimeRate: '10x',
        distanceUnit: 'feet',
      }),
      {
        clockFormat: '24-hour',
        defaultTimeRate: '10x',
        distanceUnit: 'feet',
      },
    );
    assert.deepEqual(
      parsePreferences({
        clockFormat: 'dial',
        defaultTimeRate: 'warp-speed',
        distanceUnit: 'yards',
      }),
      DEFAULT_APPLICATION_PREFERENCES,
    );
  });

  it('lets a scenario override only the active initial time rate', () => {
    const preferences = {
      ...DEFAULT_APPLICATION_PREFERENCES,
      clockFormat: '24-hour' as const,
      defaultTimeRate: '5x' as const,
      distanceUnit: 'feet' as const,
    };
    assert.equal(initialTimeRateForScenario({}, preferences), '5x');
    assert.equal(
      initialTimeRateForScenario({ initialTimeRate: '10-minutes-per-second' }, preferences),
      '10-minutes-per-second',
    );
    assert.equal(preferences.clockFormat, '24-hour');
    assert.equal(preferences.distanceUnit, 'feet');
  });

  it('survives unreadable storage and persists a device-local JSON record', () => {
    assert.deepEqual(
      loadPreferences({
        getItem: () => '{bad json',
      }),
      DEFAULT_APPLICATION_PREFERENCES,
    );

    let savedKey = '';
    let savedValue = '';
    savePreferences(
      {
        setItem: (key, value) => {
          savedKey = key;
          savedValue = value;
        },
      },
      {
        clockFormat: '24-hour',
        defaultTimeRate: '5x',
        distanceUnit: 'feet',
      },
    );
    assert.equal(savedKey, PREFERENCES_KEY);
    assert.equal(
      savedValue,
      '{"clockFormat":"24-hour","defaultTimeRate":"5x","distanceUnit":"feet"}',
    );
  });
});

describe('display units', () => {
  it('formats distances and movement without changing meter source values', () => {
    assert.equal(formatDistance(10, 'meters'), '10 m');
    assert.equal(formatDistance(10, 'feet'), '32.8 ft');
    assert.equal(formatMovementRate(72, 'meters'), '72 m/min');
    assert.equal(formatMovementRate(72, 'feet'), '236.2 ft/min');
    assert.equal(formatMovementSpeed(72, 'feet'), '3.94 ft/s');
  });
});
