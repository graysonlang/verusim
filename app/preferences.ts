import { TIME_RATE_IDS, type ScenarioFile, type TimeRateId } from '../src/model/types.js';

export type ClockFormat = '12-hour' | '24-hour';
export type DistanceUnit = 'feet' | 'meters';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

export interface ApplicationPreferences {
  clockFormat: ClockFormat;
  defaultTimeRate: TimeRateId;
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
}

export const PREFERENCES_KEY = 'verusim:preferences';

export const DEFAULT_APPLICATION_PREFERENCES: ApplicationPreferences = Object.freeze({
  clockFormat: '12-hour',
  defaultTimeRate: '1-minute-per-second',
  distanceUnit: 'feet',
  temperatureUnit: 'fahrenheit',
});

const TIME_RATE_ID_SET = new Set<string>(TIME_RATE_IDS);

export function isClockFormat(value: string): value is ClockFormat {
  return value === '12-hour' || value === '24-hour';
}

export function isDistanceUnit(value: string): value is DistanceUnit {
  return value === 'feet' || value === 'meters';
}

export function isTemperatureUnit(value: string): value is TemperatureUnit {
  return value === 'celsius' || value === 'fahrenheit';
}

export function isTimeRateId(value: string): value is TimeRateId {
  return TIME_RATE_ID_SET.has(value);
}

export function initialTimeRateForScenario(
  scenario: Pick<ScenarioFile, 'initialTimeRate'>,
  preferences: ApplicationPreferences,
): TimeRateId {
  return scenario.initialTimeRate ?? preferences.defaultTimeRate;
}

export function parsePreferences(raw: unknown): ApplicationPreferences {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_APPLICATION_PREFERENCES };
  const record = raw as Record<string, unknown>;
  const distanceUnit =
    typeof record.distanceUnit === 'string' && isDistanceUnit(record.distanceUnit)
      ? record.distanceUnit
      : DEFAULT_APPLICATION_PREFERENCES.distanceUnit;
  const legacyTemperatureUnit: TemperatureUnit =
    record.distanceUnit === 'meters' ? 'celsius' : 'fahrenheit';
  return {
    clockFormat:
      typeof record.clockFormat === 'string' && isClockFormat(record.clockFormat)
        ? record.clockFormat
        : DEFAULT_APPLICATION_PREFERENCES.clockFormat,
    defaultTimeRate:
      typeof record.defaultTimeRate === 'string' && isTimeRateId(record.defaultTimeRate)
        ? record.defaultTimeRate
        : DEFAULT_APPLICATION_PREFERENCES.defaultTimeRate,
    distanceUnit,
    temperatureUnit:
      typeof record.temperatureUnit === 'string' && isTemperatureUnit(record.temperatureUnit)
        ? record.temperatureUnit
        : record.distanceUnit === 'meters' || record.distanceUnit === 'feet'
          ? legacyTemperatureUnit
          : DEFAULT_APPLICATION_PREFERENCES.temperatureUnit,
  };
}

export function loadPreferences(storage: Pick<Storage, 'getItem'>): ApplicationPreferences {
  try {
    const stored = storage.getItem(PREFERENCES_KEY);
    return stored === null
      ? { ...DEFAULT_APPLICATION_PREFERENCES }
      : parsePreferences(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_APPLICATION_PREFERENCES };
  }
}

export function savePreferences(
  storage: Pick<Storage, 'setItem'>,
  preferences: ApplicationPreferences,
): void {
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}
