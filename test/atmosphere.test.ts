import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DAY_PERIOD_IDS, daylightScheduleForSeason, dayPeriodAtSecond } from '../src/index.js';

describe('time of day', () => {
  it('derives every named day period from simulation time', () => {
    // Probes are authored as minutes of day for legibility.
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
      probes.map(([minute]) => dayPeriodAtSecond(minute * 60, 'spring')),
      probes.map(([, period]) => period),
    );
    assert.deepEqual(new Set(probes.map(([, period]) => period)), new Set(DAY_PERIOD_IDS));
  });

  it('shifts daylight boundaries by season and repeats across days', () => {
    assert.deepEqual(daylightScheduleForSeason('summer'), {
      sunriseSecond: 315 * 60,
      sunsetSecond: 1245 * 60,
    });
    assert.equal(dayPeriodAtSecond(24000, 'spring'), 'sunrise');
    assert.equal(dayPeriodAtSecond(24000, 'winter'), 'dawn');
    assert.equal(dayPeriodAtSecond(24000 + 86400, 'winter'), 'dawn');
  });
});
