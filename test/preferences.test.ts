import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_APPLICATION_PREFERENCES,
  PREFERENCES_KEY,
  initialTimeRateForScenario,
  loadPreferences,
  parsePreferences,
  savePreferences,
  timeRateAfterScenarioLoad,
} from '../app/preferences.js';
import { formatDistance, formatMovementSpeed, formatTemperature } from '../app/units.js';

describe('application preferences', () => {
  it('defaults time, units, sidebars, and status-bar presentation', () => {
    assert.deepEqual(parsePreferences(null), DEFAULT_APPLICATION_PREFERENCES);
    assert.deepEqual(parsePreferences({}), DEFAULT_APPLICATION_PREFERENCES);
  });

  it('accepts valid fields and falls back field by field', () => {
    assert.deepEqual(
      parsePreferences({
        clockFormat: '24-hour',
        defaultTimeRate: '10x',
        distanceUnit: 'feet',
        leftSidebarVisible: false,
        leftSidebarWidth: 300,
        problemsPaneExpanded: true,
        problemsPaneHeight: 200,
        rightSidebarVisible: false,
        rightSidebarWidth: 400,
        showStatusBar: true,
        temperatureUnit: 'celsius',
      }),
      {
        clockFormat: '24-hour',
        defaultTimeRate: '10x',
        distanceUnit: 'feet',
        leftSidebarVisible: false,
        leftSidebarWidth: 300,
        problemsPaneExpanded: true,
        problemsPaneHeight: 200,
        rightSidebarVisible: false,
        rightSidebarWidth: 400,
        showStatusBar: true,
        temperatureUnit: 'celsius',
      },
    );
    assert.deepEqual(
      parsePreferences({
        clockFormat: 'dial',
        defaultTimeRate: 'warp-speed',
        distanceUnit: 'yards',
        leftSidebarVisible: 'no',
        leftSidebarWidth: 79,
        problemsPaneExpanded: 'yes',
        problemsPaneHeight: 12,
        rightSidebarVisible: 'yes',
        rightSidebarWidth: Number.POSITIVE_INFINITY,
        showStatusBar: 'yes',
        temperatureUnit: 'kelvin',
      }),
      DEFAULT_APPLICATION_PREFERENCES,
    );
  });

  it('migrates the former distance-coupled temperature behavior', () => {
    assert.deepEqual(parsePreferences({ distanceUnit: 'meters' }), {
      ...DEFAULT_APPLICATION_PREFERENCES,
      distanceUnit: 'meters',
      temperatureUnit: 'celsius',
    });
    assert.equal(parsePreferences({ distanceUnit: 'feet' }).temperatureUnit, 'fahrenheit');
  });

  it('lets a scenario override only the active initial time rate', () => {
    const preferences = {
      ...DEFAULT_APPLICATION_PREFERENCES,
      clockFormat: '24-hour' as const,
      defaultTimeRate: '5x' as const,
      distanceUnit: 'feet' as const,
      temperatureUnit: 'celsius' as const,
    };
    assert.equal(initialTimeRateForScenario({}, preferences), '5x');
    assert.equal(
      initialTimeRateForScenario({ initialTimeRate: '10-minutes-per-second' }, preferences),
      '10-minutes-per-second',
    );
    assert.equal(preferences.clockFormat, '24-hour');
    assert.equal(preferences.distanceUnit, 'feet');
    assert.equal(preferences.temperatureUnit, 'celsius');
  });

  it('retains the active time rate across scenario loads unless the scenario overrides it', () => {
    assert.equal(timeRateAfterScenarioLoad({}, '15x'), '15x');
    assert.equal(
      timeRateAfterScenarioLoad({ initialTimeRate: '10-minutes-per-second' }, '15x'),
      '10-minutes-per-second',
    );
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
        ...DEFAULT_APPLICATION_PREFERENCES,
        clockFormat: '24-hour',
        defaultTimeRate: '5x',
        distanceUnit: 'feet',
        showStatusBar: true,
        temperatureUnit: 'celsius',
      },
    );
    assert.equal(savedKey, PREFERENCES_KEY);
    assert.equal(
      savedValue,
      '{"clockFormat":"24-hour","defaultTimeRate":"5x","distanceUnit":"feet","leftSidebarVisible":true,"leftSidebarWidth":250,"problemsPaneExpanded":false,"problemsPaneHeight":140,"rightSidebarVisible":true,"rightSidebarWidth":350,"showStatusBar":true,"temperatureUnit":"celsius"}',
    );
  });
});

describe('display units', () => {
  it('formats distances and movement without changing meter source values', () => {
    assert.equal(formatDistance(10, 'meters'), '10 m');
    assert.equal(formatDistance(10, 'feet'), '32.8 ft');
    assert.equal(formatMovementSpeed(72, 'meters'), '1.2 m/s');
    assert.equal(formatMovementSpeed(72, 'feet'), '3.94 ft/s');
    assert.equal(formatTemperature(20, 'celsius'), '20 C');
    assert.equal(formatTemperature(20, 'fahrenheit'), '68 F');
  });
});
