import {
  VALUE_IDS,
  type CharacterDefinition,
  type CharacterPlacement,
  type EnvironmentDefinition,
  type LocationDefinition,
  type Point,
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
import { resolveOpportunity } from './decision.js';
import { resolveDisclosureOpportunity } from './disclosure.js';

const DAY_MINUTES = 1440;
const MAX_MEMORIES = 16;
const MAX_TRACE_ENTRIES = 240;

const DEFAULT_RESOURCES: ResourceState = {
  executiveBudget: 0.78,
  physicalStamina: 0.82,
  regulationReserve: 0.76,
  socialBattery: 0.7,
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
  return {
    cascade: 'none',
    currentActivity: arrived
      ? block.activity
      : `Walking to ${findLocation(environment, block.locationId).name}`,
    currentLocationId: arrived ? block.locationId : null,
    destination,
    id: placement.instanceId,
    memories: initialMemories(profile),
    position: { ...placement.position },
    profile,
    resources: { ...DEFAULT_RESOURCES, ...placement.initialResources },
    schedule: placement.schedule.map(scheduleBlock => ({ ...scheduleBlock })),
    values: initialValues(profile, placement),
    walkingMetersPerMinute: placement.walkingMetersPerMinute ?? 16,
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
  content.scenario.characters.forEach((placement, index) => {
    if (!characters.has(placement.characterId)) {
      throw new ScenarioValidationError(
        `scenario.characters[${index}].characterId`,
        `unknown character "${placement.characterId}"`,
      );
    }
    placement.schedule.forEach((block, blockIndex) => {
      if (!locationIds.has(block.locationId)) {
        throw new ScenarioValidationError(
          `scenario.characters[${index}].schedule[${blockIndex}].locationId`,
          `unknown location "${block.locationId}"`,
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

  return {
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
    })),
    environment,
    minute: content.scenario.startMinute,
    resolvedDisclosureOpportunityIds: [],
    resolvedOpportunityIds: [],
    scenario: content.scenario,
    tick: 0,
    trace: [
      {
        agentId: null,
        causes: [
          `environment:${environment.id}`,
          ...agents.map(agent => `character:${agent.profile.id}`),
        ],
        id: '0:scenario',
        kind: 'scenario',
        minute: content.scenario.startMinute,
        summary: `Loaded ${content.scenario.title}`,
        tick: 0,
      },
    ],
  };
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
      currentActivity: saved.currentActivity,
      currentLocationId: saved.currentLocationId,
      destination: { ...saved.destination },
      id: saved.id,
      memories: saved.memories.map(memory => ({ ...memory })),
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
  snapshot.dyads.forEach((dyad, index) => {
    if (!agentIds.has(dyad.observerId) || !agentIds.has(dyad.subjectId)) {
      throw new ScenarioValidationError(
        `snapshot.dyads[${index}]`,
        'dyad must reference snapshot agents',
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

  return {
    ...base,
    agents,
    decisions: snapshot.decisions,
    disclosureDecisions: snapshot.disclosureDecisions,
    disclosureItems: snapshot.disclosureItems,
    dyads: snapshot.dyads,
    minute: snapshot.minute,
    resolvedDisclosureOpportunityIds: snapshot.resolvedDisclosureOpportunityIds,
    resolvedOpportunityIds: snapshot.resolvedOpportunityIds,
    tick: snapshot.tick,
    trace: snapshot.trace,
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

interface AgentAdvanceResult {
  agent: SimulationAgent;
  trace: TraceEntry[];
}

function advanceAgent(
  state: SimulationState,
  agent: SimulationAgent,
  nextMinute: number,
  nextTick: number,
): AgentAdvanceResult {
  const block = activeScheduleBlock(agent.schedule, nextMinute);
  const location = findLocation(state.environment, block.locationId);
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
  const currentActivity = arrived ? block.activity : `Walking to ${location.name}`;
  const currentLocationId = arrived ? block.locationId : null;
  const values = {} as ValueMap<ValueState>;
  for (const valueId of VALUE_IDS) {
    values[valueId] = advanceValueState(
      agent.values[valueId],
      state.scenario.ambientTurnsPerHour?.[valueId] ?? 0,
      state.scenario.tickMinutes,
    );
  }

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
      causes: [`schedule:${block.startMinute}`, `location:${block.locationId}`],
      id: `${nextTick}:${agent.id}:activity`,
      kind: 'activity',
      minute: nextMinute,
      summary,
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
        causes: activeTurns.map(valueId => `ambient:${valueId}`),
        id: `${nextTick}:${agent.id}:ambient`,
        kind: 'value-turn',
        minute: nextMinute,
        summary: `${agent.profile.name} remains under the scenario's ambient pressure`,
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
      values,
    },
    trace,
  };
}

function advanceOneTick(state: SimulationState): SimulationState {
  const nextTick = state.tick + 1;
  const nextMinute = state.minute + state.scenario.tickMinutes;
  const results = state.agents.map(agent => advanceAgent(state, agent, nextMinute, nextTick));
  let trace = state.trace;
  for (const result of results) {
    for (const entry of result.trace) trace = appendBounded(trace, entry, MAX_TRACE_ENTRIES);
  }
  let next: SimulationState = {
    ...state,
    agents: results.map(result => result.agent),
    minute: nextMinute,
    tick: nextTick,
    trace,
  };
  const dueOpportunities = state.scenario.behaviorOpportunities.filter(
    opportunity =>
      opportunity.atMinute > state.minute &&
      opportunity.atMinute <= nextMinute &&
      !state.resolvedOpportunityIds.includes(opportunity.id),
  );
  for (const opportunity of dueOpportunities) next = resolveOpportunity(next, opportunity);
  const dueDisclosureOpportunities = state.scenario.disclosureOpportunities.filter(
    opportunity =>
      opportunity.atMinute > state.minute &&
      opportunity.atMinute <= nextMinute &&
      !state.resolvedDisclosureOpportunityIds.includes(opportunity.id),
  );
  for (const opportunity of dueDisclosureOpportunities) {
    next = resolveDisclosureOpportunity(next, opportunity);
  }
  return next;
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
  cause: string,
): TraceEntry {
  return {
    agentId: agent.id,
    causes: [cause],
    id: `${state.tick}:${agent.id}:intervention:${state.trace.length}`,
    kind: 'intervention',
    minute: state.minute,
    summary,
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
  const entry = interventionEntry(state, agent, summary, `workbench:value:${valueId}`);
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
    trace: appendBounded(state.trace, entry, MAX_TRACE_ENTRIES),
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
  const entry = interventionEntry(state, agent, summary, `workbench:resource:${resourceId}`);
  return {
    ...state,
    agents: state.agents.map(candidate =>
      candidate.id === agentId
        ? { ...candidate, resources: { ...candidate.resources, [resourceId]: nextAmount } }
        : candidate,
    ),
    trace: appendBounded(state.trace, entry, MAX_TRACE_ENTRIES),
  };
}
