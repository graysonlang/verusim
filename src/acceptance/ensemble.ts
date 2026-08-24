import {
  GenerationSampler,
  type NumericGenerationRange,
  type RealizedGenerationDraw,
  validateGenerationSeed,
} from '../generation/sampler.js';
import type { PreparedScenario, ResourceCatalog, SimulationState } from '../model/types.js';
import { contentDigest } from '../scenario/digest.js';
import { prepareScenario } from '../scenario/prepare.js';
import { serializeSnapshot } from '../scenario/serialize.js';
import { advanceSimulation, createSimulationFromPrepared } from '../simulation/runtime.js';

// The acceptance ensemble is a headless falsifier harness over seeded authored
// variants. A variant is an authored scenario file whose declared dimensions
// were drawn from one explicit sampler, so it is ordinary content that passes
// the ordinary preparation boundary; no randomness reaches the evaluator.
// Grading separates three failure kinds the suite must not conflate: a
// falsifier that fails on an in-envelope variant is a HARD FAIL of the model,
// one that fails only when a dimension was pushed into its extreme band is a
// SOFT FAIL that bounds the envelope, and a falsifier whose evidence never
// materialized is INCONCLUSIVE rather than a verdict either way.

export const ENSEMBLE_ALGORITHM = 'verusim-ensemble-v1' as const;

export type FalsifierGrade = 'PASS' | 'SOFT FAIL' | 'HARD FAIL' | 'INCONCLUSIVE';
export type FalsifierOutcome = 'pass' | 'fail' | 'inconclusive';

export interface FalsifierVerdict {
  detail: string;
  outcome: FalsifierOutcome;
}

export interface EnsembleVariant {
  algorithm: typeof ENSEMBLE_ALGORITHM;
  digest: string;
  draws: readonly RealizedGenerationDraw[];
  extreme: boolean;
  extremeDimensionId: string | null;
  samplerEnd: number;
  samplerStart: number;
  scenario: unknown;
  seed: number;
}

export interface EnsembleRun {
  final: SimulationState;
  initial: SimulationState;
  prepared: PreparedScenario;
  unavailabilityRate: number;
  variant: EnsembleVariant;
}

export interface Falsifier {
  evaluate: (run: EnsembleRun) => FalsifierVerdict;
  id: string;
  /** The shared model term this falsifier implicates when it fails. */
  term: string;
}

export interface EnsembleDimension {
  /** Beyond-envelope band; a variant may push one dimension here to bound the envelope. */
  extreme: NumericGenerationRange | null;
  id: string;
  integer?: boolean;
  nominal: NumericGenerationRange;
  /** Authored scenario path such as `dyads[0].estimatedEmpathy`. */
  path: string;
}

export interface UnavailabilityDimension {
  /** Authored activity label for the independent business. */
  activity: string;
  /** Index of the character placement that leaves for independent business. */
  actorIndex: number;
  locationId: string;
  /** Range of authored start minutes for that business, drawn per variant. */
  startMinute: NumericGenerationRange;
}

export interface UnavailabilityContract {
  /** Seeded authored business that makes a character visibly unavailable during the run. */
  dimension: UnavailabilityDimension | null;
  maximum: number;
  minimum: number;
}

export interface VignetteDefinition {
  catalog: ResourceCatalog;
  dimensions: readonly EnsembleDimension[];
  falsifiers: readonly Falsifier[];
  id: string;
  scenario: unknown;
  ticks: number;
  /** Protected range for the measured share of agent-ticks spent unavailable. */
  unavailability: UnavailabilityContract;
}

export interface FalsifierGradeRecord {
  detail: string;
  falsifierId: string;
  grade: FalsifierGrade;
  term: string;
}

export interface VariantReport {
  digest: string;
  extreme: boolean;
  extremeDimensionId: string | null;
  falsifiers: readonly FalsifierGradeRecord[];
  replayEquivalent: boolean;
  seed: number;
  unavailabilityInRange: boolean;
  unavailabilityRate: number;
}

export interface EnsembleReport {
  distinctVariants: number;
  summary: Record<FalsifierGrade, number>;
  variants: readonly VariantReport[];
  vignetteId: string;
}

export interface EnsembleOptions {
  /** Every nth seed pushes one dimension into its extreme band; 0 disables extremes. */
  extremeEvery?: number;
  seeds?: readonly number[];
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function setPath(root: unknown, path: string, value: number): void {
  const segments = [...path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map(match =>
    match[2] === undefined ? (match[1] as string) : Number(match[2]),
  );
  let cursor: unknown = root;
  for (const [index, segment] of segments.entries()) {
    if (typeof cursor !== 'object' || cursor === null) {
      throw new Error(`Dimension path "${path}" does not resolve in the authored scenario`);
    }
    const container = cursor as Record<string | number, unknown>;
    if (index === segments.length - 1) {
      container[segment] = value;
      return;
    }
    cursor = container[segment];
  }
}

export function materializeVariant(
  vignette: VignetteDefinition,
  seed: number,
  extreme: boolean,
): EnsembleVariant {
  validateGenerationSeed(seed);
  const sampler = new GenerationSampler(seed, 0);
  const samplerStart = sampler.position;
  const scenario = clone(vignette.scenario);
  const extremeCandidates = vignette.dimensions.filter(dimension => dimension.extreme !== null);
  const extremeDimension =
    extreme && extremeCandidates.length > 0
      ? extremeCandidates[
          sampler.integer('extreme-dimension', {
            maximum: extremeCandidates.length - 1,
            minimum: 0,
          }).value
        ]
      : undefined;
  for (const dimension of vignette.dimensions) {
    const range =
      dimension === extremeDimension && dimension.extreme !== null
        ? dimension.extreme
        : dimension.nominal;
    const draw = dimension.integer
      ? sampler.integer(dimension.id, range)
      : sampler.number(dimension.id, range);
    setPath(scenario, dimension.path, draw.value);
  }
  const business = vignette.unavailability.dimension;
  if (business !== null) {
    const start = sampler.integer('unavailability-start', business.startMinute);
    const placements = (scenario as { characters?: { schedule?: unknown[] }[] }).characters ?? [];
    const placement = placements[business.actorIndex];
    if (placement === undefined || !Array.isArray(placement.schedule)) {
      throw new Error(`Unavailability actor index ${business.actorIndex} does not resolve`);
    }
    placement.schedule.push({
      activity: business.activity,
      locationId: business.locationId,
      maskingDemand: null,
      recoveryMode: 'none',
      resourceDrainsPerHour: {},
      startMinute: start.value,
    });
  }
  return {
    algorithm: ENSEMBLE_ALGORITHM,
    digest: contentDigest(scenario),
    draws: sampler.draws,
    extreme: extremeDimension !== undefined,
    extremeDimensionId: extremeDimension?.id ?? null,
    samplerEnd: sampler.position,
    samplerStart,
    scenario,
    seed,
  };
}

// An agent is unavailable to the scene while in transit, engaged in an outlet
// or intention, or away from the location its authored schedule opened at -
// independent business elsewhere counts even though the agent is idle there.
function unavailableAgents(
  state: SimulationState,
  homeLocations: ReadonlyMap<string, string | null>,
): number {
  return state.agents.filter(
    agent =>
      agent.currentLocationId === null ||
      agent.currentOutlet !== null ||
      agent.currentLocationId !== homeLocations.get(agent.id) ||
      state.intentions.some(intention => intention.actorId === agent.id),
  ).length;
}

export function runVariant(vignette: VignetteDefinition, variant: EnsembleVariant): EnsembleRun {
  const prepared = prepareScenario({ catalog: vignette.catalog, scenario: variant.scenario });
  const initial = createSimulationFromPrepared(prepared);
  const homeLocations = new Map(
    initial.agents.map(agent => [
      agent.id,
      agent.schedule[0]?.locationId ?? agent.currentLocationId,
    ]),
  );
  let state = initial;
  let unavailable = 0;
  for (let tick = 0; tick < vignette.ticks; tick += 1) {
    state = advanceSimulation(state, 1);
    unavailable += unavailableAgents(state, homeLocations);
  }
  const agentTicks = Math.max(1, initial.agents.length * vignette.ticks);
  return { final: state, initial, prepared, unavailabilityRate: unavailable / agentTicks, variant };
}

export function gradeOutcome(outcome: FalsifierOutcome, extreme: boolean): FalsifierGrade {
  if (outcome === 'pass') return 'PASS';
  if (outcome === 'inconclusive') return 'INCONCLUSIVE';
  return extreme ? 'SOFT FAIL' : 'HARD FAIL';
}

export function runEnsemble(
  vignette: VignetteDefinition,
  options: EnsembleOptions = {},
): EnsembleReport {
  const seeds = options.seeds ?? Array.from({ length: 25 }, (_, index) => index);
  const extremeEvery = options.extremeEvery ?? 5;
  const summary: Record<FalsifierGrade, number> = {
    'HARD FAIL': 0,
    INCONCLUSIVE: 0,
    PASS: 0,
    'SOFT FAIL': 0,
  };
  const variants = seeds.map((seed, index) => {
    const extreme = extremeEvery > 0 && (index + 1) % extremeEvery === 0;
    const variant = materializeVariant(vignette, seed, extreme);
    const run = runVariant(vignette, variant);
    const replay = advanceSimulation(createSimulationFromPrepared(run.prepared), vignette.ticks);
    const replayEquivalent =
      JSON.stringify(serializeSnapshot(replay)) === JSON.stringify(serializeSnapshot(run.final));
    const falsifiers = vignette.falsifiers.map(falsifier => {
      const verdict = falsifier.evaluate(run);
      const grade = gradeOutcome(verdict.outcome, variant.extreme);
      summary[grade] += 1;
      return { detail: verdict.detail, falsifierId: falsifier.id, grade, term: falsifier.term };
    });
    return {
      digest: variant.digest,
      extreme: variant.extreme,
      extremeDimensionId: variant.extremeDimensionId,
      falsifiers,
      replayEquivalent,
      seed,
      unavailabilityInRange:
        run.unavailabilityRate >= vignette.unavailability.minimum &&
        run.unavailabilityRate <= vignette.unavailability.maximum,
      unavailabilityRate: run.unavailabilityRate,
    };
  });
  return {
    distinctVariants: new Set(variants.map(variant => variant.digest)).size,
    summary,
    variants,
    vignetteId: vignette.id,
  };
}
