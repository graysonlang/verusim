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
  sunriseMinute: number;
  sunsetMinute: number;
}

const DAYLIGHT_SCHEDULES: Record<Season, DaylightSchedule> = {
  autumn: { sunriseMinute: 390, sunsetMinute: 1065 },
  spring: { sunriseMinute: 360, sunsetMinute: 1110 },
  summer: { sunriseMinute: 315, sunsetMinute: 1245 },
  winter: { sunriseMinute: 450, sunsetMinute: 990 },
};

function minuteOfDay(minute: number): number {
  return ((minute % 1440) + 1440) % 1440;
}

export function daylightScheduleForSeason(season: Season): DaylightSchedule {
  return { ...DAYLIGHT_SCHEDULES[season] };
}

export function dayPeriodAtMinute(minute: number, season: Season): DayPeriod {
  const current = minuteOfDay(minute);
  const { sunriseMinute, sunsetMinute } = DAYLIGHT_SCHEDULES[season];
  const dawnStart = sunriseMinute - 60;
  const sunriseStart = sunriseMinute - 15;
  const sunriseEnd = sunriseMinute + 45;
  const middayStart = 690;
  const afternoonStart = 810;
  const eveningStart = sunsetMinute - 90;
  const sunsetStart = sunsetMinute - 20;
  const sunsetEnd = sunsetMinute + 30;
  const duskEnd = sunsetMinute + 75;

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
