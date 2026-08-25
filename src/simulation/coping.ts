import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '../model/time.js';
import {
  appendBounded,
  clamp,
  memoryWindow,
  recordWindows,
  retainCharacterRecord,
} from '../model/retention.js';
import {
  VALUE_IDS,
  type AppraisalEvent,
  type AppraisalRecord,
  type CascadePosition,
  type EnvironmentDefinition,
  type OutletAffordance,
  type OutletSelection,
  type OutletUseState,
  type RuntimeMemory,
  type CharacterInstance,
  type SimulationState,
  type TraceEntryInput,
  type ValueId,
  type ValueMap,
} from '../model/types.js';
import {
  effectiveCascadePrior,
  effectiveOutletPreferences,
  effectiveSatisfierPreferences,
  effectiveValueWeight,
} from './history.js';
import { appendTrace, traceTerm } from './trace.js';
import { applyValueTurns, reactiveValueTurns } from './value-turn.js';

const CASCADE_DEPTH: Record<CascadePosition, number> = {
  fawn: 3,
  fight: 2,
  flight: 2,
  flop: 4,
  freeze: 1,
  none: 0,
};

function agentFor(state: SimulationState, instanceId: string): CharacterInstance {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown appraisal agent "${instanceId}"`);
  return agent;
}

export function allostaticLoadFor(agent: CharacterInstance): number {
  const pressure = VALUE_IDS.reduce(
    (total, valueId) =>
      total + Math.max(0, -agent.values[valueId].charge) + agent.values[valueId].deficitIntegral,
    0,
  );
  return clamp(pressure / VALUE_IDS.length, 0, 1);
}

function mobilizedPosition(agent: CharacterInstance, event: AppraisalEvent): CascadePosition {
  if (event.believedLeverage && event.exitAvailable) {
    return effectiveCascadePrior(agent, 'fight') >= effectiveCascadePrior(agent, 'flight')
      ? 'fight'
      : 'flight';
  }
  if (event.believedLeverage) return 'fight';
  if (event.exitAvailable) return 'flight';
  return 'freeze';
}

function targetCascade(
  agent: CharacterInstance,
  event: AppraisalEvent,
  cascadeLoad: number,
  effectiveCoping: number,
): CascadePosition {
  if (cascadeLoad < agent.profile.constitution.threshold) return 'none';
  if (!event.localized) return 'freeze';
  if (effectiveCoping >= 0.55) return mobilizedPosition(agent, event);
  if (effectiveCoping >= 0.2 && event.socialTargetId !== null) return 'fawn';
  if (event.exitAvailable) return 'flight';
  return 'flop';
}

function dwellSeconds(agent: CharacterInstance): number {
  return (
    Math.max(5, Math.ceil(12 * (1 - agent.profile.constitution.recoveryRate))) * SECONDS_PER_MINUTE
  );
}

function applyCascadeTarget(
  state: SimulationState,
  agent: CharacterInstance,
  target: CascadePosition,
  load: number,
  targetId: string | null,
): CharacterInstance {
  const descending = CASCADE_DEPTH[target] > CASCADE_DEPTH[agent.cascade];
  const mayRecover =
    state.second >= agent.cascadeDwellUntilSecond &&
    load < agent.profile.constitution.threshold * 0.75;
  const cascade = descending || agent.cascade === 'none' || mayRecover ? target : agent.cascade;
  const changed = cascade !== agent.cascade;
  return {
    ...agent,
    cascade,
    cascadeDwellUntilSecond: changed
      ? state.second + dwellSeconds(agent)
      : agent.cascadeDwellUntilSecond,
    cascadeLoad: descending ? Math.max(agent.cascadeLoad, load) : load,
    cascadeTargetId: cascade === 'fawn' ? targetId : null,
  };
}

function negativeTurnIntensity(turns: Partial<ValueMap<number>>): number {
  return clamp(
    VALUE_IDS.reduce((total, valueId) => total + Math.max(0, -(turns[valueId] ?? 0)), 0) /
      VALUE_IDS.length,
    0,
    1,
  );
}

export function resolveAppraisalEvent(
  state: SimulationState,
  event: AppraisalEvent,
): SimulationState {
  const agent = agentFor(state, event.instanceId);
  const appliedTurns = reactiveValueTurns(agent, event.turns);
  const values = applyValueTurns(agent.values, appliedTurns);
  const turned = { ...agent, values };
  const allostaticLoad = allostaticLoadFor(turned);
  const effectiveCoping = clamp(
    event.copingPotential -
      allostaticLoad * 0.35 -
      (1 - turned.resources.regulationReserve) * 0.2 -
      turned.somatic.impairment * 0.5,
    0,
    1,
  );
  const cascadeLoad = clamp(
    event.threat * (0.5 + turned.profile.constitution.reactivity * 0.5) +
      allostaticLoad * 0.4 +
      negativeTurnIntensity(appliedTurns) * 0.25 +
      turned.somatic.threatContribution * 0.5,
    0,
    1.5,
  );
  const target = targetCascade(turned, event, cascadeLoad, effectiveCoping);
  const updated = applyCascadeTarget(state, turned, target, cascadeLoad, event.socialTargetId);
  const record: AppraisalRecord = {
    instanceId: event.instanceId,
    appliedTurns,
    cascadeLoad,
    copingPotential: event.copingPotential,
    effectiveCoping,
    eventId: event.id,
    id: `${state.tick}:${event.id}`,
    second: state.second,
    nextCascade: updated.cascade,
    previousCascade: agent.cascade,
    socialTargetId: updated.cascadeTargetId,
    somaticImpairment: turned.somatic.impairment,
    somaticThreatContribution: turned.somatic.threatContribution,
    tick: state.tick,
  };
  const memory: RuntimeMemory = {
    emotionalTurn: -cascadeLoad,
    id: `${state.tick}:${event.id}:appraisal`,
    second: state.second,
    subjectId: event.socialTargetId ?? undefined,
    summary: event.summary,
    type: 'aftermath',
  };
  let trace = appendTrace(state.trace, {
    instanceId: agent.id,
    id: `${state.tick}:${event.id}:appraisal`,
    kind: 'appraisal',
    second: state.second,
    selection: null,
    summary: `${agent.profile.name} appraised ${event.summary.toLowerCase()}`,
    terms: [
      traceTerm('event', event.id, `scenario.appraisalEvents.${event.id}`),
      traceTerm('threat', event.threat, `scenario.appraisalEvents.${event.id}.threat`),
      traceTerm(
        'coping-potential',
        event.copingPotential,
        `scenario.appraisalEvents.${event.id}.copingPotential`,
      ),
      traceTerm('allostatic-load', allostaticLoad, `characters.${agent.id}.values`),
      traceTerm(
        'somatic-impairment',
        turned.somatic.impairment,
        `characters.${agent.id}.somatic.impairment`,
      ),
      traceTerm(
        'somatic-threat',
        turned.somatic.threatContribution,
        `characters.${agent.id}.somatic.threatContribution`,
      ),
      traceTerm('effective-coping', effectiveCoping, `appraisalRecords.${record.id}`),
      ...VALUE_IDS.flatMap(valueId =>
        appliedTurns[valueId] === undefined
          ? []
          : [
              traceTerm(
                `turn:${valueId}`,
                appliedTurns[valueId] ?? 0,
                `scenario.appraisalEvents.${event.id}.turns.${valueId}`,
                `characters.${agent.profile.profileId}.constitution.reactivity`,
              ),
            ],
      ),
    ],
    tick: state.tick,
  });
  trace = appendTrace(trace, {
    instanceId: agent.id,
    id: `${state.tick}:${event.id}:cascade`,
    kind: 'cascade',
    second: state.second,
    selection: null,
    summary: `${agent.profile.name} entered ${updated.cascade}`,
    terms: [
      traceTerm('previous-cascade', agent.cascade, `characters.${agent.id}.cascade`),
      traceTerm('cascade-load', cascadeLoad, `appraisalRecords.${record.id}.cascadeLoad`),
      traceTerm(
        'threshold',
        agent.profile.constitution.threshold,
        `characters.${agent.profile.profileId}.constitution.threshold`,
      ),
      traceTerm('next-cascade', updated.cascade, `characters.${agent.id}.cascade`),
      traceTerm(
        'target',
        updated.cascadeTargetId,
        `scenario.appraisalEvents.${event.id}.socialTargetId`,
      ),
      traceTerm(
        'dwell-until',
        updated.cascadeDwellUntilSecond,
        `characters.${agent.id}.cascadeDwellUntilSecond`,
      ),
    ],
    tick: state.tick,
  });
  return {
    ...state,
    characters: state.characters.map(candidate =>
      candidate.id === agent.id
        ? {
            ...updated,
            memories: appendBounded(updated.memories, memory, memoryWindow(updated.tier)),
          }
        : candidate,
    ),
    appraisalRecords: retainCharacterRecord(
      state.appraisalRecords,
      record,
      record => record.instanceId,
      recordWindows(state.characters),
    ),
    resolvedAppraisalEventIds: [...state.resolvedAppraisalEventIds, event.id],
    trace,
  };
}

function shallowerCascade(agent: CharacterInstance): CascadePosition {
  if (agent.cascade === 'flop') return 'fawn';
  if (agent.cascade === 'fawn') return 'freeze';
  if (agent.cascade === 'fight' || agent.cascade === 'flight') return 'freeze';
  if (agent.cascade === 'freeze') return 'none';
  return 'none';
}

function dominantDeficit(agent: CharacterInstance): { pressure: number; valueId: ValueId } {
  let valueId: ValueId = VALUE_IDS[0];
  let pressure = Number.NEGATIVE_INFINITY;
  for (const candidate of VALUE_IDS) {
    const candidatePressure =
      agent.values[candidate].deficitIntegral * effectiveValueWeight(agent, candidate);
    if (candidatePressure > pressure) {
      pressure = candidatePressure;
      valueId = candidate;
    }
  }
  return { pressure, valueId };
}

function outletUseFor(agent: CharacterInstance, affordanceId: string): OutletUseState {
  return (
    agent.outletHistory.find(candidate => candidate.affordanceId === affordanceId) ?? {
      affordanceId,
      habituation: 0,
      uses: 0,
    }
  );
}

function matchingSatisfier(agent: CharacterInstance, affordance: OutletAffordance) {
  return effectiveSatisfierPreferences(agent).find(
    preference =>
      preference.valueId === affordance.targetValueId &&
      preference.flavor === affordance.satisfierFlavor,
  );
}

function outletScore(agent: CharacterInstance, affordance: OutletAffordance): number {
  const preference = effectiveOutletPreferences(agent).find(
    candidate => candidate.operation === affordance.operation,
  );
  if (preference === undefined) return Number.NEGATIVE_INFINITY;
  const history = outletUseFor(agent, affordance.id);
  const flavorFit = matchingSatisfier(agent, affordance) === undefined ? 0 : 0.1;
  return preference.rank + affordance.potency * 0.25 + flavorFit - history.habituation * 0.3;
}

function selectOutlet(
  agent: CharacterInstance,
  environment: EnvironmentDefinition,
): OutletAffordance | null {
  let selected: OutletAffordance | null = null;
  let selectedScore = Number.NEGATIVE_INFINITY;
  for (const affordance of environment.outletAffordances) {
    const score = outletScore(agent, affordance);
    if (score > selectedScore) {
      selected = affordance;
      selectedScore = score;
    }
  }
  return selected;
}

function fireOutlet(
  state: SimulationState,
  agent: CharacterInstance,
  affordance: OutletAffordance,
): { agent: CharacterInstance; trace: TraceEntryInput } {
  const previousUse = outletUseFor(agent, affordance.id);
  const scheduleResistance = affordance.reinforcementSchedule === 'variable-ratio' ? 0.35 : 1;
  const habituation = clamp(
    previousUse.habituation +
      agent.profile.constitution.habituationRate *
        affordance.toleranceBuild *
        scheduleResistance *
        0.18,
    0,
    0.95,
  );
  const outletYield = affordance.potency * (1 - previousUse.habituation);
  const satisfier = matchingSatisfier(agent, affordance);
  const stateForValue = agent.values[affordance.targetValueId];
  const positiveTurn =
    satisfier?.type === 'surplus'
      ? (1 - Math.max(0, stateForValue.charge)) * outletYield * 0.25
      : satisfier?.type === 'deficit'
        ? outletYield * 0.25
        : outletYield * 0.1;
  const repairedDeficit = affordance.displacesRepair ? 0 : outletYield * 0.08;
  const values = {
    ...agent.values,
    [affordance.targetValueId]: {
      ...stateForValue,
      charge: clamp(stateForValue.charge + positiveTurn - affordance.valueDamage, -1, 1),
      deficitIntegral: clamp(stateForValue.deficitIntegral - repairedDeficit, 0, 1),
    },
  };
  const selection: OutletSelection = {
    affordanceId: affordance.id,
    label: affordance.label,
    operation: affordance.operation,
    remainingSeconds: affordance.durationSeconds,
    startedSecond: state.second,
    targetValueId: affordance.targetValueId,
    yield: outletYield,
  };
  const nextUse: OutletUseState = {
    affordanceId: affordance.id,
    habituation,
    uses: previousUse.uses + 1,
  };
  const outletHistory = agent.outletHistory.some(
    candidate => candidate.affordanceId === affordance.id,
  )
    ? agent.outletHistory.map(candidate =>
        candidate.affordanceId === affordance.id ? nextUse : candidate,
      )
    : [...agent.outletHistory, nextUse];
  return {
    agent: { ...agent, currentOutlet: selection, outletHistory, values },
    trace: {
      instanceId: agent.id,
      id: `${state.tick}:${agent.id}:${affordance.id}:outlet`,
      kind: 'outlet',
      second: state.second,
      selection: { rule: 'highest-score-then-authored-order', selectedId: affordance.id },
      summary: `${agent.profile.name} turned to ${affordance.label.toLowerCase()}`,
      terms: [
        traceTerm(
          'operation',
          affordance.operation,
          `characters.${agent.profile.profileId}.outletPreferences`,
        ),
        traceTerm(
          'affordance',
          affordance.id,
          `environments.${state.environment.layoutId}.outletAffordances`,
        ),
        traceTerm(
          'target-value',
          affordance.targetValueId,
          `environments.${state.environment.layoutId}.outletAffordances.${affordance.id}`,
        ),
        traceTerm('yield', outletYield, `characters.${agent.id}.outletHistory.${affordance.id}`),
        traceTerm(
          'deficit-repair',
          repairedDeficit,
          `environments.${state.environment.layoutId}.outletAffordances.${affordance.id}.displacesRepair`,
        ),
        traceTerm(
          'habituation',
          habituation,
          `characters.${agent.id}.outletHistory.${affordance.id}`,
        ),
        traceTerm(
          'reinforcement',
          affordance.reinforcementSchedule,
          `environments.${state.environment.layoutId}.outletAffordances.${affordance.id}.reinforcementSchedule`,
        ),
        traceTerm(
          'displaces-repair',
          affordance.displacesRepair,
          `environments.${state.environment.layoutId}.outletAffordances.${affordance.id}.displacesRepair`,
        ),
      ],
      tick: state.tick,
    },
  };
}

/** Continuous coping state: cascade load decays and the active outlet runs down with elapsed time. */
export function advanceCopingTimers(
  state: SimulationState,
  elapsedSeconds: number,
): SimulationState {
  return {
    ...state,
    characters: state.characters.map(agent => ({
      ...agent,
      cascadeLoad: clamp(
        agent.cascadeLoad -
          (agent.profile.constitution.recoveryRate * elapsedSeconds) / SECONDS_PER_HOUR,
        0,
        1.5,
      ),
      currentOutlet:
        agent.currentOutlet === null
          ? null
          : agent.currentOutlet.remainingSeconds <= elapsedSeconds
            ? null
            : {
                ...agent.currentOutlet,
                remainingSeconds: agent.currentOutlet.remainingSeconds - elapsedSeconds,
              },
    })),
  };
}

/** Discrete coping evaluation at a tick boundary: cascade rung recovery and outlet selection. */
export function evaluateCoping(state: SimulationState): SimulationState {
  let trace = state.trace;
  const agents = state.characters.map(agent => {
    const cascadeLoad = agent.cascadeLoad;
    let next: CharacterInstance = agent;
    if (
      next.cascade !== 'none' &&
      state.second >= next.cascadeDwellUntilSecond &&
      cascadeLoad < next.profile.constitution.threshold * 0.75
    ) {
      const previous = next.cascade;
      const cascade = shallowerCascade(next);
      next = {
        ...next,
        cascade,
        cascadeDwellUntilSecond: state.second + dwellSeconds(next),
        cascadeTargetId: cascade === 'fawn' ? next.cascadeTargetId : null,
      };
      trace = appendTrace(trace, {
        instanceId: next.id,
        id: `${state.tick}:${next.id}:cascade-recovery`,
        kind: 'cascade',
        second: state.second,
        selection: null,
        summary: `${next.profile.name} recovered from ${previous} toward ${cascade}`,
        terms: [
          traceTerm('previous-cascade', previous, `characters.${next.id}.cascade`),
          traceTerm('cascade-load', cascadeLoad, `characters.${next.id}.cascadeLoad`),
          traceTerm('next-cascade', cascade, `characters.${next.id}.cascade`),
        ],
        tick: state.tick,
      });
    }
    if (next.currentOutlet === null) {
      const deficit = dominantDeficit(next);
      const threshold = 0.45 - allostaticLoadFor(next) * 0.15;
      if (deficit.pressure >= threshold) {
        const affordance = selectOutlet(next, state.environment);
        if (affordance !== null) {
          const fired = fireOutlet(state, next, affordance);
          next = fired.agent;
          trace = appendTrace(trace, fired.trace);
        }
      }
    }
    return next;
  });
  return { ...state, characters: agents, trace };
}
