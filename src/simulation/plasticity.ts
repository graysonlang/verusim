import { appendBounded, clamp } from '../model/retention.js';
import type {
  BaselinePlasticityAccumulator,
  BaselinePlasticityMechanism,
  BaselinePlasticityRecord,
  BaselinePlasticityTarget,
  CascadePosition,
  IdentityMarker,
  SimulationAgent,
} from '../model/types.js';
import { effectiveCascadePrior, effectiveIdentity } from './history.js';

export const BASELINE_PLASTICITY_YEAR_MINUTES = 365 * 24 * 60;
export const ADULT_BASELINE_CHANGE_CAP_PER_YEAR = 0.005;

const LARGE_GAP_THRESHOLD = 0.65;
const CHILD_GATE_YEARS = 0.5;
const ADULT_GATE_YEARS = 5;
const CHILD_CHANGE_RATE_PER_YEAR = 0.12;
const CONFIRMATION_STIFFENING_PER_YEAR = 0.25;
const CHANGE_QUANTUM = 0.01;
const MAX_PLASTICITY_RECORDS = 64;
const CASCADE_TARGETS = new Set(['freeze', 'fight', 'flight', 'fawn', 'flop']);

export interface BaselinePlasticitySignal {
  gap: number;
  mechanism: BaselinePlasticityMechanism;
  source: string;
  strength: number;
  target: BaselinePlasticityTarget;
}

export interface BaselinePlasticityAdvance {
  elapsedMinutes: number;
  minute: number;
  originMinute?: number;
  signals: readonly BaselinePlasticitySignal[];
}

function round(value: number): number {
  return Math.round(value * 1e12) / 1e12;
}

function plasticityMultiplierForAge(ageYears: number): number {
  if (ageYears <= 12) return 1;
  const adultMaximum = ADULT_BASELINE_CHANGE_CAP_PER_YEAR / CHILD_CHANGE_RATE_PER_YEAR;
  if (ageYears < 18) {
    const adolescentProgress = (ageYears - 12) / 6;
    return 1 + (adultMaximum - 1) * adolescentProgress;
  }
  if (ageYears < 60) {
    const adultProgress = (ageYears - 18) / 42;
    return adultMaximum + (0.005 - adultMaximum) * adultProgress;
  }
  return 0.005;
}

export function baselinePlasticityRateForAge(ageYears: number): number {
  const rate = CHILD_CHANGE_RATE_PER_YEAR * plasticityMultiplierForAge(ageYears);
  return ageYears < 18 ? rate : Math.min(rate, ADULT_BASELINE_CHANGE_CAP_PER_YEAR);
}

function accumulatorKey(
  mechanism: BaselinePlasticityMechanism,
  target: BaselinePlasticityTarget,
): string {
  return `${mechanism}:${target.kind}:${target.id}`;
}

function validateSignal(signal: BaselinePlasticitySignal, path: string): void {
  if (!Number.isFinite(signal.gap) || signal.gap < 0 || signal.gap > 1) {
    throw new RangeError(`${path}.gap must be between 0 and 1`);
  }
  if (!Number.isFinite(signal.strength) || signal.strength < 0 || signal.strength > 1) {
    throw new RangeError(`${path}.strength must be between 0 and 1`);
  }
  if (signal.source.length === 0) throw new RangeError(`${path}.source must not be empty`);
  const expectsCascade = signal.mechanism === 'rupture-crystallization';
  if (expectsCascade !== (signal.target.kind === 'cascade-prior')) {
    throw new RangeError(`${path}.target is incompatible with ${signal.mechanism}`);
  }
  if (signal.target.id.length === 0) throw new RangeError(`${path}.target.id must not be empty`);
  if (signal.target.kind === 'cascade-prior' && !CASCADE_TARGETS.has(signal.target.id)) {
    throw new RangeError(`${path}.target.id must be a cascade position`);
  }
}

function previousTargetValue(agent: SimulationAgent, target: BaselinePlasticityTarget): number {
  if (target.kind === 'cascade-prior') {
    return effectiveCascadePrior(agent, target.id as Exclude<CascadePosition, 'none'>);
  }
  return effectiveIdentity(agent).find(marker => marker.marker === target.id)?.centrality ?? 0;
}

function updateIdentity(
  identity: readonly IdentityMarker[],
  marker: string,
  centrality: number,
): IdentityMarker[] {
  const index = identity.findIndex(candidate => candidate.marker === marker);
  if (index < 0) return [...identity, { centrality, marker }];
  return identity.map((candidate, candidateIndex) =>
    candidateIndex === index ? { centrality, marker } : candidate,
  );
}

function applyTargetChange(
  agent: SimulationAgent,
  target: BaselinePlasticityTarget,
  change: number,
): { agent: SimulationAgent; previous: number; resulting: number } {
  const previous = previousTargetValue(agent, target);
  const resulting = round(clamp(previous + change, 0, 1));
  if (target.kind === 'cascade-prior') {
    const position = target.id as Exclude<CascadePosition, 'none'>;
    return {
      agent: {
        ...agent,
        history: {
          ...agent.history,
          overrides: {
            ...agent.history.overrides,
            cascadePriors: {
              ...agent.history.overrides.cascadePriors,
              [position]: resulting,
            },
          },
        },
      },
      previous,
      resulting,
    };
  }
  return {
    agent: {
      ...agent,
      history: {
        ...agent.history,
        overrides: {
          ...agent.history.overrides,
          identity: updateIdentity(effectiveIdentity(agent), target.id, resulting),
        },
      },
    },
    previous,
    resulting,
  };
}

function replaceAccumulator(
  accumulators: readonly BaselinePlasticityAccumulator[],
  accumulator: BaselinePlasticityAccumulator,
): BaselinePlasticityAccumulator[] {
  const next = accumulators.filter(candidate => candidate.key !== accumulator.key);
  next.push(accumulator);
  return next.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
}

function advanceSignal(
  agent: SimulationAgent,
  input: BaselinePlasticityAdvance,
  signal: BaselinePlasticitySignal,
): SimulationAgent {
  if (signal.gap < LARGE_GAP_THRESHOLD || signal.strength === 0 || input.elapsedMinutes === 0) {
    return agent;
  }
  const key = accumulatorKey(signal.mechanism, signal.target);
  const existing = agent.history.plasticity.accumulators.find(candidate => candidate.key === key);
  const previousIntegratedYears = existing?.integratedYears ?? 0;
  const elapsedYears = input.elapsedMinutes / BASELINE_PLASTICITY_YEAR_MINUTES;
  const integratedYears = round(previousIntegratedYears + elapsedYears * signal.strength);
  const startAgeYears =
    agent.profile.physical.ageYears +
    (input.minute - input.elapsedMinutes - (input.originMinute ?? 0)) /
      BASELINE_PLASTICITY_YEAR_MINUTES;
  const endAgeYears =
    agent.profile.physical.ageYears +
    (input.minute - (input.originMinute ?? 0)) / BASELINE_PLASTICITY_YEAR_MINUTES;
  const gateYears = startAgeYears < 18 ? CHILD_GATE_YEARS : ADULT_GATE_YEARS;
  const previousEligibleYears = Math.max(0, previousIntegratedYears - gateYears);
  const eligibleYears = Math.max(0, integratedYears - gateYears);
  const plasticityYears =
    (Math.log1p(CONFIRMATION_STIFFENING_PER_YEAR * eligibleYears) -
      Math.log1p(CONFIRMATION_STIFFENING_PER_YEAR * previousEligibleYears)) /
    CONFIRMATION_STIFFENING_PER_YEAR;
  const ageYears = (startAgeYears + endAgeYears) / 2;
  const earnedChange = round(
    (existing?.earnedChange ?? 0) +
      plasticityYears * baselinePlasticityRateForAge(ageYears) * signal.gap,
  );
  const appliedChange = existing?.appliedChange ?? 0;
  const availableChange = Math.max(0, earnedChange - appliedChange);
  const quantizedChange =
    Math.floor((availableChange + Number.EPSILON) / CHANGE_QUANTUM) * CHANGE_QUANTUM;
  let next = agent;
  let nextAppliedChange = appliedChange;
  let record: BaselinePlasticityRecord | null = null;
  if (quantizedChange > 0) {
    const applied = applyTargetChange(agent, signal.target, quantizedChange);
    const actualChange = round(applied.resulting - applied.previous);
    next = applied.agent;
    nextAppliedChange =
      applied.resulting === 1 ? earnedChange : round(appliedChange + actualChange);
    if (actualChange > 0) {
      record = {
        ageYears: round(endAgeYears),
        appliedChange: actualChange,
        integratedYears,
        mechanism: signal.mechanism,
        minute: input.minute,
        previous: applied.previous,
        resulting: applied.resulting,
        source: signal.source,
        target: { ...signal.target },
      };
    }
  }
  const accumulator: BaselinePlasticityAccumulator = {
    appliedChange: nextAppliedChange,
    earnedChange,
    integratedYears,
    key,
    mechanism: signal.mechanism,
    target: { ...signal.target },
  };
  return {
    ...next,
    history: {
      ...next.history,
      plasticity: {
        accumulators: replaceAccumulator(next.history.plasticity.accumulators, accumulator),
        records:
          record === null
            ? next.history.plasticity.records
            : appendBounded(next.history.plasticity.records, record, MAX_PLASTICITY_RECORDS),
      },
    },
  };
}

export function advanceBaselinePlasticity(
  agent: SimulationAgent,
  input: BaselinePlasticityAdvance,
): SimulationAgent {
  if (!Number.isFinite(input.elapsedMinutes) || input.elapsedMinutes < 0) {
    throw new RangeError('elapsedMinutes must be a non-negative finite number');
  }
  if (!Number.isFinite(input.minute) || input.minute < input.elapsedMinutes) {
    throw new RangeError('minute must be finite and at least elapsedMinutes');
  }
  if (
    !Number.isFinite(input.originMinute ?? 0) ||
    (input.originMinute ?? 0) > input.minute - input.elapsedMinutes
  ) {
    throw new RangeError('originMinute must be finite and no later than the interval start');
  }
  let next = agent;
  input.signals.forEach((signal, index) => {
    validateSignal(signal, `signals[${index}]`);
    next = advanceSignal(next, input, signal);
  });
  return next;
}
