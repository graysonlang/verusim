import type { DistanceUnit } from './preferences.js';

export const FEET_PER_METER = 3.280839895;

export function distanceFromMeters(meters: number, unit: DistanceUnit): number {
  return unit === 'feet' ? meters * FEET_PER_METER : meters;
}

export function metersFromDistance(distance: number, unit: DistanceUnit): number {
  return unit === 'feet' ? distance / FEET_PER_METER : distance;
}

export function formatDistance(meters: number, unit: DistanceUnit, fractionDigits = 1): string {
  const value = Number(distanceFromMeters(meters, unit).toFixed(fractionDigits));
  return `${value} ${unit === 'feet' ? 'ft' : 'm'}`;
}

export function formatMovementRate(metersPerMinute: number, unit: DistanceUnit): string {
  const value = Number(distanceFromMeters(metersPerMinute, unit).toFixed(1));
  return `${value} ${unit === 'feet' ? 'ft' : 'm'}/min`;
}

export function formatMovementSpeed(metersPerMinute: number, unit: DistanceUnit): string {
  const value = Number(distanceFromMeters(metersPerMinute / 60, unit).toFixed(2));
  return `${value} ${unit === 'feet' ? 'ft' : 'm'}/s`;
}
