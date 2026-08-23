import {
  VALUE_IDS,
  type AgendaGoalSeed,
  type CharacterDefinition,
  type CharacterPlacement,
  type EnvironmentDefinition,
  type LocationDefinition,
  type MaskingDemand,
  type Point,
  type RecoveryMode,
  type ResourceState,
  type RuntimeMemory,
  type ScenarioContent,
  type ScheduleBlock,
  type SimulationAgent,
  type SimulationState,
  type TraceEntry,
  type ValueId,
  type ValueMap,
  type ValueState,
} from '../model/types.js';
import {
  parseCharacterLibrary,
  parseEnvironmentLibrary,
  parseScenario,
  ScenarioValidationError,
} from '../scenario/parse.js';
import { parseSnapshot } from '../scenario/snapshot.js';
import { advanceIntentions, intendedTask, prepareAgenda } from './agenda.js';
import { resolveOpportunity } from './decision.js';
import { resolveDisclosureOpportunity } from './disclosure.js';
import { advanceCoping, resolveAppraisalEvent } from './coping.js';
import {
  createNarrativeState,
  prepareNarrativeAgency,
  resolveNarrativeEvent,
} from './narrative.js';
import { applyBuildToWalkingPace } from './physical.js';
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

function locationCenter(location: LocationDefinition): Point {
  return {
    x: location.x + location.width / 2,
    y: location.y + location.height / 2,
  };
}

function distance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
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

function initialMemories(profile: CharacterDefinition): RuntimeMemory[] {
  return profile.formativeEvents.map((event, index) => ({
    id: `formative:${profile.id}:${index}`,
    minute: -1,
    summary: event.summary,
    type: 'formative',
  }));
}

function initializeAgent(
  profile: CharacterDefinition,
  placement: CharacterPlacement,
  environment: EnvironmentDefinition,
  minute: number,
): SimulationAgent {
  const block = activeScheduleBlock(placement.schedule, minute);
  const destination = locationCenter(findLocation(environment, block.locationId));
  const arrived = distance(placement.position, destination) < 0.01;
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
    id: placement.instanceId,
    memories: initialMemories(profile),
    narrative: null,
    outletHistory: [],
    position: { ...placement.position },
    profile,
    resources: { ...DEFAULT_RESOURCES, ...placement.initialResources },
    schedule: placement.schedule.map(scheduleBlock => ({ ...scheduleBlock })),
    values: initialValues(profile, placement),
    walkingMetersPerMinute: applyBuildToWalkingPace(
      placement.walkingMetersPerMinute ?? 16,
      profile.physical.build,
    ),
  };
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

function validateReferences(content: ScenarioContent): void {
  const characters = new Map(
    content.characterLibrary.characters.map(character => [character.id, character]),
  );
  const environment = content.environmentLibrary.environments.find(
    candidate => candidate.id === content.scenario.environmentId,
  );
  if (environment === undefined) {
    throw new ScenarioValidationError(
      'scenario.environmentId',
      `unknown environment "${content.scenario.environmentId}"`,
    );
  }
  const locationIds = new Set(environment.locations.map(location => location.id));
  const instanceIds = new Set(content.scenario.characters.map(placement => placement.instanceId));
  const profileByInstance = new Map(
    content.scenario.characters.map(placement => [
      placement.instanceId,
      characters.get(placement.characterId),
    ]),
  );
  const claimIdsFor = (instanceId: string) =>
    new Set(profileByInstance.get(instanceId)?.narrativeClaims.map(claim => claim.id) ?? []);
  const localNormIds = new Set(content.scenario.localNorms.map(norm => norm.id));
  content.scenario.characters.forEach((placement, index) => {
    if (!characters.has(placement.characterId)) {
      throw new ScenarioValidationError(
        `scenario.characters[${index}].characterId`,
        `unknown character "${placement.characterId}"`,
      );
    }
    const profileClaimIds = new Set(
      characters.get(placement.characterId)?.narrativeClaims.map(claim => claim.id) ?? [],
    );
    placement.narrativeOverrides.forEach((override, overrideIndex) => {
      if (!profileClaimIds.has(override.claimId)) {
        throw new ScenarioValidationError(
          `scenario.characters[${index}].narrativeOverrides[${overrideIndex}].claimId`,
          `unknown narrative claim "${override.claimId}"`,
        );
      }
    });
    placement.schedule.forEach((block, blockIndex) => {
      if (!locationIds.has(block.locationId)) {
        throw new ScenarioValidationError(
          `scenario.characters[${index}].schedule[${blockIndex}].locationId`,
          `unknown location "${block.locationId}"`,
        );
      }
    });
    placement.normPerspectives.forEach((perspective, perspectiveIndex) => {
      if (!localNormIds.has(perspective.normId)) {
        throw new ScenarioValidationError(
          `scenario.characters[${index}].normPerspectives[${perspectiveIndex}].normId`,
          `unknown local norm "${perspective.normId}"`,
        );
      }
    });
  });
  content.scenario.dyads.forEach((dyad, index) => {
    if (!instanceIds.has(dyad.observerId)) {
      throw new ScenarioValidationError(
        `scenario.dyads[${index}].observerId`,
        `unknown agent "${dyad.observerId}"`,
      );
    }
    if (!instanceIds.has(dyad.subjectId)) {
      throw new ScenarioValidationError(
        `scenario.dyads[${index}].subjectId`,
        `unknown agent "${dyad.subjectId}"`,
      );
    }
    dyad.validatorClaimIds.forEach((claimId, claimIndex) => {
      if (!claimIdsFor(dyad.observerId).has(claimId)) {
        throw new ScenarioValidationError(
          `scenario.dyads[${index}].validatorClaimIds[${claimIndex}]`,
          `unknown narrative claim "${claimId}" for observer "${dyad.observerId}"`,
        );
      }
    });
  });
  const disclosureItemIds = new Set(content.scenario.disclosureItems.map(item => item.id));
  content.scenario.disclosureItems.forEach((item, index) => {
    const path = `scenario.disclosureItems[${index}]`;
    if (!instanceIds.has(item.ownerId)) {
      throw new ScenarioValidationError(`${path}.ownerId`, `unknown agent "${item.ownerId}"`);
    }
    item.knownByIds.forEach((agentId, agentIndex) => {
      if (!instanceIds.has(agentId)) {
        throw new ScenarioValidationError(
          `${path}.knownByIds[${agentIndex}]`,
          `unknown agent "${agentId}"`,
        );
      }
    });
  });
  content.scenario.disclosureOpportunities.forEach((opportunity, index) => {
    const path = `scenario.disclosureOpportunities[${index}]`;
    if (!instanceIds.has(opportunity.ownerId)) {
      throw new ScenarioValidationError(
        `${path}.ownerId`,
        `unknown agent "${opportunity.ownerId}"`,
      );
    }
    if (!disclosureItemIds.has(opportunity.itemId)) {
      throw new ScenarioValidationError(
        `${path}.itemId`,
        `unknown disclosure item "${opportunity.itemId}"`,
      );
    }
    const item = content.scenario.disclosureItems.find(
      candidate => candidate.id === opportunity.itemId,
    );
    if (item?.ownerId !== opportunity.ownerId) {
      throw new ScenarioValidationError(
        `${path}.itemId`,
        'disclosure item must belong to the opportunity owner',
      );
    }
    opportunity.audienceIds.forEach((agentId, agentIndex) => {
      if (!instanceIds.has(agentId)) {
        throw new ScenarioValidationError(
          `${path}.audienceIds[${agentIndex}]`,
          `unknown agent "${agentId}"`,
        );
      }
    });
  });
  content.scenario.observationEvents.forEach((event, index) => {
    const path = `scenario.observationEvents[${index}]`;
    if (!instanceIds.has(event.subjectId)) {
      throw new ScenarioValidationError(`${path}.subjectId`, `unknown agent "${event.subjectId}"`);
    }
    if (event.eventType === 'norm' && !localNormIds.has(event.normId)) {
      throw new ScenarioValidationError(`${path}.normId`, `unknown local norm "${event.normId}"`);
    }
    event.observerIds.forEach((observerId, observerIndex) => {
      if (!instanceIds.has(observerId)) {
        throw new ScenarioValidationError(
          `${path}.observerIds[${observerIndex}]`,
          `unknown agent "${observerId}"`,
        );
      }
      if (observerId === event.subjectId) {
        throw new ScenarioValidationError(
          `${path}.observerIds[${observerIndex}]`,
          'an agent cannot observe its own social signal',
        );
      }
      if (
        event.eventType === 'norm' &&
        !content.scenario.characters
          .find(placement => placement.instanceId === observerId)
          ?.normPerspectives.some(perspective => perspective.normId === event.normId)
      ) {
        throw new ScenarioValidationError(
          `${path}.observerIds[${observerIndex}]`,
          `agent "${observerId}" lacks a perspective on local norm "${event.normId}"`,
        );
      }
    });
  });
  content.scenario.relationshipEvents.forEach((event, index) => {
    const path = `scenario.relationshipEvents[${index}]`;
    if (!instanceIds.has(event.observerId)) {
      throw new ScenarioValidationError(
        `${path}.observerId`,
        `unknown agent "${event.observerId}"`,
      );
    }
    if (!instanceIds.has(event.subjectId)) {
      throw new ScenarioValidationError(`${path}.subjectId`, `unknown agent "${event.subjectId}"`);
    }
    if (event.observerId === event.subjectId) {
      throw new ScenarioValidationError(`${path}.subjectId`, 'a dyad must contain two agents');
    }
  });
  content.scenario.relationshipRequests.forEach((request, index) => {
    const path = `scenario.relationshipRequests[${index}]`;
    if (!instanceIds.has(request.requesterId)) {
      throw new ScenarioValidationError(
        `${path}.requesterId`,
        `unknown agent "${request.requesterId}"`,
      );
    }
    if (!instanceIds.has(request.responderId)) {
      throw new ScenarioValidationError(
        `${path}.responderId`,
        `unknown agent "${request.responderId}"`,
      );
    }
    if (request.requesterId === request.responderId) {
      throw new ScenarioValidationError(`${path}.responderId`, 'a request requires two agents');
    }
  });
  content.scenario.appraisalEvents.forEach((event, index) => {
    const path = `scenario.appraisalEvents[${index}]`;
    if (!instanceIds.has(event.agentId)) {
      throw new ScenarioValidationError(`${path}.agentId`, `unknown agent "${event.agentId}"`);
    }
    if (event.socialTargetId !== null && !instanceIds.has(event.socialTargetId)) {
      throw new ScenarioValidationError(
        `${path}.socialTargetId`,
        `unknown agent "${event.socialTargetId}"`,
      );
    }
    if (event.socialTargetId === event.agentId) {
      throw new ScenarioValidationError(
        `${path}.socialTargetId`,
        'an agent cannot be its own social threat target',
      );
    }
  });
  const factIds = new Set(content.scenario.worldFacts.map(fact => fact.id));
  content.scenario.agendaGoals.forEach((goal, index) => {
    const path = `scenario.agendaGoals[${index}]`;
    if (!instanceIds.has(goal.actorId)) {
      throw new ScenarioValidationError(`${path}.actorId`, `unknown agent "${goal.actorId}"`);
    }
    goal.claimExpressions.forEach((expression, expressionIndex) => {
      if (!claimIdsFor(goal.actorId).has(expression.claimId)) {
        throw new ScenarioValidationError(
          `${path}.claimExpressions[${expressionIndex}].claimId`,
          `unknown narrative claim "${expression.claimId}" for actor "${goal.actorId}"`,
        );
      }
    });
    goal.desired.forEach((condition, conditionIndex) => {
      if (!factIds.has(condition.factId)) {
        throw new ScenarioValidationError(
          `${path}.desired[${conditionIndex}].factId`,
          `unknown world fact "${condition.factId}"`,
        );
      }
    });
  });
  content.scenario.taskOperators.forEach((task, index) => {
    const path = `scenario.taskOperators[${index}]`;
    if (!locationIds.has(task.locationId)) {
      throw new ScenarioValidationError(
        `${path}.locationId`,
        `unknown location "${task.locationId}"`,
      );
    }
    task.actorIds.forEach((actorId, actorIndex) => {
      if (!instanceIds.has(actorId)) {
        throw new ScenarioValidationError(
          `${path}.actorIds[${actorIndex}]`,
          `unknown agent "${actorId}"`,
        );
      }
      task.claimExpressions.forEach((expression, expressionIndex) => {
        if (!claimIdsFor(actorId).has(expression.claimId)) {
          throw new ScenarioValidationError(
            `${path}.claimExpressions[${expressionIndex}].claimId`,
            `unknown narrative claim "${expression.claimId}" for actor "${actorId}"`,
          );
        }
      });
    });
    task.preconditions.forEach((condition, conditionIndex) => {
      if (!factIds.has(condition.factId)) {
        throw new ScenarioValidationError(
          `${path}.preconditions[${conditionIndex}].factId`,
          `unknown world fact "${condition.factId}"`,
        );
      }
    });
    task.effects.forEach((effect, effectIndex) => {
      if (!factIds.has(effect.factId)) {
        throw new ScenarioValidationError(
          `${path}.effects[${effectIndex}].factId`,
          `unknown world fact "${effect.factId}"`,
        );
      }
    });
  });
  content.scenario.behaviorOpportunities.forEach((opportunity, index) => {
    const path = `scenario.behaviorOpportunities[${index}]`;
    if (!instanceIds.has(opportunity.actorId)) {
      throw new ScenarioValidationError(
        `${path}.actorId`,
        `unknown agent "${opportunity.actorId}"`,
      );
    }
    if (opportunity.targetId !== null && !instanceIds.has(opportunity.targetId)) {
      throw new ScenarioValidationError(
        `${path}.targetId`,
        `unknown agent "${opportunity.targetId}"`,
      );
    }
    opportunity.context.witnessIds.forEach((witnessId, witnessIndex) => {
      if (!instanceIds.has(witnessId)) {
        throw new ScenarioValidationError(
          `${path}.context.witnessIds[${witnessIndex}]`,
          `unknown agent "${witnessId}"`,
        );
      }
    });
    opportunity.candidates.forEach((candidate, candidateIndex) => {
      candidate.claimExpressions.forEach((expression, expressionIndex) => {
        if (!claimIdsFor(opportunity.actorId).has(expression.claimId)) {
          throw new ScenarioValidationError(
            `${path}.candidates[${candidateIndex}].claimExpressions[${expressionIndex}].claimId`,
            `unknown narrative claim "${expression.claimId}" for actor "${opportunity.actorId}"`,
          );
        }
      });
      candidate.impacts.forEach((impact, impactIndex) => {
        if (!instanceIds.has(impact.subjectId)) {
          throw new ScenarioValidationError(
            `${path}.candidates[${candidateIndex}].impacts[${impactIndex}].subjectId`,
            `unknown agent "${impact.subjectId}"`,
          );
        }
      });
    });
  });
  const groupIds = new Set(content.scenario.reputationGroups.map(group => group.id));
  content.scenario.reputationGroups.forEach((group, index) => {
    group.memberIds.forEach((memberId, memberIndex) => {
      if (!instanceIds.has(memberId)) {
        throw new ScenarioValidationError(
          `scenario.reputationGroups[${index}].memberIds[${memberIndex}]`,
          `unknown agent "${memberId}"`,
        );
      }
    });
  });
  content.scenario.aspirationOpportunities.forEach((opportunity, index) => {
    const path = `scenario.aspirationOpportunities[${index}]`;
    if (!instanceIds.has(opportunity.actorId)) {
      throw new ScenarioValidationError(
        `${path}.actorId`,
        `unknown agent "${opportunity.actorId}"`,
      );
    }
    if (!claimIdsFor(opportunity.actorId).has(opportunity.claimId)) {
      throw new ScenarioValidationError(
        `${path}.claimId`,
        `unknown narrative claim "${opportunity.claimId}"`,
      );
    }
    opportunity.desired.forEach((condition, conditionIndex) => {
      if (!factIds.has(condition.factId)) {
        throw new ScenarioValidationError(
          `${path}.desired[${conditionIndex}].factId`,
          `unknown world fact "${condition.factId}"`,
        );
      }
    });
  });
  const disclosureItemIdsForNarrative = new Set(
    content.scenario.disclosureItems.map(item => item.id),
  );
  content.scenario.narrativeEvents.forEach((event, index) => {
    const path = `scenario.narrativeEvents[${index}]`;
    if (event.eventType === 'attribution') {
      for (const [field, agentId] of [
        ['sourceId', event.sourceId],
        ['subjectId', event.subjectId],
      ] as const) {
        if (!instanceIds.has(agentId)) {
          throw new ScenarioValidationError(`${path}.${field}`, `unknown agent "${agentId}"`);
        }
      }
      if (
        (event.audienceType === 'agent' && !instanceIds.has(event.audienceId)) ||
        (event.audienceType === 'group' && !groupIds.has(event.audienceId))
      ) {
        throw new ScenarioValidationError(
          `${path}.audienceId`,
          `unknown ${event.audienceType} audience "${event.audienceId}"`,
        );
      }
      if (!claimIdsFor(event.subjectId).has(event.selfClaimId)) {
        throw new ScenarioValidationError(`${path}.selfClaimId`, 'unknown subject narrative claim');
      }
    } else {
      if (!instanceIds.has(event.actorId)) {
        throw new ScenarioValidationError(`${path}.actorId`, `unknown agent "${event.actorId}"`);
      }
      if (!claimIdsFor(event.actorId).has(event.claimId)) {
        throw new ScenarioValidationError(`${path}.claimId`, 'unknown actor narrative claim');
      }
      if (event.eventType === 'self-deprecation-agreement') {
        if (!instanceIds.has(event.responderId)) {
          throw new ScenarioValidationError(
            `${path}.responderId`,
            `unknown agent "${event.responderId}"`,
          );
        }
        if (
          event.disclosureItemId !== null &&
          !disclosureItemIdsForNarrative.has(event.disclosureItemId)
        ) {
          throw new ScenarioValidationError(
            `${path}.disclosureItemId`,
            `unknown disclosure item "${event.disclosureItemId}"`,
          );
        }
      }
    }
  });
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

export function createSimulation(input: {
  characterLibrary: unknown;
  environmentLibrary: unknown;
  scenario: unknown;
}): SimulationState {
  const content: ScenarioContent = {
    characterLibrary: parseCharacterLibrary(input.characterLibrary),
    environmentLibrary: parseEnvironmentLibrary(input.environmentLibrary),
    scenario: parseScenario(input.scenario),
  };
  validateReferences(content);
  const environment = content.environmentLibrary.environments.find(
    candidate => candidate.id === content.scenario.environmentId,
  );
  if (environment === undefined) throw new Error('References were validated before resolution');
  const profiles = new Map(
    content.characterLibrary.characters.map(character => [character.id, character]),
  );
  const agents = content.scenario.characters.map(placement => {
    const profile = profiles.get(placement.characterId);
    if (profile === undefined) throw new Error('References were validated before resolution');
    return initializeAgent(profile, placement, environment, content.scenario.startMinute);
  });

  let initial: SimulationState = {
    appraisalRecords: [],
    agendaDecisions: [],
    agendaGoals: content.scenario.agendaGoals.map(goal => ({
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
    disclosureItems: content.scenario.disclosureItems.map(item => ({
      ...item,
      knownByIds: [...item.knownByIds],
    })),
    dyads: content.scenario.dyads.map(dyad => ({
      ...dyad,
      features: { ...dyad.features },
      validatorClaimIds: [...dyad.validatorClaimIds],
    })),
    environment,
    intentions: [],
    minute: content.scenario.startMinute,
    narrativeRecords: [],
    observations: [],
    plans: [],
    relationshipDecisions: [],
    reputations: [],
    resolvedDisclosureOpportunityIds: [],
    resolvedObservationEventIds: [],
    resolvedOpportunityIds: [],
    resolvedAppraisalEventIds: [],
    resolvedAspirationOpportunityIds: [],
    resolvedNarrativeEventIds: [],
    resolvedRelationshipEventIds: [],
    resolvedRelationshipRequestIds: [],
    scenario: content.scenario,
    tick: 0,
    trace: createTrace([
      {
        agentId: null,
        id: '0:scenario',
        kind: 'scenario',
        minute: content.scenario.startMinute,
        selection: null,
        summary: `Loaded ${content.scenario.title}`,
        terms: [
          traceTerm('environment', environment.id, 'scenario.environmentId'),
          ...agents.map(agent =>
            traceTerm(
              `character:${agent.id}`,
              agent.profile.id,
              `scenario.characters.${agent.id}.characterId`,
            ),
          ),
        ],
        tick: 0,
      },
    ]),
    worldFacts: content.scenario.worldFacts.map(fact => ({ ...fact })),
    worldRevision: 0,
  };
  initial = {
    ...initial,
    dyads: initial.dyads.map(dyad => repriceExposureDebt(initial, dyad)),
  };
  return prepareAgenda(prepareNarrativeAgency(initial));
}

export function createSimulationFromSnapshot(input: {
  characterLibrary: unknown;
  environmentLibrary: unknown;
  snapshot: unknown;
}): SimulationState {
  const snapshot = parseSnapshot(input.snapshot);
  const base = createSimulation({
    characterLibrary: input.characterLibrary,
    environmentLibrary: input.environmentLibrary,
    scenario: snapshot.scenario,
  });
  if (snapshot.environmentId !== base.environment.id) {
    throw new ScenarioValidationError(
      'snapshot.environmentId',
      `unknown environment "${snapshot.environmentId}"`,
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
  const agents = snapshot.agents.map((saved, index) => {
    const agent = baseAgents.get(saved.id);
    if (agent === undefined) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].id`,
        `unknown agent "${saved.id}"`,
      );
    }
    if (saved.profileId !== agent.profile.id) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].profileId`,
        `expected character "${agent.profile.id}"`,
      );
    }
    if (saved.currentLocationId !== null && !locationIds.has(saved.currentLocationId)) {
      throw new ScenarioValidationError(
        `snapshot.agents[${index}].currentLocationId`,
        `unknown location "${saved.currentLocationId}"`,
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
    return {
      cascade: saved.cascade,
      cascadeDwellUntilMinute: saved.cascadeDwellUntilMinute,
      cascadeLoad: saved.cascadeLoad,
      cascadeTargetId: saved.cascadeTargetId,
      currentOutlet: saved.currentOutlet === null ? null : { ...saved.currentOutlet },
      currentActivity: saved.currentActivity,
      currentLocationId: saved.currentLocationId,
      destination: { ...saved.destination },
      id: saved.id,
      memories: saved.memories.map(memory => ({ ...memory })),
      narrative:
        saved.narrative === null
          ? null
          : {
              ...saved.narrative,
              claims: saved.narrative.claims.map(claim => ({ ...claim })),
            },
      outletHistory: saved.outletHistory.map(use => ({ ...use })),
      position: { ...saved.position },
      profile: agent.profile,
      resources: { ...saved.resources },
      schedule: saved.schedule.map(block => ({ ...block })),
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
    dyads: snapshot.dyads,
    intentions: snapshot.intentions,
    minute: snapshot.minute,
    narrativeRecords: snapshot.narrativeRecords,
    observations: snapshot.observations,
    plans: snapshot.plans,
    relationshipDecisions: snapshot.relationshipDecisions,
    reputations: snapshot.reputations,
    resolvedDisclosureOpportunityIds: snapshot.resolvedDisclosureOpportunityIds,
    resolvedObservationEventIds: snapshot.resolvedObservationEventIds,
    resolvedOpportunityIds: snapshot.resolvedOpportunityIds,
    resolvedAppraisalEventIds: snapshot.resolvedAppraisalEventIds,
    resolvedAspirationOpportunityIds: snapshot.resolvedAspirationOpportunityIds,
    resolvedNarrativeEventIds: snapshot.resolvedNarrativeEventIds,
    resolvedRelationshipEventIds: snapshot.resolvedRelationshipEventIds,
    resolvedRelationshipRequestIds: snapshot.resolvedRelationshipRequestIds,
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
  const destination = locationCenter(location);
  const remaining = distance(agent.position, destination);
  const travel = agent.walkingMetersPerMinute * state.scenario.tickMinutes;
  const position =
    remaining <= travel || remaining === 0
      ? destination
      : {
          x: agent.position.x + ((destination.x - agent.position.x) / remaining) * travel,
          y: agent.position.y + ((destination.y - agent.position.y) / remaining) * travel,
        };
  const arrived = distance(position, destination) < 0.01;
  const currentActivity = arrived
    ? task === null
      ? (block?.activity ?? agent.currentActivity)
      : intention?.phase === 'waiting'
        ? `Waiting to ${task.label.toLowerCase()}`
        : task.label
    : `Walking to ${location.name}${task === null ? '' : ` to ${task.label.toLowerCase()}`}`;
  const currentLocationId = arrived ? locationId : null;
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
  const recoverySource =
    task === null
      ? `agents.${agent.id}.schedule.recoveryMode`
      : `scenario.taskOperators.${task.id}.recoveryMode`;

  let memories = agent.memories;
  const trace: TraceEntry[] = [];
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
    if (RESOURCE_IDS.some(resourceId => recovery.deltas[resourceId] !== 0)) {
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
              recovery.resources[resourceId],
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
      resources: recovery.resources,
      values,
    },
    sleeping: recoveryMode === 'sleep' && arrived,
    trace,
  };
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
  next = advanceIntentions(next);
  const dueOpportunities = prepared.scenario.behaviorOpportunities.filter(
    opportunity =>
      opportunity.atMinute > prepared.minute &&
      opportunity.atMinute <= nextMinute &&
      !prepared.resolvedOpportunityIds.includes(opportunity.id),
  );
  for (const opportunity of dueOpportunities) next = resolveOpportunity(next, opportunity);
  const dueDisclosureOpportunities = prepared.scenario.disclosureOpportunities.filter(
    opportunity =>
      opportunity.atMinute > prepared.minute &&
      opportunity.atMinute <= nextMinute &&
      !prepared.resolvedDisclosureOpportunityIds.includes(opportunity.id),
  );
  for (const opportunity of dueDisclosureOpportunities) {
    next = resolveDisclosureOpportunity(next, opportunity);
  }
  const dueObservationEvents = prepared.scenario.observationEvents.filter(
    event =>
      event.atMinute > prepared.minute &&
      event.atMinute <= nextMinute &&
      !prepared.resolvedObservationEventIds.includes(event.id),
  );
  for (const event of dueObservationEvents) next = resolveObservationEvent(next, event);
  const dueRelationshipEvents = prepared.scenario.relationshipEvents.filter(
    event =>
      event.atMinute > prepared.minute &&
      event.atMinute <= nextMinute &&
      !prepared.resolvedRelationshipEventIds.includes(event.id),
  );
  for (const event of dueRelationshipEvents) next = resolveRelationshipEvent(next, event);
  const dueRelationshipRequests = prepared.scenario.relationshipRequests.filter(
    request =>
      request.atMinute > prepared.minute &&
      request.atMinute <= nextMinute &&
      !prepared.resolvedRelationshipRequestIds.includes(request.id),
  );
  for (const request of dueRelationshipRequests) next = resolveRelationshipRequest(next, request);
  const dueAppraisalEvents = prepared.scenario.appraisalEvents.filter(
    event =>
      event.atMinute > prepared.minute &&
      event.atMinute <= nextMinute &&
      !prepared.resolvedAppraisalEventIds.includes(event.id),
  );
  for (const event of dueAppraisalEvents) next = resolveAppraisalEvent(next, event);
  const dueNarrativeEvents = prepared.scenario.narrativeEvents.filter(
    event =>
      event.atMinute > prepared.minute &&
      event.atMinute <= nextMinute &&
      !prepared.resolvedNarrativeEventIds.includes(event.id),
  );
  for (const event of dueNarrativeEvents) next = resolveNarrativeEvent(next, event);
  next = consolidateRelationshipMemories(
    next,
    results.filter(result => result.sleeping).map(result => result.agent.id),
  );
  return advanceCoping(next);
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
  return {
    agentId: agent.id,
    id: `${state.tick}:${agent.id}:intervention:${state.trace.entries.length}`,
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
