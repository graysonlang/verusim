import { SECONDS_PER_MINUTE, secondOfDay } from '../model/time.js';
import type { Season } from '../model/types.js';

export const DAY_PERIOD_IDS = [
  'dawn',
  'sunrise',
  'morning',
  'midday',
  'afternoon',
  'evening',
  'sunset',
  'dusk',
  'night',
] as const;

export type DayPeriod = (typeof DAY_PERIOD_IDS)[number];

export const DAY_PERIOD_LABELS: Record<DayPeriod, string> = {
  afternoon: 'Afternoon',
  dawn: 'Dawn',
  dusk: 'Dusk',
  evening: 'Evening',
  midday: 'Midday',
  morning: 'Morning',
  night: 'Night',
  sunrise: 'Sunrise',
  sunset: 'Sunset',
};

interface DaylightSchedule {
  sunriseSecond: number;
  sunsetSecond: number;
}

const DAYLIGHT_SCHEDULES: Record<Season, DaylightSchedule> = {
  autumn: { sunriseSecond: 390 * SECONDS_PER_MINUTE, sunsetSecond: 1065 * SECONDS_PER_MINUTE },
  spring: { sunriseSecond: 360 * SECONDS_PER_MINUTE, sunsetSecond: 1110 * SECONDS_PER_MINUTE },
  summer: { sunriseSecond: 315 * SECONDS_PER_MINUTE, sunsetSecond: 1245 * SECONDS_PER_MINUTE },
  winter: { sunriseSecond: 450 * SECONDS_PER_MINUTE, sunsetSecond: 990 * SECONDS_PER_MINUTE },
};

export function daylightScheduleForSeason(season: Season): DaylightSchedule {
  return { ...DAYLIGHT_SCHEDULES[season] };
}

export function dayPeriodAtSecond(second: number, season: Season): DayPeriod {
  const current = secondOfDay(second);
  const { sunriseSecond, sunsetSecond } = DAYLIGHT_SCHEDULES[season];
  const dawnStart = sunriseSecond - 60 * SECONDS_PER_MINUTE;
  const sunriseStart = sunriseSecond - 15 * SECONDS_PER_MINUTE;
  const sunriseEnd = sunriseSecond + 45 * SECONDS_PER_MINUTE;
  const middayStart = 690 * SECONDS_PER_MINUTE;
  const afternoonStart = 810 * SECONDS_PER_MINUTE;
  const eveningStart = sunsetSecond - 90 * SECONDS_PER_MINUTE;
  const sunsetStart = sunsetSecond - 20 * SECONDS_PER_MINUTE;
  const sunsetEnd = sunsetSecond + 30 * SECONDS_PER_MINUTE;
  const duskEnd = sunsetSecond + 75 * SECONDS_PER_MINUTE;

  if (current < dawnStart || current >= duskEnd) return 'night';
  if (current < sunriseStart) return 'dawn';
  if (current < sunriseEnd) return 'sunrise';
  if (current < middayStart) return 'morning';
  if (current < afternoonStart) return 'midday';
  if (current < eveningStart) return 'afternoon';
  if (current < sunsetStart) return 'evening';
  if (current < sunsetEnd) return 'sunset';
  return 'dusk';
}
