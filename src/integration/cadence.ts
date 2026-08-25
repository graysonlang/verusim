import type { PreparedScenario, SimulationSnapshotFile, SimulationState } from '../model/types.js';
import { createSimulationFromSnapshot } from '../scenario/load.js';
import { serializeSnapshot } from '../scenario/serialize.js';
import { parseSnapshot } from '../scenario/snapshot.js';
import { advanceSimulation } from '../simulation/runtime.js';

export const CADENCE_TIERS = ['adjacent', 'location', 'settlement', 'on-demand'] as const;

export type CadenceTier = (typeof CADENCE_TIERS)[number];

export interface CadencePolicy {
  adjacent: number;
  location: number;
  'on-demand': null;
  settlement: number;
}

export const DEFAULT_CADENCE_POLICY: CadencePolicy = Object.freeze({
  adjacent: 1,
  location: 5,
  'on-demand': null,
  settlement: 30,
});

export interface CadenceSession {
  pendingTicks: number;
  policy: CadencePolicy;
  state: SimulationState;
  tier: CadenceTier;
}

export interface CadenceSaveFile {
  pendingTicks: number;
  policy: CadencePolicy;
  schemaVersion: 1;
  snapshot: SimulationSnapshotFile;
  tier: CadenceTier;
  type: 'verusim-cadence-save';
}

interface PreparedCadenceResumeInput {
  prepared: PreparedScenario;
  save: unknown;
}

interface LibraryCadenceResumeInput {
  characterLibrary: unknown;
  environmentLibrary: unknown;
  save: unknown;
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function validateTicks(ticks: number, label: string): void {
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
}

function validateInterval(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new RangeError(`${path} must be a positive integer`);
  }
  return value;
}

function parseCadencePolicy(value: unknown, path: string): CadencePolicy {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RangeError(`${path} must be an object`);
  }
  const policy = value as Record<string, unknown>;
  if (policy['on-demand'] !== null) {
    throw new RangeError(`${path}.on-demand must be null`);
  }
  return {
    adjacent: validateInterval(policy.adjacent, `${path}.adjacent`),
    location: validateInterval(policy.location, `${path}.location`),
    'on-demand': null,
    settlement: validateInterval(policy.settlement, `${path}.settlement`),
  };
}

function cadenceTier(value: unknown, path: string): CadenceTier {
  if (typeof value !== 'string' || !(CADENCE_TIERS as readonly string[]).includes(value)) {
    throw new RangeError(`${path} must be a known cadence tier`);
  }
  return value as CadenceTier;
}

export function createCadenceSession(
  state: SimulationState,
  tier: CadenceTier = 'adjacent',
  policy: CadencePolicy = DEFAULT_CADENCE_POLICY,
): CadenceSession {
  return {
    pendingTicks: 0,
    policy: parseCadencePolicy(policy, 'cadence.policy'),
    state,
    tier: cadenceTier(tier, 'cadence.tier'),
  };
}

export function scheduleCadence(session: CadenceSession, ticks: number): CadenceSession {
  validateTicks(ticks, 'cadence ticks');
  const pendingTicks = session.pendingTicks + ticks;
  const interval = session.policy[session.tier];
  if (interval === null) return { ...session, pendingTicks };
  const dueTicks = pendingTicks - (pendingTicks % interval);
  if (dueTicks === 0) return { ...session, pendingTicks };
  return {
    ...session,
    pendingTicks: pendingTicks - dueTicks,
    state: advanceSimulation(session.state, dueTicks),
  };
}

export function flushCadence(session: CadenceSession): CadenceSession {
  if (session.pendingTicks === 0) return session;
  return {
    ...session,
    pendingTicks: 0,
    state: advanceSimulation(session.state, session.pendingTicks),
  };
}

export function retierCadence(session: CadenceSession, tier: CadenceTier): CadenceSession {
  return { ...flushCadence(session), tier };
}

export function cadenceLogicalTick(session: CadenceSession): number {
  return session.state.tick + session.pendingTicks;
}

export function catchUpConstantRate(
  value: number,
  ratePerSecond: number,
  elapsedSeconds: number,
  minimum: number,
  maximum: number,
): number {
  for (const [candidate, label] of [
    [value, 'value'],
    [ratePerSecond, 'ratePerSecond'],
    [elapsedSeconds, 'elapsedSeconds'],
    [minimum, 'minimum'],
    [maximum, 'maximum'],
  ] as const) {
    if (!Number.isFinite(candidate)) throw new RangeError(`${label} must be finite`);
  }
  if (elapsedSeconds < 0) throw new RangeError('elapsedSeconds must not be negative');
  if (maximum < minimum) throw new RangeError('maximum must not be below minimum');
  return Math.min(maximum, Math.max(minimum, value + ratePerSecond * elapsedSeconds));
}

export function serializeCadenceSave(session: CadenceSession): CadenceSaveFile {
  return clone({
    pendingTicks: session.pendingTicks,
    policy: session.policy,
    schemaVersion: 1,
    snapshot: serializeSnapshot(session.state),
    tier: session.tier,
    type: 'verusim-cadence-save',
  });
}

export function parseCadenceSave(value: unknown): CadenceSaveFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RangeError('cadence save must be an object');
  }
  const file = value as Record<string, unknown>;
  if (file.type !== 'verusim-cadence-save') {
    throw new RangeError('cadence save type must be verusim-cadence-save');
  }
  if (file.schemaVersion !== 1) throw new RangeError('cadence save schema version is unsupported');
  const pendingTicks = file.pendingTicks;
  if (typeof pendingTicks !== 'number')
    throw new RangeError('cadence save pendingTicks is required');
  validateTicks(pendingTicks, 'cadence save pendingTicks');
  return clone({
    pendingTicks,
    policy: parseCadencePolicy(file.policy, 'cadence save policy'),
    schemaVersion: 1,
    snapshot: parseSnapshot(file.snapshot),
    tier: cadenceTier(file.tier, 'cadence save tier'),
    type: 'verusim-cadence-save',
  });
}

export function resumeCadenceSave(
  input: PreparedCadenceResumeInput | LibraryCadenceResumeInput,
): CadenceSession {
  const save = parseCadenceSave(input.save);
  const state =
    'prepared' in input
      ? createSimulationFromSnapshot({ prepared: input.prepared, snapshot: save.snapshot })
      : createSimulationFromSnapshot({
          characterLibrary: input.characterLibrary,
          environmentLibrary: input.environmentLibrary,
          snapshot: save.snapshot,
        });
  return {
    pendingTicks: save.pendingTicks,
    policy: save.policy,
    state,
    tier: save.tier,
  };
}
