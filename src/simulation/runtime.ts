import {
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  secondOfDay,
} from '../model/time.js';
import { appendBounded, clamp, memoryWindow } from '../model/retention.js';
import {
  VALUE_IDS,
  type CharacterDefinition,
  type CharacterPlacement,
  type EnvironmentDefinition,
  type LayerPosition,
  type LocationDefinition,
  type MaskingDemand,
  type PreparedScenario,
  type RecoveryMode,
  type ResourceState,
  type ScheduleBlock,
  type CharacterInstance,
  type SimulationSnapshotFile,
  type SimulationState,
  type TraceEntryInput,
  type ValueId,
  type ValueMap,
  type ValueState,
  type SomaticSourceSeed,
  type TimedRoute,
} from '../model/types.js';
import { ScenarioValidationError } from '../model/validation.js';
import { validateSnapshotReferences } from '../scenario/snapshot-references.js';
import { advanceIntentions, applyWorldFactAmount, intendedTask, prepareAgenda } from './agenda.js';
import { resolveOpportunity } from './decision.js';
import { resolveDisclosureOpportunity } from './disclosure.js';
import { resolveDisplayEvent } from './display.js';
import { advanceCopingTimers, evaluateCoping, resolveAppraisalEvent } from './coping.js';
import { initializeHistoryDerivedState } from './history.js';
import { resolveIncidentEvent } from './incident.js';
import {
  advanceSomaticState,
  applySomaticResourceTax,
  createSomaticState,
  resolveSomaticEvent,
  somaticActivityLabel,
} from './somatic.js';
import {
  createNarrativeState,
  prepareNarrativeAgency,
  resolveNarrativeEvent,
} from './narrative.js';
import { DEFAULT_WALKING_METERS_PER_MINUTE, applyBuildToWalkingPace } from './physical.js';
import { advanceBaselinePlasticity, type BaselinePlasticitySignal } from './plasticity.js';
import {
  createTimedRoute,
  locationCenter,
  routeArrivalSecond,
  routePositionAtSecond,
  navigationDistance,
  sameLayerPosition,
} from './navigation.js';
import { resolveObservationEvent } from './prediction.js';
import {
  consolidateRelationshipMemories,
  repriceExposureDebt,
  resolveRelationshipEvent,
  resolveRelationshipRequest,
} from './relationship.js';
import { appendTrace, createTrace, traceTerm, traceWindows } from './trace.js';

const DEFAULT_RESOURCES: ResourceState = {
  executiveBudget: 0.78,
  physicalStamina: 0.82,
  regulationReserve: 0.76,
  socialBattery: 0.7,
};
const RESOURCE_IDS: Array<keyof ResourceState> = [
  'executiveBudget',
  'physicalStamina',
  'regulationReserve',
  'socialBattery',
];
const RECOVERY_RATES_PER_HOUR: Record<RecoveryMode, ResourceState> = {
  break: {
    executiveBudget: 0.08,
    physicalStamina: 0.03,
    regulationReserve: 0.05,
    socialBattery: 0.12,
  },
  none: {
    executiveBudget: 0,
    physicalStamina: 0,
    regulationReserve: 0,
    socialBattery: 0,
  },
  rest: {
    executiveBudget: 0.1,
    physicalStamina: 0.08,
    regulationReserve: 0.08,
    socialBattery: 0.14,
  },
  sleep: {
    executiveBudget: 0.15,
    physicalStamina: 0.14,
    regulationReserve: 0.12,
    socialBattery: 0.12,
  },
};

function findLocation(environment: EnvironmentDefinition, locationId: string): LocationDefinition {
  const location = environment.locations.find(candidate => candidate.id === locationId);
  if (location === undefined) {
    throw new ScenarioValidationError(
      'scenario.characters.schedule.locationId',
      `unknown location "${locationId}"`,
    );
  }
  return location;
}

function activeScheduleBlock(schedule: ScheduleBlock[], second: number): ScheduleBlock {
  const secondOfDay = ((second % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  let active = schedule[schedule.length - 1];
  for (const block of schedule) {
    if (block.startSecond > secondOfDay) break;
    active = block;
  }
  if (active === undefined) throw new Error('Validated schedules always contain a block');
  return active;
}

function initialValues(
  profile: CharacterDefinition,
  placement: CharacterPlacement,
): ValueMap<ValueState> {
  const result = {} as ValueMap<ValueState>;
  for (const valueId of VALUE_IDS) {
    const disposition = profile.values[valueId];
    const override = placement.initialValues?.[valueId];
    result[valueId] = {
      charge: override?.charge ?? disposition.initialCharge,
      deficitIntegral: override?.deficitIntegral ?? disposition.initialDeficit,
      variance: override?.variance ?? disposition.initialVariance,
    };
  }
  return result;
}

function initializeAgent(
  profile: CharacterDefinition,
  placement: CharacterPlacement,
  environment: EnvironmentDefinition,
  second: number,
  ambientSomaticSources: readonly SomaticSourceSeed[],
): CharacterInstance {
  const block = activeScheduleBlock(placement.schedule, second);
  const destination = locationCenter(findLocation(environment, block.locationId));
  const arrived = sameLayerPosition(placement.position, destination);
  const formative = initializeHistoryDerivedState(profile);
  const normInternalizations = Object.fromEntries(
    placement.normPerspectives.map(perspective => [
      `${perspective.norm.packageId}:${perspective.norm.kind}:${perspective.norm.resourceId}`,
      perspective.internalization,
    ]),
  );
  const agent: CharacterInstance = {
    arrivedSecond: null,
    cascade: 'none',
    cascadeDwellUntilSecond: second,
    cascadeLoad: 0,
    cascadeTargetId: null,
    currentOutlet: null,
    currentActivity: arrived
      ? block.activity
      : `Walking to ${findLocation(environment, block.locationId).name}`,
    currentLocationId: arrived ? block.locationId : null,
    destination,
    directedLocationId: null,
    history: {
      ...formative.history,
      overrides: {
        ...formative.history.overrides,
        ...(placement.normPerspectives.length === 0 ? {} : { normInternalizations }),
      },
    },
    id: placement.instanceId,
    memories: formative.memories,
    narrative: null,
    outletHistory: [],
    positionalRespect: { ambientCount: 0, ambientStanding: 0, references: [] },
    position: { ...placement.position },
    profile,
    route: null,
    resources: { ...DEFAULT_RESOURCES, ...placement.initialResources },
    schedule: placement.schedule.map(scheduleBlock => ({ ...scheduleBlock })),
    somatic: createSomaticState([
      ...ambientSomaticSources.map(source => ({ ...source })),
      ...placement.initialSomaticSources.map(source => ({ ...source })),
    ]),
    tier: placement.tier,
    values: initialValues(profile, placement),
    walkingMetersPerMinute: applyBuildToWalkingPace(
      placement.walkingMetersPerMinute ?? DEFAULT_WALKING_METERS_PER_MINUTE,
      profile.physical.build,
    ),
  };
  agent.currentActivity = somaticActivityLabel(agent.somatic) ?? agent.currentActivity;
  if (placement.agency === 'responder') return agent;
  const narrative = createNarrativeState(agent, second);
  return {
    ...agent,
    narrative: {
      ...narrative,
      claims: narrative.claims.map(claim => {
        const override = placement.narrativeOverrides.find(item => item.claimId === claim.id);
        return override === undefined ? claim : { ...claim, ...override };
      }),
    },
  };
}

export function createSimulationFromPrepared(prepared: PreparedScenario): SimulationState {
  const environment = prepared.environment;
  const agents = prepared.characters.map(({ placement, profile }) =>
    initializeAgent(
      profile,
      placement,
      environment,
      prepared.scenario.startSecond,
      prepared.scenario.ambientSomaticSources,
    ),
  );

  let initial: SimulationState = {
    appraisalRecords: [],
    agendaDecisions: [],
    agendaGoals: prepared.scenario.agendaGoals.map(goal => ({
      ...goal,
      desired: goal.desired.map(condition => ({ ...condition })),
      failureTurns: { ...goal.failureTurns },
      lastPlannedWorldRevision: null,
      resolvedSecond: null,
      status: 'pending',
      successTurns: { ...goal.successTurns },
    })),
    characters: agents,
    decisions: [],
    disclosureDecisions: [],
    disclosureItems: prepared.scenario.disclosureItems.map(item => ({
      ...item,
      knownByIds: [...item.knownByIds],
    })),
    displayExposures: [],
    displayRecords: [],
    dyads: prepared.scenario.dyads.map(dyad => ({
      ...dyad,
      features: { ...dyad.features },
      validatorClaimIds: [...dyad.validatorClaimIds],
    })),
    environment,
    incidentRecords: [],
    intentions: [],
    second: prepared.scenario.startSecond,
    narrativeRecords: [],
    norms: prepared.norms,
    observations: [],
    plans: [],
    relationshipDecisions: [],
    reputations: [],
    resourceLock: prepared.resourceLock,
    resolvedDisclosureOpportunityIds: [],
    resolvedDisplayEventIds: [],
    resolvedIncidentEventIds: [],
    resolvedObservationEventIds: [],
    resolvedOpportunityIds: [],
    resolvedAppraisalEventIds: [],
    resolvedAspirationOpportunityIds: [],
    resolvedNarrativeEventIds: [],
    resolvedRelationshipEventIds: [],
    resolvedRelationshipRequestIds: [],
    resolvedSomaticEventIds: [],
    scenario: prepared.scenario,
    socialContracts: prepared.socialContracts,
    somaticRecords: [],
    tick: 0,
    trace: createTrace(traceWindows(prepared.scenario.characters), [
      {
        instanceId: null,
        id: '0:scenario',
        kind: 'scenario',
        second: prepared.scenario.startSecond,
        selection: null,
        summary: `Loaded ${prepared.scenario.title}`,
        terms: [
          traceTerm('environment', environment.layoutId, 'scenario.environment'),
          ...agents.map(agent =>
            traceTerm(
              `character:${agent.id}`,
              agent.profile.profileId,
              `scenario.characters.${agent.id}.profile`,
            ),
          ),
        ],
        tick: 0,
      },
    ]),
    worldFacts: prepared.scenario.worldFacts.map(fact => ({ ...fact })),
    worldRevision: 0,
  };
  initial = {
    ...initial,
    dyads: initial.dyads.map(dyad => repriceExposureDebt(initial, dyad)),
  };
  return planRoutes(prepareAgenda(prepareNarrativeAgency(initial)));
}

export function createSimulationFromPreparedSnapshot(input: {
  prepared: PreparedScenario;
  snapshot: SimulationSnapshotFile;
}): SimulationState {
  const snapshot = input.snapshot;
  const base = createSimulationFromPrepared(input.prepared);
  validateSnapshotReferences({ base, snapshot });
  const baseAgents = new Map(base.characters.map(agent => [agent.id, agent]));
  const agents = snapshot.characters.map(saved => {
    const agent = baseAgents.get(saved.id);
    if (agent === undefined) throw new Error('Validated snapshot agents exist in the base state');
    return {
      arrivedSecond: saved.arrivedSecond,
      cascade: saved.cascade,
      cascadeDwellUntilSecond: saved.cascadeDwellUntilSecond,
      cascadeLoad: saved.cascadeLoad,
      cascadeTargetId: saved.cascadeTargetId,
      currentOutlet: saved.currentOutlet === null ? null : { ...saved.currentOutlet },
      currentActivity: saved.currentActivity,
      currentLocationId: saved.currentLocationId,
      destination: { ...saved.destination },
      directedLocationId: saved.directedLocationId,
      history: {
        formativeRecords: saved.history.formativeRecords.map(record => ({ ...record })),
        overrides: structuredClone(saved.history.overrides),
        plasticity: structuredClone(saved.history.plasticity),
      },
      id: saved.id,
      memories: saved.memories.map(memory => ({
        ...memory,
        ...(memory.provenance === undefined ? {} : { provenance: { ...memory.provenance } }),
      })),
      narrative:
        saved.narrative === null
          ? null
          : {
              ...saved.narrative,
              claims: saved.narrative.claims.map(claim => ({ ...claim })),
            },
      outletHistory: saved.outletHistory.map(use => ({ ...use })),
      positionalRespect: structuredClone(saved.positionalRespect),
      position: { ...saved.position },
      profile: agent.profile,
      resources: { ...saved.resources },
      route: saved.route === null ? null : structuredClone(saved.route),
      schedule: saved.schedule.map(block => ({ ...block })),
      somatic: structuredClone(saved.somatic),
      tier: saved.tier,
      values: Object.fromEntries(
        VALUE_IDS.map(valueId => [valueId, { ...saved.values[valueId] }]),
      ) as ValueMap<ValueState>,
      walkingMetersPerMinute: saved.walkingMetersPerMinute,
    };
  });
  return {
    ...base,
    appraisalRecords: structuredClone(snapshot.appraisalRecords),
    agendaDecisions: structuredClone(snapshot.agendaDecisions),
    agendaGoals: structuredClone(snapshot.agendaGoals),
    characters: agents,
    decisions: structuredClone(snapshot.decisions),
    disclosureDecisions: structuredClone(snapshot.disclosureDecisions),
    disclosureItems: structuredClone(snapshot.disclosureItems),
    displayExposures: structuredClone(snapshot.displayExposures),
    displayRecords: structuredClone(snapshot.displayRecords),
    dyads: structuredClone(snapshot.dyads),
    incidentRecords: structuredClone(snapshot.incidentRecords),
    intentions: structuredClone(snapshot.intentions),
    second: snapshot.second,
    narrativeRecords: structuredClone(snapshot.narrativeRecords),
    observations: structuredClone(snapshot.observations),
    plans: structuredClone(snapshot.plans),
    relationshipDecisions: structuredClone(snapshot.relationshipDecisions),
    reputations: structuredClone(snapshot.reputations),
    resolvedDisclosureOpportunityIds: structuredClone(snapshot.resolvedDisclosureOpportunityIds),
    resolvedDisplayEventIds: structuredClone(snapshot.resolvedDisplayEventIds),
    resolvedIncidentEventIds: structuredClone(snapshot.resolvedIncidentEventIds),
    resolvedObservationEventIds: structuredClone(snapshot.resolvedObservationEventIds),
    resolvedOpportunityIds: structuredClone(snapshot.resolvedOpportunityIds),
    resolvedAppraisalEventIds: structuredClone(snapshot.resolvedAppraisalEventIds),
    resolvedAspirationOpportunityIds: structuredClone(snapshot.resolvedAspirationOpportunityIds),
    resolvedNarrativeEventIds: structuredClone(snapshot.resolvedNarrativeEventIds),
    resolvedRelationshipEventIds: structuredClone(snapshot.resolvedRelationshipEventIds),
    resolvedRelationshipRequestIds: structuredClone(snapshot.resolvedRelationshipRequestIds),
    resolvedSomaticEventIds: structuredClone(snapshot.resolvedSomaticEventIds),
    somaticRecords: structuredClone(snapshot.somaticRecords),
    tick: snapshot.tick,
    trace: structuredClone(snapshot.trace),
    worldFacts: structuredClone(snapshot.worldFacts),
    worldRevision: snapshot.worldRevision,
  };
}

function advanceValueState(
  state: ValueState,
  turnPerHour: number,
  tickSeconds: number,
): ValueState {
  const charge = clamp(state.charge + (turnPerHour * tickSeconds) / SECONDS_PER_HOUR, -1, 1);
  const dayFraction = tickSeconds / SECONDS_PER_DAY;
  // Charge drifts linearly between boundaries, so the trapezoid rule integrates
  // the deficit exactly and the result cannot depend on how an interval is split.
  const deficitRate = (value: number): number =>
    value < 0 ? -value : -Math.min(value, 0.25) * 0.08;
  const deficitIntegral = clamp(
    state.deficitIntegral + ((deficitRate(state.charge) + deficitRate(charge)) / 2) * dayFraction,
    0,
    1,
  );
  return { charge, deficitIntegral, variance: state.variance };
}

interface ResourceRecoveryResult {
  deltas: ResourceState;
  resources: ResourceState;
}

function advanceResources(
  resources: ResourceState,
  recoveryMode: RecoveryMode,
  recoverySeconds: number,
  drainSeconds: number,
  drainsPerHour: Partial<ResourceState>,
): ResourceRecoveryResult {
  const rates = RECOVERY_RATES_PER_HOUR[recoveryMode];
  const next = {} as ResourceState;
  const deltas = {} as ResourceState;
  for (const resourceId of RESOURCE_IDS) {
    next[resourceId] = clamp(
      resources[resourceId] +
        (rates[resourceId] * recoverySeconds) / SECONDS_PER_HOUR -
        ((drainsPerHour[resourceId] ?? 0) * drainSeconds) / SECONDS_PER_HOUR,
      0,
      1,
    );
    deltas[resourceId] = next[resourceId] - resources[resourceId];
  }
  return { deltas, resources: next };
}

function maskingDrains(demand: MaskingDemand | null): Partial<ResourceState> {
  if (demand === null) return {};
  const fabricationMultiplier = demand.fabricated ? 1 : 0.2;
  const cost =
    demand.presentationGap * demand.exposureRisk * demand.audienceCount * fabricationMultiplier;
  return {
    executiveBudget: cost * 0.6,
    regulationReserve: cost * 0.4,
  };
}

function combinedResourceDrains(
  authored: Partial<ResourceState>,
  masking: Partial<ResourceState>,
): Partial<ResourceState> {
  return Object.fromEntries(
    RESOURCE_IDS.map(resourceId => [
      resourceId,
      (authored[resourceId] ?? 0) + (masking[resourceId] ?? 0),
    ]),
  ) as Partial<ResourceState>;
}

interface ResolvedDestination {
  block: ReturnType<typeof activeScheduleBlock> | null;
  destination: LayerPosition;
  intention: SimulationState['intentions'][number] | undefined;
  location: LocationDefinition;
  locationId: string;
  preempted: boolean;
  task: ReturnType<typeof intendedTask>;
}

/** Where a character is bound from this second: a player redirect, its agenda task, or its schedule. */
function resolveDestination(state: SimulationState, agent: CharacterInstance): ResolvedDestination {
  const intention = state.intentions.find(candidate => candidate.actorId === agent.id);
  // A player-directed destination supersedes agenda and schedule until arrival.
  const task = agent.directedLocationId === null ? intendedTask(state, agent.id) : null;
  // Inputs are constant across an interval because advanceTo splits at every
  // schedule start, so the block in force is the one active when it begins.
  const block =
    task === null && agent.directedLocationId === null
      ? activeScheduleBlock(agent.schedule, state.second)
      : null;
  const locationId = agent.directedLocationId ?? task?.locationId ?? block?.locationId;
  if (locationId === undefined)
    throw new Error('An agent always has a task or schedule destination');
  const location = findLocation(state.environment, locationId);
  const preempted = agent.somatic.level >= 3;
  const destination = preempted ? agent.position : locationCenter(location);
  return { block, destination, intention, location, locationId, preempted, task };
}

/**
 * The route a character follows from this second. A committed route makes
 * position a pure function of absolute time. Any destination change settles
 * the old route at this second (the previous interval already placed the
 * character here) and commits a replacement from that settled position.
 */
function committedRoute(
  state: SimulationState,
  agent: CharacterInstance,
  resolved: Pick<ResolvedDestination, 'destination' | 'locationId' | 'preempted'>,
): TimedRoute | null {
  if (resolved.preempted || sameLayerPosition(agent.position, resolved.destination)) return null;
  return agent.route !== null &&
    agent.route.destinationLocationId === resolved.locationId &&
    agent.route.departureSecond <= state.second
    ? agent.route
    : createTimedRoute(
        state.environment,
        agent.position,
        resolved.destination,
        resolved.locationId,
        state.second,
        agent.walkingMetersPerMinute / SECONDS_PER_MINUTE,
      );
}

/**
 * Commit, at a boundary second, the route each character will follow from it.
 * Routes are therefore present in the state at the second movement begins -
 * scenario start, a schedule or task change, a redirect - rather than only
 * after the first interval has moved the character, so observers can project
 * movement from a departure second without waiting for the next commit.
 */
function planRoutes(state: SimulationState): SimulationState {
  let changed = false;
  const characters = state.characters.map(agent => {
    const route = committedRoute(state, agent, resolveDestination(state, agent));
    if (route === agent.route || route === null) return agent;
    changed = true;
    return { ...agent, route };
  });
  return changed ? { ...state, characters } : state;
}

interface CharacterAdvanceResult {
  agent: CharacterInstance;
  plasticitySignals: BaselinePlasticitySignal[];
  sleeping: boolean;
  trace: TraceEntryInput[];
}

function advanceAgent(
  state: SimulationState,
  agent: CharacterInstance,
  nextSecond: number,
  nextTick: number,
  completesTick: boolean,
): CharacterAdvanceResult {
  const tickSeconds = state.scenario.tickSeconds;
  const tickStart = nextSecond - tickSeconds;
  const { block, destination, intention, location, locationId, preempted, task } =
    resolveDestination(state, agent);
  const route = committedRoute(state, agent, { destination, locationId, preempted });
  const remaining = route === null ? 0 : route.lengthMeters;
  const arrivalSecond = route === null ? state.second : routeArrivalSecond(route);
  const position = preempted
    ? agent.position
    : route === null
      ? agent.position
      : nextSecond >= arrivalSecond
        ? destination
        : routePositionAtSecond(route, nextSecond);
  const arrived = !preempted && sameLayerPosition(position, destination);
  const arrivedSecond = arrived && route !== null ? nextSecond : agent.arrivedSecond;
  const activityLabel = (atDestination: boolean): string =>
    preempted
      ? agent.currentActivity
      : atDestination
        ? task === null
          ? (block?.activity ?? agent.currentActivity)
          : intention?.phase === 'waiting'
            ? `Waiting to ${task.label.toLowerCase()}`
            : task.label
        : `Walking to ${location.name}${task === null ? '' : ` to ${task.label.toLowerCase()}`}`;
  // A departure or a new obligation is stamped at the second the interval
  // begins; an arrival at the second it ends. Neither depends on how the
  // interval was partitioned.
  const startActivity = activityLabel(!preempted && remaining === 0);
  const currentActivity = activityLabel(arrived);
  const currentLocationId = preempted ? agent.currentLocationId : arrived ? locationId : null;
  // Continuous accumulators integrate exactly once per authored tick, so no
  // partition of the tick into intervals can change their arithmetic.
  const values = completesTick ? ({} as ValueMap<ValueState>) : agent.values;
  if (completesTick) {
    for (const valueId of VALUE_IDS) {
      values[valueId] = advanceValueState(
        agent.values[valueId],
        state.scenario.ambientTurnsPerHour?.[valueId] ?? 0,
        tickSeconds,
      );
    }
  }
  const scheduleRecoveryMode = task === null && arrived ? (block?.recoveryMode ?? 'none') : 'none';
  const taskRecoveryMode =
    task !== null && arrived && intention?.phase === 'work' ? task.recoveryMode : 'none';
  const recoveryMode = task === null ? scheduleRecoveryMode : taskRecoveryMode;
  const arrivalSeconds =
    arrivedSecond !== null && arrivedSecond > tickStart ? arrivedSecond - tickStart : 0;
  const recoverySeconds =
    recoveryMode === 'none'
      ? 0
      : task === null
        ? clamp(tickSeconds - arrivalSeconds, 0, tickSeconds)
        : tickSeconds;
  const authoredDrains = arrived
    ? (task?.resourceDrainsPerHour ?? block?.resourceDrainsPerHour ?? {})
    : {};
  const activeMasking = arrived ? (task?.maskingDemand ?? block?.maskingDemand ?? null) : null;
  const drains = combinedResourceDrains(authoredDrains, maskingDrains(activeMasking));
  const activeSeconds = arrived ? tickSeconds : 0;
  const recovery = completesTick
    ? advanceResources(agent.resources, recoveryMode, recoverySeconds, activeSeconds, drains)
    : { deltas: agent.resources, resources: agent.resources };
  const somatic = completesTick ? advanceSomaticState(agent.somatic, tickSeconds) : agent.somatic;
  const resources = completesTick
    ? applySomaticResourceTax(recovery.resources, somatic, tickSeconds)
    : agent.resources;
  const recoverySource =
    task === null
      ? `characters.${agent.id}.schedule.recoveryMode`
      : `scenario.taskOperators.${task.id}.recoveryMode`;
  const plasticitySignals: BaselinePlasticitySignal[] = [];
  if (agent.currentOutlet !== null) {
    plasticitySignals.push({
      gap: agent.currentOutlet.yield,
      mechanism: 'outlet-promotion',
      source: `characters.${agent.id}.currentOutlet`,
      strength: 1,
      target: { id: agent.currentOutlet.label, kind: 'identity-marker' },
    });
  }
  const maskingReward =
    task === null ? 0 : Math.max(task.valueTurns.belonging ?? 0, task.valueTurns.respect ?? 0);
  if (activeMasking !== null && task !== null && maskingReward > 0) {
    plasticitySignals.push({
      gap: activeMasking.presentationGap,
      mechanism: 'rewarded-masking',
      source: `scenario.taskOperators.${task.id}`,
      strength: clamp(maskingReward, 0, 1),
      target: { id: task.label, kind: 'identity-marker' },
    });
  }

  let memories = agent.memories;
  const trace: TraceEntryInput[] = [];
  if (completesTick && somatic.attentionTax > 0) {
    trace.push({
      instanceId: agent.id,
      id: `${nextTick}:${nextSecond}:${agent.id}:somatic`,
      kind: 'somatic',
      second: nextSecond,
      selection: null,
      summary: `${agent.profile.name} carries a somatic attention tax`,
      terms: [
        traceTerm('attention-tax', somatic.attentionTax, `characters.${agent.id}.somatic.sources`),
        traceTerm(
          'executive-budget',
          resources.executiveBudget,
          `characters.${agent.id}.resources.executiveBudget`,
        ),
        traceTerm('level', somatic.level, `characters.${agent.id}.somatic.level`),
      ],
      tick: nextTick,
    });
  }
  const activityChanges: { label: string; second: number }[] = [];
  if (startActivity !== agent.currentActivity) {
    activityChanges.push({ label: startActivity, second: state.second });
  }
  if (currentActivity !== startActivity) {
    activityChanges.push({ label: currentActivity, second: nextSecond });
  }
  for (const change of activityChanges) {
    const summary = `${agent.profile.name}: ${change.label}`;
    memories = appendBounded(
      memories,
      {
        id: `${nextTick}:${change.second}:${agent.id}:activity`,
        second: change.second,
        summary,
        type: 'activity',
      },
      memoryWindow(agent.tier),
    );
    trace.push({
      instanceId: agent.id,
      id: `${nextTick}:${change.second}:${agent.id}:activity`,
      kind: 'activity',
      second: change.second,
      selection: null,
      summary,
      terms:
        task === null
          ? [
              traceTerm('schedule', block?.startSecond ?? 0, `characters.${agent.id}.schedule`),
              traceTerm('location', locationId, `environment.locations.${locationId}`),
              traceTerm(
                'recovery-mode',
                recoveryMode,
                `characters.${agent.id}.schedule.recoveryMode`,
              ),
            ]
          : [
              traceTerm('intention', task.id, `intentions.${agent.id}`),
              traceTerm('location', locationId, `environment.locations.${locationId}`),
              traceTerm('recovery-mode', task.recoveryMode, recoverySource),
            ],
      tick: nextTick,
    });
  }

  const previousHour = Math.floor(tickStart / SECONDS_PER_HOUR);
  const nextHour = Math.floor(nextSecond / SECONDS_PER_HOUR);
  if (completesTick && previousHour !== nextHour) {
    const activeTurns = VALUE_IDS.filter(
      valueId => (state.scenario.ambientTurnsPerHour?.[valueId] ?? 0) !== 0,
    );
    if (activeTurns.length > 0) {
      trace.push({
        instanceId: agent.id,
        id: `${nextTick}:${nextSecond}:${agent.id}:ambient`,
        kind: 'value-turn',
        second: nextSecond,
        selection: null,
        summary: `${agent.profile.name} remains under the scenario's ambient pressure`,
        terms: activeTurns.map(valueId =>
          traceTerm(
            `ambient:${valueId}`,
            state.scenario.ambientTurnsPerHour?.[valueId] ?? 0,
            `scenario.ambientTurnsPerHour.${valueId}`,
          ),
        ),
        tick: nextTick,
      });
    }
    if (
      RESOURCE_IDS.some(resourceId => resources[resourceId] - agent.resources[resourceId] !== 0)
    ) {
      trace.push({
        instanceId: agent.id,
        id: `${nextTick}:${nextSecond}:${agent.id}:resource`,
        kind: 'resource',
        second: nextSecond,
        selection: null,
        summary: `${agent.profile.name}'s resources shift through ${task?.label ?? block?.activity ?? recoveryMode}`,
        terms: [
          traceTerm('recovery-mode', recoveryMode, recoverySource),
          ...RESOURCE_IDS.map(resourceId =>
            traceTerm(
              `recovery-rate:${resourceId}`,
              RECOVERY_RATES_PER_HOUR[recoveryMode][resourceId],
              `simulation.recovery.${recoveryMode}.${resourceId}`,
            ),
          ),
          ...RESOURCE_IDS.map(resourceId =>
            traceTerm(
              `drain-rate:${resourceId}`,
              drains[resourceId] ?? 0,
              task === null
                ? `characters.${agent.id}.schedule.resourceDrainsPerHour`
                : `scenario.taskOperators.${task.id}.resourceDrainsPerHour`,
            ),
          ),
          ...RESOURCE_IDS.map(resourceId =>
            traceTerm(
              `resource:${resourceId}`,
              resources[resourceId],
              `characters.${agent.id}.resources.${resourceId}`,
            ),
          ),
        ],
        tick: nextTick,
      });
    }
  }

  return {
    agent: {
      ...agent,
      arrivedSecond,
      currentActivity,
      currentLocationId,
      destination,
      directedLocationId: arrived ? null : agent.directedLocationId,
      memories,
      position,
      route: arrived ? null : route,
      resources,
      somatic,
      values,
    },
    plasticitySignals,
    sleeping: recoveryMode === 'sleep' && arrived,
    trace,
  };
}

function rupturePlasticitySignals(
  state: SimulationState,
  agent: CharacterInstance,
): BaselinePlasticitySignal[] {
  return state.dyads
    .filter(dyad => dyad.observerId === agent.id && dyad.mode === 'ruptured')
    .map(dyad => ({
      gap: clamp(
        Math.max(dyad.predictionError, Math.abs(dyad.stance), agent.cascadeLoad / 1.5),
        0,
        1,
      ),
      mechanism: 'rupture-crystallization',
      source: `dyads.${dyad.observerId}->${dyad.subjectId}`,
      strength: 1,
      target: {
        id: agent.cascade === 'none' ? 'freeze' : agent.cascade,
        kind: 'cascade-prior',
      },
    }));
}

function dueDuringTick<Event extends { atSecond: number; id: string }>(
  events: readonly Event[],
  currentSecond: number,
  nextSecond: number,
  resolvedIds: readonly string[],
): Event[] {
  return events.filter(
    event =>
      event.atSecond >= currentSecond &&
      event.atSecond <= nextSecond &&
      !resolvedIds.includes(event.id),
  );
}

function tickStartSecond(state: SimulationState): number {
  const elapsed = state.second - state.scenario.startSecond;
  return state.second - (elapsed % state.scenario.tickSeconds);
}

function nextScheduleStart(schedule: readonly ScheduleBlock[], second: number): number | null {
  const dayStart = second - secondOfDay(second);
  let nearest: number | null = null;
  for (const block of schedule) {
    for (const candidate of [
      dayStart + block.startSecond,
      dayStart + SECONDS_PER_DAY + block.startSecond,
    ]) {
      if (candidate > second && (nearest === null || candidate < nearest)) nearest = candidate;
    }
  }
  return nearest;
}

/**
 * The next second at which authoritative state may change discontinuously:
 * an authored event, a schedule block start, an arrival, a timer completion,
 * an hour mark, or the end of the current authored tick. Advancing across one
 * of these in a single continuous step would blur the discrete change into
 * the interval, so `advanceTo` always splits there.
 */
function nextBoundary(state: SimulationState, target: number): number {
  const now = state.second;
  let boundary = Math.min(target, tickStartSecond(state) + state.scenario.tickSeconds);
  // Boundaries are integer seconds: a fractional arrival rounds up to the next
  // whole second and the interval's proration accounts for the remainder.
  const consider = (second: number | null | undefined): void => {
    if (typeof second !== 'number' || !Number.isFinite(second)) return;
    const whole = Math.ceil(second);
    if (whole > now && whole < boundary) boundary = whole;
  };
  const families: readonly (readonly { atSecond: number; id: string }[])[] = [
    state.scenario.somaticEvents,
    state.scenario.behaviorOpportunities,
    state.scenario.disclosureOpportunities,
    state.scenario.observationEvents,
    state.scenario.incidentEvents,
    state.scenario.displayEvents,
    state.scenario.relationshipEvents,
    state.scenario.relationshipRequests,
    state.scenario.appraisalEvents,
    state.scenario.narrativeEvents,
    state.scenario.aspirationOpportunities,
  ];
  for (const family of families) for (const event of family) consider(event.atSecond);
  consider(Math.floor(now / SECONDS_PER_HOUR + 1) * SECONDS_PER_HOUR);
  for (const agent of state.characters) {
    consider(nextScheduleStart(agent.schedule, now));
    if (agent.currentOutlet !== null) consider(now + agent.currentOutlet.remainingSeconds);
    if (agent.somatic.level < 3) {
      if (agent.route !== null) {
        consider(routeArrivalSecond(agent.route));
        continue;
      }
      const task = agent.directedLocationId === null ? intendedTask(state, agent.id) : null;
      const block =
        task === null && agent.directedLocationId === null
          ? activeScheduleBlock(agent.schedule, now)
          : null;
      const locationId = agent.directedLocationId ?? task?.locationId ?? block?.locationId;
      if (locationId !== undefined) {
        const remaining = navigationDistance(
          state.environment,
          agent.position,
          locationCenter(findLocation(state.environment, locationId)),
        );
        if (remaining > 0) {
          consider(now + (remaining / agent.walkingMetersPerMinute) * SECONDS_PER_MINUTE);
        }
      }
    }
  }
  for (const intention of state.intentions) {
    if (intention.phase === 'work') consider(now + intention.remainingSeconds);
    const task = state.scenario.taskOperators.find(candidate => candidate.id === intention.taskId);
    if (intention.phase === 'waiting') consider(task?.availableFromSecond ?? null);
  }
  for (const goal of state.agendaGoals) consider(goal.deadlineSecond);
  return boundary;
}

function advanceInterval(state: SimulationState, toSecond: number): SimulationState {
  const startsTick = state.second === tickStartSecond(state);
  const prepared = startsTick ? prepareAgenda(prepareNarrativeAgency(state)) : state;
  const nextTick = startsTick ? prepared.tick + 1 : prepared.tick;
  const completesTick = toSecond === tickStartSecond(prepared) + prepared.scenario.tickSeconds;
  const fromSecond = prepared.second;
  const results = prepared.characters.map(agent =>
    advanceAgent(prepared, agent, toSecond, nextTick, completesTick),
  );
  let trace = prepared.trace;
  for (const result of results) {
    for (const entry of result.trace) trace = appendTrace(trace, entry);
  }
  let next: SimulationState = {
    ...prepared,
    characters: results.map(result => result.agent),
    second: toSecond,
    tick: nextTick,
    trace,
  };
  const elapsedSeconds = toSecond - fromSecond;
  const due = <Event extends { atSecond: number; id: string }>(
    events: readonly Event[],
    resolved: readonly string[],
  ): Event[] => dueDuringTick(events, fromSecond, toSecond, resolved);
  next = advanceCopingTimers(next, elapsedSeconds);
  const dueSomaticEvents = due(prepared.scenario.somaticEvents, prepared.resolvedSomaticEventIds);
  for (const event of dueSomaticEvents) next = resolveSomaticEvent(next, event);
  if (dueSomaticEvents.length > 0) next = prepareAgenda(next);
  next = advanceIntentions(next, elapsedSeconds);
  for (const opportunity of due(
    prepared.scenario.behaviorOpportunities,
    prepared.resolvedOpportunityIds,
  )) {
    next = resolveOpportunity(next, opportunity);
  }
  for (const opportunity of due(
    prepared.scenario.disclosureOpportunities,
    prepared.resolvedDisclosureOpportunityIds,
  )) {
    next = resolveDisclosureOpportunity(next, opportunity);
  }
  for (const event of due(
    prepared.scenario.observationEvents,
    prepared.resolvedObservationEventIds,
  )) {
    next = resolveObservationEvent(next, event);
  }
  for (const event of due(prepared.scenario.incidentEvents, prepared.resolvedIncidentEventIds)) {
    next = resolveIncidentEvent(next, event);
  }
  for (const event of due(prepared.scenario.displayEvents, prepared.resolvedDisplayEventIds)) {
    next = resolveDisplayEvent(next, event);
  }
  for (const event of due(
    prepared.scenario.relationshipEvents,
    prepared.resolvedRelationshipEventIds,
  )) {
    next = resolveRelationshipEvent(next, event);
  }
  for (const request of due(
    prepared.scenario.relationshipRequests,
    prepared.resolvedRelationshipRequestIds,
  )) {
    next = resolveRelationshipRequest(next, request);
  }
  for (const event of due(prepared.scenario.appraisalEvents, prepared.resolvedAppraisalEventIds)) {
    next = resolveAppraisalEvent(next, event);
  }
  for (const event of due(prepared.scenario.narrativeEvents, prepared.resolvedNarrativeEventIds)) {
    next = resolveNarrativeEvent(next, event);
  }
  if (!completesTick) return planRoutes(next);
  next = consolidateRelationshipMemories(
    next,
    results.filter(result => result.sleeping).map(result => result.agent.id),
  );
  next = evaluateCoping(next);
  const signalsByAgent = new Map(
    results.map(result => [result.agent.id, result.plasticitySignals]),
  );
  return planRoutes({
    ...next,
    characters: next.characters.map(agent =>
      advanceBaselinePlasticity(agent, {
        elapsedSeconds: next.scenario.tickSeconds,
        second: next.second,
        originSecond: next.scenario.startSecond,
        signals: [
          ...(signalsByAgent.get(agent.id) ?? []),
          ...rupturePlasticitySignals(next, agent),
        ],
      }),
    ),
  });
}

/**
 * Advance authoritative time to an exact second, splitting at every discrete
 * boundary so events resolve at their authored second in stable pipeline
 * order and continuous state is integrated piecewise over constant inputs.
 */
export function advanceTo(state: SimulationState, targetSecond: number): SimulationState {
  if (!Number.isInteger(targetSecond) || targetSecond < state.second) {
    throw new RangeError('targetSecond must be an integer at or after the current second');
  }
  let next = state;
  while (next.second < targetSecond) {
    next = advanceInterval(next, nextBoundary(next, targetSecond));
  }
  return next;
}

export function advanceSimulation(state: SimulationState, ticks = 1): SimulationState {
  if (!Number.isInteger(ticks) || ticks < 0)
    throw new RangeError('ticks must be a non-negative integer');
  return advanceTo(state, state.second + ticks * state.scenario.tickSeconds);
}

/**
 * Direct a character toward a location. The current route settles where it
 * stands at this second and a replacement route starts from that position on
 * this second; the directed destination supersedes schedule and agenda
 * until arrival.
 */
export function redirectCharacter(
  state: SimulationState,
  instanceId: string,
  locationId: string,
): SimulationState {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown character "${instanceId}"`);
  const location = findLocation(state.environment, locationId);
  const entry = interventionEntry(
    state,
    agent,
    `${agent.profile.name} was redirected toward ${location.name}`,
    'redirect',
    state.second,
    `environment.locations.${locationId}`,
  );
  return planRoutes({
    ...state,
    characters: state.characters.map(candidate =>
      candidate.id === instanceId
        ? { ...candidate, directedLocationId: locationId, route: null }
        : candidate,
    ),
    trace: appendTrace(state.trace, entry),
  });
}

function interventionEntry(
  state: SimulationState,
  agent: CharacterInstance,
  summary: string,
  termId: string,
  value: number,
  source: string,
): TraceEntryInput {
  const idPrefix = `${state.tick}:${agent.id}:intervention:`;
  let ordinal = 0;
  for (const entry of state.trace.entries) {
    if (!entry.id.startsWith(idPrefix)) continue;
    const candidate = Number(entry.id.slice(idPrefix.length));
    if (Number.isInteger(candidate) && candidate >= ordinal) ordinal = candidate + 1;
  }
  return {
    instanceId: agent.id,
    id: `${idPrefix}${ordinal}`,
    kind: 'intervention',
    second: state.second,
    selection: null,
    summary,
    terms: [traceTerm(termId, value, source)],
    tick: state.tick,
  };
}

/**
 * Set a world fact, replan every agenda, and commit any route the replanning
 * changes at this second, so a task change caused by the edit is visible in the
 * state immediately rather than after the next advanced interval.
 */
export function setWorldFactAmount(
  state: SimulationState,
  factId: string,
  amount: number,
): SimulationState {
  const next = applyWorldFactAmount(state, factId, amount);
  return next === state ? state : planRoutes(next);
}

export function setCharacterValueCharge(
  state: SimulationState,
  instanceId: string,
  valueId: ValueId,
  charge: number,
): SimulationState {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown agent "${instanceId}"`);
  const nextCharge = clamp(charge, -1, 1);
  const summary = `Set ${agent.profile.name}'s ${valueId} charge to ${nextCharge.toFixed(2)}`;
  const entry = interventionEntry(
    state,
    agent,
    summary,
    `value:${valueId}`,
    nextCharge,
    `intervention.characters.${instanceId}.values.${valueId}.charge`,
  );
  return {
    ...state,
    characters: state.characters.map(candidate =>
      candidate.id === instanceId
        ? {
            ...candidate,
            memories: appendBounded(
              candidate.memories,
              { id: entry.id, second: state.second, summary, type: 'intervention' },
              memoryWindow(candidate.tier),
            ),
            values: {
              ...candidate.values,
              [valueId]: { ...candidate.values[valueId], charge: nextCharge },
            },
          }
        : candidate,
    ),
    trace: appendTrace(state.trace, entry),
  };
}

export function setCharacterResource(
  state: SimulationState,
  instanceId: string,
  resourceId: keyof ResourceState,
  amount: number,
): SimulationState {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown agent "${instanceId}"`);
  const nextAmount = clamp(amount, 0, 1);
  const summary = `Set ${agent.profile.name}'s ${resourceId} to ${nextAmount.toFixed(2)}`;
  const entry = interventionEntry(
    state,
    agent,
    summary,
    `resource:${resourceId}`,
    nextAmount,
    `intervention.characters.${instanceId}.resources.${resourceId}`,
  );
  return {
    ...state,
    characters: state.characters.map(candidate =>
      candidate.id === instanceId
        ? { ...candidate, resources: { ...candidate.resources, [resourceId]: nextAmount } }
        : candidate,
    ),
    trace: appendTrace(state.trace, entry),
  };
}
