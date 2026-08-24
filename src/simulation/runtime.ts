import {
  VALUE_IDS,
  type AgendaGoalSeed,
  type CharacterDefinition,
  type CharacterPlacement,
  type EnvironmentDefinition,
  type LocationDefinition,
  type MaskingDemand,
  type PreparedScenario,
  type RecoveryMode,
  type ResourceAddress,
  type ResourceState,
  type ScheduleBlock,
  type SimulationAgent,
  type SimulationSnapshotFile,
  type SimulationState,
  type TraceEntry,
  type ValueId,
  type ValueMap,
  type ValueState,
  type SomaticSourceSeed,
} from '../model/types.js';
import { ScenarioValidationError } from '../model/validation.js';
import { advanceIntentions, intendedTask, prepareAgenda } from './agenda.js';
import { resolveOpportunity } from './decision.js';
import { resolveDisclosureOpportunity } from './disclosure.js';
import { resolveDisplayEvent } from './display.js';
import { advanceCoping, resolveAppraisalEvent } from './coping.js';
import { initializeHistoryDerivedState } from './history.js';
import { resolveIncidentEvent } from './incident.js';
import {
  advanceSomaticState,
  applySomaticResourceTax,
  createSomaticState,
  isDerivedSomaticState,
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
  advanceLayerPosition,
  locationCenter,
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
import { appendTrace, createTrace, traceTerm } from './trace.js';

const DAY_MINUTES = 1440;
const MAX_MEMORIES = 16;
const MAX_TRACE_ENTRIES = 240;

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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function sameAddress(left: ResourceAddress, right: ResourceAddress): boolean {
  return (
    left.kind === right.kind &&
    left.packageId === right.packageId &&
    left.resourceId === right.resourceId
  );
}

function sameResourceLock(
  left: readonly ResourceAddress[],
  right: readonly ResourceAddress[],
): boolean {
  return (
    left.length === right.length &&
    left.every((address, index) => {
      const candidate = right[index];
      return candidate !== undefined && sameAddress(address, candidate);
    })
  );
}

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

function activeScheduleBlock(schedule: ScheduleBlock[], minute: number): ScheduleBlock {
  const minuteOfDay = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  let active = schedule[schedule.length - 1];
  for (const block of schedule) {
    if (block.startMinute > minuteOfDay) break;
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
  minute: number,
  ambientSomaticSources: readonly SomaticSourceSeed[],
): SimulationAgent {
  const block = activeScheduleBlock(placement.schedule, minute);
  const destination = locationCenter(findLocation(environment, block.locationId));
  const arrived = sameLayerPosition(placement.position, destination);
  const formative = initializeHistoryDerivedState(profile);
  const normInternalizations = Object.fromEntries(
    placement.normPerspectives.map(perspective => [
      `${perspective.norm.packageId}:${perspective.norm.kind}:${perspective.norm.resourceId}`,
      perspective.internalization,
    ]),
  );
  const agent: SimulationAgent = {
    cascade: 'none',
    cascadeDwellUntilMinute: minute,
    cascadeLoad: 0,
    cascadeTargetId: null,
    currentOutlet: null,
    currentActivity: arrived
      ? block.activity
      : `Walking to ${findLocation(environment, block.locationId).name}`,
    currentLocationId: arrived ? block.locationId : null,
    destination,
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
    resources: { ...DEFAULT_RESOURCES, ...placement.initialResources },
    schedule: placement.schedule.map(scheduleBlock => ({ ...scheduleBlock })),
    somatic: createSomaticState([
      ...ambientSomaticSources.map(source => ({ ...source })),
      ...placement.initialSomaticSources.map(source => ({ ...source })),
    ]),
    values: initialValues(profile, placement),
    walkingMetersPerMinute: applyBuildToWalkingPace(
      placement.walkingMetersPerMinute ?? DEFAULT_WALKING_METERS_PER_MINUTE,
      profile.physical.build,
    ),
  };
  agent.currentActivity = somaticActivityLabel(agent.somatic) ?? agent.currentActivity;
  if (placement.agency === 'responder') return agent;
  const narrative = createNarrativeState(agent, minute);
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

function goalSeedSignature(goal: AgendaGoalSeed): string {
  return JSON.stringify({
    activationMinute: goal.activationMinute,
    actorId: goal.actorId,
    claimExpressions: goal.claimExpressions,
    commitment: goal.commitment,
    deadlineMinute: goal.deadlineMinute,
    desired: goal.desired,
    failureTurns: goal.failureTurns,
    id: goal.id,
    label: goal.label,
    source: goal.source,
    successTurns: goal.successTurns,
    urgencyHorizonMinutes: goal.urgencyHorizonMinutes,
  });
}

export function createSimulationFromPrepared(prepared: PreparedScenario): SimulationState {
  const environment = prepared.environment;
  const agents = prepared.characters.map(({ placement, profile }) =>
    initializeAgent(
      profile,
      placement,
      environment,
      prepared.scenario.startMinute,
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
      resolvedMinute: null,
      status: 'pending',
      successTurns: { ...goal.successTurns },
    })),
    agents,
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
    minute: prepared.scenario.startMinute,
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
    trace: createTrace([
      {
        agentId: null,
        id: '0:scenario',
        kind: 'scenario',
        minute: prepared.scenario.startMinute,
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
  return prepareAgenda(prepareNarrativeAgency(initial));
}

export function createSimulationFromPreparedSnapshot(input: {
  prepared: PreparedScenario;
  snapshot: SimulationSnapshotFile;
}): SimulationState {
  const snapshot = input.snapshot;
  const base = createSimulationFromPrepared(input.prepared);
  if (!sameAddress(snapshot.environment, base.scenario.environment)) {
    throw new ScenarioValidationError(
      'snapshot.environment',
      'must match the prepared environment layout',
    );
  }
  if (!sameResourceLock(snapshot.resourceLock.resources, base.resourceLock.resources)) {
    throw new ScenarioValidationError(
      'snapshot.resourceLock',
      'must match the prepared resource lock',
    );
  }
  const baseAgents = new Map(base.agents.map(agent => [agent.id, agent]));
  if (snapshot.agents.length !== base.agents.length) {
    throw new ScenarioValidationError(
      'snapshot.agents',
      'must contain exactly the scenario agent instances',
    );
  }
  const locationIds = new Set(base.environment.locations.map(location => location.id));
  const layerIds = new Set(base.environment.layers.map(layer => layer.id));
  const agents = snapshot.agents.map((saved, index) => {
    const agent = baseAgents.get(saved.id);
    if (agent === undefined) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].id`,
        `unknown agent "${saved.id}"`,
      );
    }
    const placement = base.scenario.characters.find(item => item.instanceId === saved.id);
    if (placement === undefined || !sameAddress(saved.profile, placement.profile)) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].profile`,
        `expected character profile "${agent.profile.profileId}"`,
      );
    }
    if (saved.currentLocationId !== null && !locationIds.has(saved.currentLocationId)) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].currentLocationId`,
        `unknown location "${saved.currentLocationId}"`,
      );
    }
    if (!layerIds.has(saved.position.layerId)) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].position.layerId`,
        `unknown layer "${saved.position.layerId}"`,
      );
    }
    if (!layerIds.has(saved.destination.layerId)) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].destination.layerId`,
        `unknown layer "${saved.destination.layerId}"`,
      );
    }
    saved.schedule.forEach((block, blockIndex) => {
      if (!locationIds.has(block.locationId)) {
        throw new ScenarioValidationError(
          `snapshot.agents[${index}].schedule[${blockIndex}].locationId`,
          `unknown location "${block.locationId}"`,
        );
      }
    });
    if (
      saved.history.formativeRecords.length > 0 &&
      JSON.stringify(saved.history.formativeRecords) !==
        JSON.stringify(agent.history.formativeRecords)
    ) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].history.formativeRecords`,
        'must match formative execution for the prepared character profile',
      );
    }
    const empathyOverride = saved.history.overrides.empathy;
    const effectiveFloor = empathyOverride?.floor ?? agent.profile.empathy.floor;
    const effectiveCeiling = empathyOverride?.ceiling ?? agent.profile.empathy.ceiling;
    if (effectiveCeiling < effectiveFloor) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].history.overrides.empathy.ceiling`,
        'expected effective ceiling at or above effective floor',
      );
    }
    if (!isDerivedSomaticState(saved.somatic)) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].somatic`,
        'must match its exact sorted somatic source ledger',
      );
    }
    return {
      cascade: saved.cascade,
      cascadeDwellUntilMinute: saved.cascadeDwellUntilMinute,
      cascadeLoad: saved.cascadeLoad,
      cascadeTargetId: saved.cascadeTargetId,
      currentOutlet: saved.currentOutlet === null ? null : { ...saved.currentOutlet },
      currentActivity: saved.currentActivity,
      currentLocationId: saved.currentLocationId,
      destination: { ...saved.destination },
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
      schedule: saved.schedule.map(block => ({ ...block })),
      somatic: structuredClone(saved.somatic),
      values: Object.fromEntries(
        VALUE_IDS.map(valueId => [valueId, { ...saved.values[valueId] }]),
      ) as ValueMap<ValueState>,
      walkingMetersPerMinute: saved.walkingMetersPerMinute,
    };
  });
  const agentIds = new Set(agents.map(agent => agent.id));
  const outletAffordanceIds = new Set(base.environment.outletAffordances.map(item => item.id));
  snapshot.agents.forEach((saved, index) => {
    if (saved.cascadeTargetId !== null && !agentIds.has(saved.cascadeTargetId)) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].cascadeTargetId`,
        `unknown agent "${saved.cascadeTargetId}"`,
      );
    }
    if (
      saved.currentOutlet !== null &&
      !outletAffordanceIds.has(saved.currentOutlet.affordanceId)
    ) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].currentOutlet.affordanceId`,
        `unknown outlet affordance "${saved.currentOutlet.affordanceId}"`,
      );
    }
    if (saved.narrative !== null) {
      const profileClaimIds = new Set(
        agents[index]?.profile.narrativeClaims.map(claim => claim.id),
      );
      if (
        saved.narrative.claims.length !== profileClaimIds.size ||
        saved.narrative.claims.some(claim => !profileClaimIds.has(claim.id))
      ) {
        throw new ScenarioValidationError(
          `snapshot.agents[${index}].narrative.claims`,
          'must contain exactly the character narrative claims',
        );
      }
    }
    saved.positionalRespect.references.forEach((reference, referenceIndex) => {
      if (!agentIds.has(reference.subjectId) || reference.subjectId === saved.id) {
        throw new ScenarioValidationError(
          `snapshot.agents[${index}].positionalRespect.references[${referenceIndex}].subjectId`,
          'positional reference must name another snapshot agent',
        );
      }
    });
  });
  snapshot.dyads.forEach((dyad, index) => {
    if (!agentIds.has(dyad.observerId) || !agentIds.has(dyad.subjectId)) {
      throw new ScenarioValidationError(
        `snapshot.dyads[${index}]`,
        'dyad must reference snapshot agents',
      );
    }
  });
  const observationEvents = new Map(
    snapshot.scenario.observationEvents.map(event => [event.id, event]),
  );
  const observationEventIds = new Set(observationEvents.keys());
  snapshot.observations.forEach((observation, index) => {
    const event = observationEvents.get(observation.eventId);
    if (
      !agentIds.has(observation.observerId) ||
      !agentIds.has(observation.subjectId) ||
      event === undefined
    ) {
      throw new ScenarioValidationError(
        `snapshot.observations[${index}]`,
        'observation must reference snapshot agents and an authored event',
      );
    }
    if (event.eventType !== observation.eventType) {
      throw new ScenarioValidationError(
        `snapshot.observations[${index}].eventType`,
        'must match the authored observation event type',
      );
    }
  });
  snapshot.resolvedObservationEventIds.forEach((eventId, index) => {
    if (!observationEventIds.has(eventId)) {
      throw new ScenarioValidationError(
        `snapshot.resolvedObservationEventIds[${index}]`,
        `unknown observation event "${eventId}"`,
      );
    }
  });
  const incidentEventIds = new Set(snapshot.scenario.incidentEvents.map(event => event.id));
  snapshot.incidentRecords.forEach((record, index) => {
    if (!incidentEventIds.has(record.eventId) || !agentIds.has(record.observerId)) {
      throw new ScenarioValidationError(
        `snapshot.incidentRecords[${index}]`,
        'incident record must reference a snapshot agent and authored event',
      );
    }
  });
  snapshot.resolvedIncidentEventIds.forEach((eventId, index) => {
    if (!incidentEventIds.has(eventId)) {
      throw new ScenarioValidationError(
        `snapshot.resolvedIncidentEventIds[${index}]`,
        `unknown incident event "${eventId}"`,
      );
    }
  });
  const displayEventIds = new Set(snapshot.scenario.displayEvents.map(event => event.id));
  const displayIds = new Set(snapshot.scenario.displayEvents.map(event => event.displayId));
  snapshot.displayRecords.forEach((record, index) => {
    if (
      !displayEventIds.has(record.eventId) ||
      !agentIds.has(record.wearerId) ||
      record.appraisals.some(
        appraisal => appraisal.eventId !== record.eventId || !agentIds.has(appraisal.observerId),
      )
    ) {
      throw new ScenarioValidationError(
        `snapshot.displayRecords[${index}]`,
        'display record must reference snapshot agents and an authored event',
      );
    }
  });
  snapshot.displayExposures.forEach((exposure, index) => {
    if (!agentIds.has(exposure.observerId) || !displayIds.has(exposure.displayId)) {
      throw new ScenarioValidationError(
        `snapshot.displayExposures[${index}]`,
        'display exposure must reference a snapshot agent and authored display',
      );
    }
  });
  snapshot.resolvedDisplayEventIds.forEach((eventId, index) => {
    if (!displayEventIds.has(eventId)) {
      throw new ScenarioValidationError(
        `snapshot.resolvedDisplayEventIds[${index}]`,
        `unknown display event "${eventId}"`,
      );
    }
  });
  const somaticEventIds = new Set(snapshot.scenario.somaticEvents.map(event => event.id));
  snapshot.somaticRecords.forEach((record, index) => {
    if (
      !somaticEventIds.has(record.eventId) ||
      !agentIds.has(record.subjectId) ||
      record.observations.some(
        observation =>
          observation.eventId !== record.eventId ||
          observation.subjectId !== record.subjectId ||
          !agentIds.has(observation.observerId),
      )
    ) {
      throw new ScenarioValidationError(
        `snapshot.somaticRecords[${index}]`,
        'somatic record must reference snapshot agents and an authored event',
      );
    }
  });
  snapshot.resolvedSomaticEventIds.forEach((eventId, index) => {
    if (!somaticEventIds.has(eventId)) {
      throw new ScenarioValidationError(
        `snapshot.resolvedSomaticEventIds[${index}]`,
        `unknown somatic event "${eventId}"`,
      );
    }
  });
  const relationshipEventIds = new Set(snapshot.scenario.relationshipEvents.map(event => event.id));
  snapshot.resolvedRelationshipEventIds.forEach((eventId, index) => {
    if (!relationshipEventIds.has(eventId)) {
      throw new ScenarioValidationError(
        `snapshot.resolvedRelationshipEventIds[${index}]`,
        `unknown relationship event "${eventId}"`,
      );
    }
  });
  const relationshipRequestIds = new Set(
    snapshot.scenario.relationshipRequests.map(request => request.id),
  );
  snapshot.resolvedRelationshipRequestIds.forEach((requestId, index) => {
    if (!relationshipRequestIds.has(requestId)) {
      throw new ScenarioValidationError(
        `snapshot.resolvedRelationshipRequestIds[${index}]`,
        `unknown relationship request "${requestId}"`,
      );
    }
  });
  snapshot.relationshipDecisions.forEach((decision, index) => {
    if (!agentIds.has(decision.requesterId) || !agentIds.has(decision.responderId)) {
      throw new ScenarioValidationError(
        `snapshot.relationshipDecisions[${index}]`,
        'relationship decision must reference snapshot agents',
      );
    }
  });
  const appraisalEventIds = new Set(snapshot.scenario.appraisalEvents.map(event => event.id));
  snapshot.resolvedAppraisalEventIds.forEach((eventId, index) => {
    if (!appraisalEventIds.has(eventId)) {
      throw new ScenarioValidationError(
        `snapshot.resolvedAppraisalEventIds[${index}]`,
        `unknown appraisal event "${eventId}"`,
      );
    }
  });
  snapshot.appraisalRecords.forEach((record, index) => {
    if (!agentIds.has(record.agentId) || !appraisalEventIds.has(record.eventId)) {
      throw new ScenarioValidationError(
        `snapshot.appraisalRecords[${index}]`,
        'appraisal record must reference a snapshot agent and authored event',
      );
    }
  });
  const narrativeEventIds = new Set(snapshot.scenario.narrativeEvents.map(event => event.id));
  snapshot.resolvedNarrativeEventIds.forEach((eventId, index) => {
    if (!narrativeEventIds.has(eventId)) {
      throw new ScenarioValidationError(
        `snapshot.resolvedNarrativeEventIds[${index}]`,
        `unknown narrative event "${eventId}"`,
      );
    }
  });
  snapshot.narrativeRecords.forEach((record, index) => {
    if (!agentIds.has(record.actorId) || !narrativeEventIds.has(record.eventId)) {
      throw new ScenarioValidationError(
        `snapshot.narrativeRecords[${index}]`,
        'narrative record must reference a snapshot agent and authored event',
      );
    }
  });
  const reputationGroupIds = new Set(snapshot.scenario.reputationGroups.map(group => group.id));
  snapshot.reputations.forEach((reputation, index) => {
    if (
      !agentIds.has(reputation.subjectId) ||
      reputation.sourceIds.some(sourceId => !agentIds.has(sourceId)) ||
      (reputation.audienceType === 'agent' && !agentIds.has(reputation.audienceId)) ||
      (reputation.audienceType === 'group' && !reputationGroupIds.has(reputation.audienceId))
    ) {
      throw new ScenarioValidationError(
        `snapshot.reputations[${index}]`,
        'reputation must reference snapshot agents and an authored audience',
      );
    }
  });
  const aspirationOpportunityIds = new Set(
    snapshot.scenario.aspirationOpportunities.map(opportunity => opportunity.id),
  );
  snapshot.resolvedAspirationOpportunityIds.forEach((opportunityId, index) => {
    if (!aspirationOpportunityIds.has(opportunityId)) {
      throw new ScenarioValidationError(
        `snapshot.resolvedAspirationOpportunityIds[${index}]`,
        `unknown aspiration opportunity "${opportunityId}"`,
      );
    }
  });
  snapshot.disclosureItems.forEach((item, index) => {
    if (!agentIds.has(item.ownerId) || item.knownByIds.some(id => !agentIds.has(id))) {
      throw new ScenarioValidationError(
        `snapshot.disclosureItems[${index}]`,
        'disclosure item must reference snapshot agents',
      );
    }
  });
  const scenarioGoals = new Map(snapshot.scenario.agendaGoals.map(goal => [goal.id, goal]));
  const aspirationGoals = new Map(
    snapshot.scenario.aspirationOpportunities
      .filter(opportunity => snapshot.resolvedAspirationOpportunityIds.includes(opportunity.id))
      .map(opportunity => [opportunity.id, opportunity]),
  );
  if (snapshot.agendaGoals.length !== scenarioGoals.size + aspirationGoals.size) {
    throw new ScenarioValidationError(
      'snapshot.agendaGoals',
      'must contain exactly the authored and generated aspiration goals',
    );
  }
  snapshot.agendaGoals.forEach((goal, index) => {
    const scenarioGoal = scenarioGoals.get(goal.id);
    const aspiration = aspirationGoals.get(goal.id);
    const aspirationMatches =
      aspiration !== undefined &&
      goal.source === 'aspiration' &&
      goal.actorId === aspiration.actorId &&
      goal.activationMinute >= aspiration.atMinute &&
      goal.commitment === aspiration.commitment &&
      goal.deadlineMinute === aspiration.deadlineMinute &&
      JSON.stringify(goal.claimExpressions) === JSON.stringify(aspiration.claimExpressions) &&
      JSON.stringify(goal.desired) === JSON.stringify(aspiration.desired) &&
      JSON.stringify(goal.failureTurns) === JSON.stringify(aspiration.failureTurns) &&
      goal.label === aspiration.label &&
      JSON.stringify(goal.successTurns) === JSON.stringify(aspiration.successTurns) &&
      goal.urgencyHorizonMinutes === aspiration.urgencyHorizonMinutes;
    if (
      (scenarioGoal === undefined || goalSeedSignature(goal) !== goalSeedSignature(scenarioGoal)) &&
      !aspirationMatches
    ) {
      throw new ScenarioValidationError(
        `snapshot.agendaGoals[${index}]`,
        'goal seed must match authored scenario or resolved aspiration opportunity',
      );
    }
    const resolved = goal.status === 'completed' || goal.status === 'failed';
    if (resolved !== (goal.resolvedMinute !== null)) {
      throw new ScenarioValidationError(
        `snapshot.agendaGoals[${index}].resolvedMinute`,
        'must be present exactly when the goal is resolved',
      );
    }
  });
  const scenarioFactIds = new Set(snapshot.scenario.worldFacts.map(fact => fact.id));
  if (
    snapshot.worldFacts.length !== snapshot.scenario.worldFacts.length ||
    snapshot.worldFacts.some(fact => !scenarioFactIds.has(fact.id))
  ) {
    throw new ScenarioValidationError(
      'snapshot.worldFacts',
      'must contain exactly the scenario world facts',
    );
  }
  const tasks = new Map(snapshot.scenario.taskOperators.map(task => [task.id, task]));
  const plans = new Map(snapshot.plans.map(plan => [plan.id, plan]));
  if (plans.size !== snapshot.plans.length) {
    throw new ScenarioValidationError('snapshot.plans', 'duplicate plan identifier');
  }
  const planActors = new Set<string>();
  snapshot.plans.forEach((plan, index) => {
    const goal = snapshot.agendaGoals.find(candidate => candidate.id === plan.goalId);
    if (goal === undefined || goal.actorId !== plan.actorId || !agentIds.has(plan.actorId)) {
      throw new ScenarioValidationError(
        `snapshot.plans[${index}]`,
        'plan must belong to a snapshot agent and goal',
      );
    }
    if (planActors.has(plan.actorId)) {
      throw new ScenarioValidationError(
        `snapshot.plans[${index}].actorId`,
        'an agent may have only one active plan',
      );
    }
    planActors.add(plan.actorId);
    plan.taskIds.forEach((taskId, taskIndex) => {
      const task = tasks.get(taskId);
      if (task === undefined || !task.actorIds.includes(plan.actorId)) {
        throw new ScenarioValidationError(
          `snapshot.plans[${index}].taskIds[${taskIndex}]`,
          'task must be available to the plan actor',
        );
      }
    });
  });
  const intentionActors = new Set<string>();
  snapshot.intentions.forEach((intention, index) => {
    const plan = plans.get(intention.planId);
    if (
      plan === undefined ||
      plan.actorId !== intention.actorId ||
      plan.goalId !== intention.goalId ||
      plan.taskIds[0] !== intention.taskId
    ) {
      throw new ScenarioValidationError(
        `snapshot.intentions[${index}]`,
        'intention must match the first task of its active plan',
      );
    }
    if (intentionActors.has(intention.actorId)) {
      throw new ScenarioValidationError(
        `snapshot.intentions[${index}].actorId`,
        'an agent may have only one active intention',
      );
    }
    intentionActors.add(intention.actorId);
  });
  if (snapshot.plans.length !== snapshot.intentions.length) {
    throw new ScenarioValidationError(
      'snapshot.intentions',
      'each active plan must have exactly one intention',
    );
  }
  snapshot.agendaDecisions.forEach((decision, index) => {
    if (!agentIds.has(decision.actorId)) {
      throw new ScenarioValidationError(
        `snapshot.agendaDecisions[${index}].actorId`,
        `unknown agent "${decision.actorId}"`,
      );
    }
  });

  return {
    ...base,
    appraisalRecords: snapshot.appraisalRecords,
    agendaDecisions: snapshot.agendaDecisions,
    agendaGoals: snapshot.agendaGoals,
    agents,
    decisions: snapshot.decisions,
    disclosureDecisions: snapshot.disclosureDecisions,
    disclosureItems: snapshot.disclosureItems,
    displayExposures: snapshot.displayExposures,
    displayRecords: snapshot.displayRecords,
    dyads: snapshot.dyads,
    incidentRecords: snapshot.incidentRecords,
    intentions: snapshot.intentions,
    minute: snapshot.minute,
    narrativeRecords: snapshot.narrativeRecords,
    observations: snapshot.observations,
    plans: snapshot.plans,
    relationshipDecisions: snapshot.relationshipDecisions,
    reputations: snapshot.reputations,
    resolvedDisclosureOpportunityIds: snapshot.resolvedDisclosureOpportunityIds,
    resolvedDisplayEventIds: snapshot.resolvedDisplayEventIds,
    resolvedIncidentEventIds: snapshot.resolvedIncidentEventIds,
    resolvedObservationEventIds: snapshot.resolvedObservationEventIds,
    resolvedOpportunityIds: snapshot.resolvedOpportunityIds,
    resolvedAppraisalEventIds: snapshot.resolvedAppraisalEventIds,
    resolvedAspirationOpportunityIds: snapshot.resolvedAspirationOpportunityIds,
    resolvedNarrativeEventIds: snapshot.resolvedNarrativeEventIds,
    resolvedRelationshipEventIds: snapshot.resolvedRelationshipEventIds,
    resolvedRelationshipRequestIds: snapshot.resolvedRelationshipRequestIds,
    resolvedSomaticEventIds: snapshot.resolvedSomaticEventIds,
    somaticRecords: snapshot.somaticRecords,
    tick: snapshot.tick,
    trace: snapshot.trace,
    worldFacts: snapshot.worldFacts,
    worldRevision: snapshot.worldRevision,
  };
}

function appendBounded<Item>(items: Item[], item: Item, maximum: number): Item[] {
  const next = [...items, item];
  return next.length <= maximum ? next : next.slice(next.length - maximum);
}

function advanceValueState(
  state: ValueState,
  turnPerHour: number,
  tickMinutes: number,
): ValueState {
  const charge = clamp(state.charge + (turnPerHour * tickMinutes) / 60, -1, 1);
  const dayFraction = tickMinutes / DAY_MINUTES;
  const deficitIntegral = clamp(
    state.deficitIntegral +
      (charge < 0 ? -charge * dayFraction : -Math.min(charge, 0.25) * dayFraction * 0.08),
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
  recoveryMinutes: number,
  drainMinutes: number,
  drainsPerHour: Partial<ResourceState>,
): ResourceRecoveryResult {
  const rates = RECOVERY_RATES_PER_HOUR[recoveryMode];
  const next = {} as ResourceState;
  const deltas = {} as ResourceState;
  for (const resourceId of RESOURCE_IDS) {
    next[resourceId] = clamp(
      resources[resourceId] +
        (rates[resourceId] * recoveryMinutes) / 60 -
        ((drainsPerHour[resourceId] ?? 0) * drainMinutes) / 60,
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

interface AgentAdvanceResult {
  agent: SimulationAgent;
  plasticitySignals: BaselinePlasticitySignal[];
  sleeping: boolean;
  trace: TraceEntry[];
}

function advanceAgent(
  state: SimulationState,
  agent: SimulationAgent,
  nextMinute: number,
  nextTick: number,
): AgentAdvanceResult {
  const intention = state.intentions.find(candidate => candidate.actorId === agent.id);
  const task = intendedTask(state, agent.id);
  const block = task === null ? activeScheduleBlock(agent.schedule, nextMinute) : null;
  const locationId = task?.locationId ?? block?.locationId;
  if (locationId === undefined)
    throw new Error('An agent always has a task or schedule destination');
  const location = findLocation(state.environment, locationId);
  const preempted = agent.somatic.level >= 3;
  const destination = preempted ? agent.position : locationCenter(location);
  const remaining = preempted
    ? 0
    : navigationDistance(state.environment, agent.position, destination);
  const travel = agent.walkingMetersPerMinute * state.scenario.tickMinutes;
  const position = preempted
    ? agent.position
    : advanceLayerPosition(state.environment, agent.position, destination, travel);
  const arrived = !preempted && sameLayerPosition(position, destination);
  const currentActivity = preempted
    ? agent.currentActivity
    : arrived
      ? task === null
        ? (block?.activity ?? agent.currentActivity)
        : intention?.phase === 'waiting'
          ? `Waiting to ${task.label.toLowerCase()}`
          : task.label
      : `Walking to ${location.name}${task === null ? '' : ` to ${task.label.toLowerCase()}`}`;
  const currentLocationId = preempted ? agent.currentLocationId : arrived ? locationId : null;
  const values = {} as ValueMap<ValueState>;
  for (const valueId of VALUE_IDS) {
    values[valueId] = advanceValueState(
      agent.values[valueId],
      state.scenario.ambientTurnsPerHour?.[valueId] ?? 0,
      state.scenario.tickMinutes,
    );
  }
  const scheduleRecoveryMode = task === null && arrived ? (block?.recoveryMode ?? 'none') : 'none';
  const taskRecoveryMode =
    task !== null && arrived && intention?.phase === 'work' ? task.recoveryMode : 'none';
  const recoveryMode = task === null ? scheduleRecoveryMode : taskRecoveryMode;
  const arrivalMinutes = remaining / agent.walkingMetersPerMinute;
  const recoveryMinutes =
    recoveryMode === 'none'
      ? 0
      : task === null
        ? clamp(state.scenario.tickMinutes - arrivalMinutes, 0, state.scenario.tickMinutes)
        : state.scenario.tickMinutes;
  const authoredDrains = arrived
    ? (task?.resourceDrainsPerHour ?? block?.resourceDrainsPerHour ?? {})
    : {};
  const activeMasking = arrived ? (task?.maskingDemand ?? block?.maskingDemand ?? null) : null;
  const drains = combinedResourceDrains(authoredDrains, maskingDrains(activeMasking));
  const activeMinutes = arrived ? state.scenario.tickMinutes : 0;
  const recovery = advanceResources(
    agent.resources,
    recoveryMode,
    recoveryMinutes,
    activeMinutes,
    drains,
  );
  const somatic = advanceSomaticState(agent.somatic, state.scenario.tickMinutes);
  const resources = applySomaticResourceTax(
    recovery.resources,
    somatic,
    state.scenario.tickMinutes,
  );
  const recoverySource =
    task === null
      ? `agents.${agent.id}.schedule.recoveryMode`
      : `scenario.taskOperators.${task.id}.recoveryMode`;
  const plasticitySignals: BaselinePlasticitySignal[] = [];
  if (agent.currentOutlet !== null) {
    plasticitySignals.push({
      gap: agent.currentOutlet.yield,
      mechanism: 'outlet-promotion',
      source: `agents.${agent.id}.currentOutlet`,
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
  const trace: TraceEntry[] = [];
  if (somatic.attentionTax > 0) {
    trace.push({
      agentId: agent.id,
      id: `${nextTick}:${agent.id}:somatic`,
      kind: 'somatic',
      minute: nextMinute,
      selection: null,
      summary: `${agent.profile.name} carries a somatic attention tax`,
      terms: [
        traceTerm('attention-tax', somatic.attentionTax, `agents.${agent.id}.somatic.sources`),
        traceTerm(
          'executive-budget',
          resources.executiveBudget,
          `agents.${agent.id}.resources.executiveBudget`,
        ),
        traceTerm('level', somatic.level, `agents.${agent.id}.somatic.level`),
      ],
      tick: nextTick,
    });
  }
  if (currentActivity !== agent.currentActivity) {
    const summary = `${agent.profile.name}: ${currentActivity}`;
    memories = appendBounded(
      memories,
      { id: `${nextTick}:${agent.id}:activity`, minute: nextMinute, summary, type: 'activity' },
      MAX_MEMORIES,
    );
    trace.push({
      agentId: agent.id,
      id: `${nextTick}:${agent.id}:activity`,
      kind: 'activity',
      minute: nextMinute,
      selection: null,
      summary,
      terms:
        task === null
          ? [
              traceTerm('schedule', block?.startMinute ?? 0, `agents.${agent.id}.schedule`),
              traceTerm('location', locationId, `environment.locations.${locationId}`),
              traceTerm('recovery-mode', recoveryMode, `agents.${agent.id}.schedule.recoveryMode`),
            ]
          : [
              traceTerm('intention', task.id, `intentions.${agent.id}`),
              traceTerm('location', locationId, `environment.locations.${locationId}`),
              traceTerm('recovery-mode', task.recoveryMode, recoverySource),
            ],
      tick: nextTick,
    });
  }

  const previousHour = Math.floor(state.minute / 60);
  const nextHour = Math.floor(nextMinute / 60);
  if (previousHour !== nextHour) {
    const activeTurns = VALUE_IDS.filter(
      valueId => (state.scenario.ambientTurnsPerHour?.[valueId] ?? 0) !== 0,
    );
    if (activeTurns.length > 0) {
      trace.push({
        agentId: agent.id,
        id: `${nextTick}:${agent.id}:ambient`,
        kind: 'value-turn',
        minute: nextMinute,
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
        agentId: agent.id,
        id: `${nextTick}:${agent.id}:resource`,
        kind: 'resource',
        minute: nextMinute,
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
                ? `agents.${agent.id}.schedule.resourceDrainsPerHour`
                : `scenario.taskOperators.${task.id}.resourceDrainsPerHour`,
            ),
          ),
          ...RESOURCE_IDS.map(resourceId =>
            traceTerm(
              `resource:${resourceId}`,
              resources[resourceId],
              `agents.${agent.id}.resources.${resourceId}`,
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
      currentActivity,
      currentLocationId,
      destination,
      memories,
      position,
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
  agent: SimulationAgent,
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

function dueDuringTick<Event extends { atMinute: number; id: string }>(
  events: readonly Event[],
  currentMinute: number,
  nextMinute: number,
  resolvedIds: readonly string[],
): Event[] {
  return events.filter(
    event =>
      event.atMinute >= currentMinute &&
      event.atMinute <= nextMinute &&
      !resolvedIds.includes(event.id),
  );
}

function advanceOneTick(state: SimulationState): SimulationState {
  const prepared = prepareAgenda(prepareNarrativeAgency(state));
  const nextTick = prepared.tick + 1;
  const nextMinute = prepared.minute + prepared.scenario.tickMinutes;
  const results = prepared.agents.map(agent => advanceAgent(prepared, agent, nextMinute, nextTick));
  let trace = prepared.trace;
  for (const result of results) {
    for (const entry of result.trace) trace = appendTrace(trace, entry, MAX_TRACE_ENTRIES);
  }
  let next: SimulationState = {
    ...prepared,
    agents: results.map(result => result.agent),
    minute: nextMinute,
    tick: nextTick,
    trace,
  };
  const dueSomaticEvents = dueDuringTick(
    prepared.scenario.somaticEvents,
    prepared.minute,
    nextMinute,
    prepared.resolvedSomaticEventIds,
  );
  for (const event of dueSomaticEvents) next = resolveSomaticEvent(next, event);
  if (dueSomaticEvents.length > 0) next = prepareAgenda(next);
  next = advanceIntentions(next);
  const dueOpportunities = dueDuringTick(
    prepared.scenario.behaviorOpportunities,
    prepared.minute,
    nextMinute,
    prepared.resolvedOpportunityIds,
  );
  for (const opportunity of dueOpportunities) next = resolveOpportunity(next, opportunity);
  const dueDisclosureOpportunities = dueDuringTick(
    prepared.scenario.disclosureOpportunities,
    prepared.minute,
    nextMinute,
    prepared.resolvedDisclosureOpportunityIds,
  );
  for (const opportunity of dueDisclosureOpportunities) {
    next = resolveDisclosureOpportunity(next, opportunity);
  }
  const dueObservationEvents = dueDuringTick(
    prepared.scenario.observationEvents,
    prepared.minute,
    nextMinute,
    prepared.resolvedObservationEventIds,
  );
  for (const event of dueObservationEvents) next = resolveObservationEvent(next, event);
  const dueIncidentEvents = dueDuringTick(
    prepared.scenario.incidentEvents,
    prepared.minute,
    nextMinute,
    prepared.resolvedIncidentEventIds,
  );
  for (const event of dueIncidentEvents) next = resolveIncidentEvent(next, event);
  const dueDisplayEvents = dueDuringTick(
    prepared.scenario.displayEvents,
    prepared.minute,
    nextMinute,
    prepared.resolvedDisplayEventIds,
  );
  for (const event of dueDisplayEvents) next = resolveDisplayEvent(next, event);
  const dueRelationshipEvents = dueDuringTick(
    prepared.scenario.relationshipEvents,
    prepared.minute,
    nextMinute,
    prepared.resolvedRelationshipEventIds,
  );
  for (const event of dueRelationshipEvents) next = resolveRelationshipEvent(next, event);
  const dueRelationshipRequests = dueDuringTick(
    prepared.scenario.relationshipRequests,
    prepared.minute,
    nextMinute,
    prepared.resolvedRelationshipRequestIds,
  );
  for (const request of dueRelationshipRequests) next = resolveRelationshipRequest(next, request);
  const dueAppraisalEvents = dueDuringTick(
    prepared.scenario.appraisalEvents,
    prepared.minute,
    nextMinute,
    prepared.resolvedAppraisalEventIds,
  );
  for (const event of dueAppraisalEvents) next = resolveAppraisalEvent(next, event);
  const dueNarrativeEvents = dueDuringTick(
    prepared.scenario.narrativeEvents,
    prepared.minute,
    nextMinute,
    prepared.resolvedNarrativeEventIds,
  );
  for (const event of dueNarrativeEvents) next = resolveNarrativeEvent(next, event);
  next = consolidateRelationshipMemories(
    next,
    results.filter(result => result.sleeping).map(result => result.agent.id),
  );
  next = advanceCoping(next);
  const signalsByAgent = new Map(
    results.map(result => [result.agent.id, result.plasticitySignals]),
  );
  return {
    ...next,
    agents: next.agents.map(agent =>
      advanceBaselinePlasticity(agent, {
        elapsedMinutes: next.scenario.tickMinutes,
        minute: next.minute,
        originMinute: next.scenario.startMinute,
        signals: [
          ...(signalsByAgent.get(agent.id) ?? []),
          ...rupturePlasticitySignals(next, agent),
        ],
      }),
    ),
  };
}

export function advanceSimulation(state: SimulationState, ticks = 1): SimulationState {
  if (!Number.isInteger(ticks) || ticks < 0)
    throw new RangeError('ticks must be a non-negative integer');
  let next = state;
  for (let index = 0; index < ticks; index += 1) next = advanceOneTick(next);
  return next;
}

function interventionEntry(
  state: SimulationState,
  agent: SimulationAgent,
  summary: string,
  termId: string,
  value: number,
  source: string,
): TraceEntry {
  const idPrefix = `${state.tick}:${agent.id}:intervention:`;
  let ordinal = 0;
  for (const entry of state.trace.entries) {
    if (!entry.id.startsWith(idPrefix)) continue;
    const candidate = Number(entry.id.slice(idPrefix.length));
    if (Number.isInteger(candidate) && candidate >= ordinal) ordinal = candidate + 1;
  }
  return {
    agentId: agent.id,
    id: `${idPrefix}${ordinal}`,
    kind: 'intervention',
    minute: state.minute,
    selection: null,
    summary,
    terms: [traceTerm(termId, value, source)],
    tick: state.tick,
  };
}

export function setAgentValueCharge(
  state: SimulationState,
  agentId: string,
  valueId: ValueId,
  charge: number,
): SimulationState {
  const agent = state.agents.find(candidate => candidate.id === agentId);
  if (agent === undefined) throw new RangeError(`Unknown agent "${agentId}"`);
  const nextCharge = clamp(charge, -1, 1);
  const summary = `Set ${agent.profile.name}'s ${valueId} charge to ${nextCharge.toFixed(2)}`;
  const entry = interventionEntry(
    state,
    agent,
    summary,
    `value:${valueId}`,
    nextCharge,
    `intervention.agents.${agentId}.values.${valueId}.charge`,
  );
  return {
    ...state,
    agents: state.agents.map(candidate =>
      candidate.id === agentId
        ? {
            ...candidate,
            memories: appendBounded(
              candidate.memories,
              { id: entry.id, minute: state.minute, summary, type: 'intervention' },
              MAX_MEMORIES,
            ),
            values: {
              ...candidate.values,
              [valueId]: { ...candidate.values[valueId], charge: nextCharge },
            },
          }
        : candidate,
    ),
    trace: appendTrace(state.trace, entry, MAX_TRACE_ENTRIES),
  };
}

export function setAgentResource(
  state: SimulationState,
  agentId: string,
  resourceId: keyof ResourceState,
  amount: number,
): SimulationState {
  const agent = state.agents.find(candidate => candidate.id === agentId);
  if (agent === undefined) throw new RangeError(`Unknown agent "${agentId}"`);
  const nextAmount = clamp(amount, 0, 1);
  const summary = `Set ${agent.profile.name}'s ${resourceId} to ${nextAmount.toFixed(2)}`;
  const entry = interventionEntry(
    state,
    agent,
    summary,
    `resource:${resourceId}`,
    nextAmount,
    `intervention.agents.${agentId}.resources.${resourceId}`,
  );
  return {
    ...state,
    agents: state.agents.map(candidate =>
      candidate.id === agentId
        ? { ...candidate, resources: { ...candidate.resources, [resourceId]: nextAmount } }
        : candidate,
    ),
    trace: appendTrace(state.trace, entry, MAX_TRACE_ENTRIES),
  };
}
