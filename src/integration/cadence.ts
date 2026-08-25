import type { PreparedScenario, SimulationSnapshotFile, SimulationState } from '../model/types.js';
import { createSimulationFromSnapshot } from '../scenario/load.js';
import { serializeSnapshot } from '../scenario/serialize.js';
import { parseSnapshot } from '../scenario/snapshot.js';
import { advanceTo } from '../simulation/runtime.js';

export const CADENCE_TIERS = ['adjacent', 'location', 'settlement', 'on-demand'] as const;

export type CadenceTier = (typeof CADENCE_TIERS)[number];

/** Batching intervals in logical seconds; on-demand retains all pending work until a flush. */
export interface CadencePolicy {
  adjacent: number;
  location: number;
  'on-demand': null;
  settlement: number;
}

export const DEFAULT_CADENCE_POLICY: CadencePolicy = Object.freeze({
  adjacent: 60,
  location: 300,
  'on-demand': null,
  settlement: 1800,
});

export interface CadenceSession {
  pendingSeconds: number;
  policy: CadencePolicy;
  state: SimulationState;
  tier: CadenceTier;
}

export interface CadenceSaveFile {
  pendingSeconds: number;
  policy: CadencePolicy;
  schemaVersion: 2;
  snapshot: SimulationSnapshotFile;
  tier: CadenceTier;
  type: 'verusim-cadence-save';
}

/** Host inputs that select a schedule: how fast logical time runs and how closely the chunk is watched. */
export interface CadenceHostPolicy {
  /** Real seconds the host is willing to let logical time run ahead between authoritative commits. */
  batchRealSeconds?: number;
  /** Logical seconds per real second. */
  playbackRate: number;
  /** Base intervals per tier, before rate scaling. */
  policy?: CadencePolicy;
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

function validateSeconds(seconds: number, label: string): void {
  if (!Number.isInteger(seconds) || seconds < 0) {
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
    pendingSeconds: 0,
    policy: parseCadencePolicy(policy, 'cadence.policy'),
    state,
    tier: cadenceTier(tier, 'cadence.tier'),
  };
}

/**
 * Add logical seconds to the chunk and commit every whole interval that is now due.
 * Committed work runs through `advanceTo`, which resolves every boundary inside the
 * interval at its exact second, so batching never skips or reorders an event.
 */
export function scheduleCadence(session: CadenceSession, seconds: number): CadenceSession {
  validateSeconds(seconds, 'cadence seconds');
  const pendingSeconds = session.pendingSeconds + seconds;
  const interval = session.policy[session.tier];
  if (interval === null) return { ...session, pendingSeconds };
  const dueSeconds = pendingSeconds - (pendingSeconds % interval);
  if (dueSeconds === 0) return { ...session, pendingSeconds };
  return {
    ...session,
    pendingSeconds: pendingSeconds - dueSeconds,
    state: advanceTo(session.state, session.state.second + dueSeconds),
  };
}

/** Commit all pending logical time so the state is authoritative at the logical second. */
export function flushCadence(session: CadenceSession): CadenceSession {
  if (session.pendingSeconds === 0) return session;
  return {
    ...session,
    pendingSeconds: 0,
    state: advanceTo(session.state, session.state.second + session.pendingSeconds),
  };
}

/** Change tier; pending work is committed first so the schedule change cannot move an event. */
export function retierCadence(session: CadenceSession, tier: CadenceTier): CadenceSession {
  return { ...flushCadence(session), tier: cadenceTier(tier, 'cadence.tier') };
}

/**
 * Apply discrete input at the chunk's logical second.
 * Input is an immediate barrier: pending work is committed up to the logical
 * second before the input mutates authoritative state, so a batched schedule
 * observes the input at exactly the same second as a real-time one.
 */
export function applyCadenceInput(
  session: CadenceSession,
  input: (state: SimulationState) => SimulationState,
): CadenceSession {
  const flushed = flushCadence(session);
  return { ...flushed, state: input(flushed.state) };
}

/** The logical second the chunk has been scheduled to, including uncommitted work. */
export function cadenceLogicalSecond(session: CadenceSession): number {
  return session.state.second + session.pendingSeconds;
}

/**
 * Derive a policy for a host running logical time at `playbackRate`.
 * Each batched interval grows to cover at least `batchRealSeconds` of real time at
 * that rate, so a faster rate commits coarser batches with the same exact result.
 * Real-time and slower rates keep the base intervals.
 */
export function cadencePolicyForRate(host: CadenceHostPolicy): CadencePolicy {
  const base = parseCadencePolicy(host.policy ?? DEFAULT_CADENCE_POLICY, 'cadence.policy');
  const batchRealSeconds = host.batchRealSeconds ?? 1;
  if (!Number.isFinite(host.playbackRate) || host.playbackRate <= 0) {
    throw new RangeError('playbackRate must be a positive finite number');
  }
  if (!Number.isFinite(batchRealSeconds) || batchRealSeconds <= 0) {
    throw new RangeError('batchRealSeconds must be a positive finite number');
  }
  const floor = Math.max(1, Math.ceil(host.playbackRate * batchRealSeconds));
  return {
    adjacent: Math.max(base.adjacent, floor),
    location: Math.max(base.location, floor),
    'on-demand': null,
    settlement: Math.max(base.settlement, floor),
  };
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
    pendingSeconds: session.pendingSeconds,
    policy: session.policy,
    schemaVersion: 2,
    snapshot: serializeSnapshot(session.state),
    tier: session.tier,
    type: 'verusim-cadence-save',
  });
}

function scaleLegacyPolicy(policy: CadencePolicy, tickSeconds: number): CadencePolicy {
  return {
    adjacent: policy.adjacent * tickSeconds,
    location: policy.location * tickSeconds,
    'on-demand': null,
    settlement: policy.settlement * tickSeconds,
  };
}

export function parseCadenceSave(value: unknown): CadenceSaveFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RangeError('cadence save must be an object');
  }
  const file = value as Record<string, unknown>;
  if (file.type !== 'verusim-cadence-save') {
    throw new RangeError('cadence save type must be verusim-cadence-save');
  }
  if (file.schemaVersion !== 1 && file.schemaVersion !== 2) {
    throw new RangeError('cadence save schema version is unsupported');
  }
  const snapshot = parseSnapshot(file.snapshot);
  const policy = parseCadencePolicy(file.policy, 'cadence save policy');
  if (file.schemaVersion === 1) {
    // Version 1 counted pending whole ticks and expressed intervals in ticks.
    const pendingTicks = file.pendingTicks;
    if (typeof pendingTicks !== 'number') {
      throw new RangeError('cadence save pendingTicks is required');
    }
    validateSeconds(pendingTicks, 'cadence save pendingTicks');
    const tickSeconds = snapshot.scenario.tickSeconds;
    return clone({
      pendingSeconds: pendingTicks * tickSeconds,
      policy: scaleLegacyPolicy(policy, tickSeconds),
      schemaVersion: 2,
      snapshot,
      tier: cadenceTier(file.tier, 'cadence save tier'),
      type: 'verusim-cadence-save',
    });
  }
  const pendingSeconds = file.pendingSeconds;
  if (typeof pendingSeconds !== 'number') {
    throw new RangeError('cadence save pendingSeconds is required');
  }
  validateSeconds(pendingSeconds, 'cadence save pendingSeconds');
  return clone({
    pendingSeconds,
    policy,
    schemaVersion: 2,
    snapshot,
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
    pendingSeconds: save.pendingSeconds,
    policy: save.policy,
    state,
    tier: save.tier,
  };
}
