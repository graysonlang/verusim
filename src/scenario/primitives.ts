import type { RecoveryMode } from '../model/types.js';
import { ScenarioValidationError } from '../model/validation.js';

// Validation primitives shared by scenario and snapshot parsing. Both parsers
// used to carry private copies that had drifted apart; one definition keeps
// their error messages, ranges, and identifier rules identical.

const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

export function legacyRecoveryMode(activity: unknown): RecoveryMode {
  if (typeof activity !== 'string') return 'none';
  const normalized = activity.trim().toLowerCase();
  return normalized === 'sleeping' || normalized === 'sleep' ? 'sleep' : 'none';
}

export function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ScenarioValidationError(path, 'expected an object');
  }
  return value as Record<string, unknown>;
}

export function arrayValue(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ScenarioValidationError(path, 'expected an array');
  return value;
}

export function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ScenarioValidationError(path, 'expected a non-empty string');
  }
  return value;
}

export function identifierValue(value: unknown, path: string): string {
  const id = stringValue(value, path);
  if (!IDENTIFIER.test(id)) {
    throw new ScenarioValidationError(path, 'expected a lowercase kebab-case identifier');
  }
  return id;
}

export function numberValue(
  value: unknown,
  path: string,
  minimum = Number.NEGATIVE_INFINITY,
  maximum = Number.POSITIVE_INFINITY,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ScenarioValidationError(path, 'expected a finite number');
  }
  if (value < minimum || value > maximum) {
    throw new ScenarioValidationError(path, `expected a number from ${minimum} through ${maximum}`);
  }
  return value;
}

export function integerValue(
  value: unknown,
  path: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const result = numberValue(value, path, minimum, maximum);
  if (!Number.isInteger(result)) throw new ScenarioValidationError(path, 'expected an integer');
  return result;
}

export function validatePoint(value: unknown, path: string): void {
  const point = objectValue(value, path);
  numberValue(point.x, `${path}.x`);
  numberValue(point.y, `${path}.y`);
}

export function validateLayerPosition(value: unknown, path: string): Record<string, unknown> {
  const point = objectValue(value, path);
  validatePoint(point, path);
  identifierValue(point.layerId, `${path}.layerId`);
  return point;
}

/** Reject authored fields the schema does not define, naming the first unknown key. */
export function knownKeys(
  value: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      throw new ScenarioValidationError(`${path}.${key}`, 'unknown field');
    }
  }
}
