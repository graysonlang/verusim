import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DAY_PERIOD_IDS, daylightScheduleForSeason, dayPeriodAtMinute } from '../src/index.js';

describe('time of day', () => {
  it('derives every named day period from simulation time', () => {
    const probes = [
      [0, 'night'],
      [300, 'dawn'],
      [345, 'sunrise'],
      [405, 'morning'],
      [690, 'midday'],
      [810, 'afternoon'],
      [1020, 'evening'],
      [1090, 'sunset'],
      [1140, 'dusk'],
      [1185, 'night'],
    ] as const;
    assert.deepEqual(
      probes.map(([minute]) => dayPeriodAtMinute(minute, 'spring')),
      probes.map(([, period]) => period),
    );
    assert.deepEqual(new Set(probes.map(([, period]) => period)), new Set(DAY_PERIOD_IDS));
  });

  it('shifts daylight boundaries by season and repeats across days', () => {
    assert.deepEqual(daylightScheduleForSeason('summer'), {
      sunriseMinute: 315,
      sunsetMinute: 1245,
    });
    assert.equal(dayPeriodAtMinute(400, 'spring'), 'sunrise');
    assert.equal(dayPeriodAtMinute(400, 'winter'), 'dawn');
    assert.equal(dayPeriodAtMinute(400 + 1440, 'winter'), 'dawn');
  });
});
