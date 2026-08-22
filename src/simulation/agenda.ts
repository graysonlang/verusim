import {
  VALUE_IDS,
  type AgendaDecisionRecord,
  type AgendaGoalState,
  type AgendaPlan,
  type FactCondition,
  type PlanCandidateEvaluation,
  type Point,
  type ResourceState,
  type RuntimeMemory,
  type SimulationAgent,
  type SimulationState,
  type TaskIntention,
  type TaskOperator,
  type TraceEntry,
  type ValueMap,
  type ValueState,
  type WorldFact,
} from '../model/types.js';
import { appraiseAction } from './appraisal.js';
import { evaluateEmpathy } from './empathy.js';
import { effectiveValueWeights } from './salience.js';
import { appendTrace, traceTerm } from './trace.js';

const MAX_AGENDA_DECISIONS = 80;
const MAX_MEMORIES = 16;
const MAX_PLAN_CANDIDATES = 24;
const MAX_PLAN_DEPTH = 8;
const MAX_SEARCH_NODES = 256;
const MAX_TRACE_ENTRIES = 240;

interface SearchNode {
  facts: Map<string, number>;
  minute: number;
  position: Point;
  resourceCosts: ResourceState;
  taskIds: string[];
}

const EMPTY_RESOURCE_COSTS: ResourceState = {
  executiveBudget: 0,
  physicalStamina: 0,
  regulationReserve: 0,
  socialBattery: 0,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function appendBounded<Item>(items: Item[], item: Item, maximum: number): Item[] {
  const next = [...items, item];
  return next.length <= maximum ? next : next.slice(next.length - maximum);
}

function findAgent(state: SimulationState, agentId: string): SimulationAgent {
  const agent = state.agents.find(candidate => candidate.id === agentId);
  if (agent === undefined) throw new RangeError(`Unknown agenda agent "${agentId}"`);
  return agent;
}

function findTask(state: SimulationState, taskId: string): TaskOperator {
  const task = state.scenario.taskOperators.find(candidate => candidate.id === taskId);
  if (task === undefined) throw new RangeError(`Unknown task operator "${taskId}"`);
  return task;
}

function factMap(facts: WorldFact[]): Map<string, number> {
  return new Map(facts.map(fact => [fact.id, fact.amount]));
}

function conditionsMet(facts: Map<string, number>, conditions: FactCondition[]): boolean {
  return conditions.every(condition => (facts.get(condition.factId) ?? 0) >= condition.minimum);
}

function goalSatisfied(state: SimulationState, goal: AgendaGoalState): boolean {
  return conditionsMet(factMap(state.worldFacts), goal.desired);
}

function addTurns(
  left: Partial<ValueMap<number>>,
  right: Partial<ValueMap<number>>,
): Partial<ValueMap<number>> {
  const result: Partial<ValueMap<number>> = { ...left };
  for (const valueId of VALUE_IDS) result[valueId] = (result[valueId] ?? 0) + (right[valueId] ?? 0);
  return result;
}

function subtractTurns(
  left: Partial<ValueMap<number>>,
  right: Partial<ValueMap<number>>,
): Partial<ValueMap<number>> {
  const result: Partial<ValueMap<number>> = {};
  for (const valueId of VALUE_IDS) result[valueId] = (left[valueId] ?? 0) - (right[valueId] ?? 0);
  return result;
}

function applyTurns(agent: SimulationAgent, turns: Partial<ValueMap<number>>): SimulationAgent {
  const values = {} as ValueMap<ValueState>;
  for (const valueId of VALUE_IDS) {
    values[valueId] = {
      ...agent.values[valueId],
      charge: clamp(agent.values[valueId].charge + (turns[valueId] ?? 0), -1, 1),
    };
  }
  return { ...agent, values };
}

function locationCenter(state: SimulationState, locationId: string): Point {
  const location = state.environment.locations.find(candidate => candidate.id === locationId);
  if (location === undefined) throw new RangeError(`Unknown task location "${locationId}"`);
  return { x: location.x + location.width / 2, y: location.y + location.height / 2 };
}

function distance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function tickDuration(minutes: number, tickMinutes: number): number {
  return Math.ceil(minutes / tickMinutes) * tickMinutes;
}

function emptyResourceCosts(): ResourceState {
  return { ...EMPTY_RESOURCE_COSTS };
}

function addResourceCosts(left: ResourceState, right: Partial<ResourceState>): ResourceState {
  return {
    executiveBudget: left.executiveBudget + (right.executiveBudget ?? 0),
    physicalStamina: left.physicalStamina + (right.physicalStamina ?? 0),
    regulationReserve: left.regulationReserve + (right.regulationReserve ?? 0),
    socialBattery: left.socialBattery + (right.socialBattery ?? 0),
  };
}

function resourcesAvailable(agent: SimulationAgent, costs: ResourceState): boolean {
  return (Object.keys(EMPTY_RESOURCE_COSTS) as (keyof ResourceState)[]).every(
    resourceId => costs[resourceId] <= agent.resources[resourceId],
  );
}

function applyEffects(facts: Map<string, number>, task: TaskOperator): Map<string, number> | null {
  const next = new Map(facts);
  for (const effect of task.effects) {
    const amount = (next.get(effect.factId) ?? 0) + effect.delta;
    if (amount < 0) return null;
    next.set(effect.factId, amount);
  }
  return next;
}

function relevantTasks(
  state: SimulationState,
  actorId: string,
  goal: AgendaGoalState,
): TaskOperator[] {
  const available = state.scenario.taskOperators.filter(task => task.actorIds.includes(actorId));
  const relevantFactIds = new Set(goal.desired.map(condition => condition.factId));
  const relevantTaskIds = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of available) {
      if (
        relevantTaskIds.has(task.id) ||
        !task.effects.some(effect => effect.delta > 0 && relevantFactIds.has(effect.factId))
      ) {
        continue;
      }
      relevantTaskIds.add(task.id);
      changed = true;
      for (const condition of task.preconditions) relevantFactIds.add(condition.factId);
    }
  }
  return available.filter(task => relevantTaskIds.has(task.id));
}

function completionForTask(
  state: SimulationState,
  agent: SimulationAgent,
  node: SearchNode,
  task: TaskOperator,
): { minute: number; position: Point } | null {
  const position = locationCenter(state, task.locationId);
  const travelMinutes = tickDuration(
    distance(node.position, position) / agent.walkingMetersPerMinute,
    state.scenario.tickMinutes,
  );
  const arrivalMinute = node.minute + travelMinutes;
  const startMinute = Math.max(arrivalMinute, task.availableFromMinute ?? arrivalMinute);
  const minute = startMinute + tickDuration(task.durationMinutes, state.scenario.tickMinutes);
  if (task.availableUntilMinute !== null && minute > task.availableUntilMinute) return null;
  return { minute, position };
}

function searchPlans(
  state: SimulationState,
  agent: SimulationAgent,
  goal: AgendaGoalState,
): SearchNode[] {
  const tasks = relevantTasks(state, agent.id, goal);
  const queue: SearchNode[] = [
    {
      facts: factMap(state.worldFacts),
      minute: state.minute,
      position: agent.position,
      resourceCosts: emptyResourceCosts(),
      taskIds: [],
    },
  ];
  const completed: SearchNode[] = [];
  let visited = 0;
  while (queue.length > 0 && visited < MAX_SEARCH_NODES && completed.length < MAX_PLAN_CANDIDATES) {
    const node = queue.shift();
    if (node === undefined) break;
    visited += 1;
    if (node.taskIds.length >= MAX_PLAN_DEPTH) continue;
    for (const task of tasks) {
      if (!conditionsMet(node.facts, task.preconditions)) continue;
      const resourceCosts = addResourceCosts(node.resourceCosts, task.resourceCosts);
      if (!resourcesAvailable(agent, resourceCosts)) continue;
      const timing = completionForTask(state, agent, node, task);
      if (
        timing === null ||
        (goal.deadlineMinute !== null && timing.minute > goal.deadlineMinute)
      ) {
        continue;
      }
      const facts = applyEffects(node.facts, task);
      if (facts === null) continue;
      const next: SearchNode = {
        facts,
        minute: timing.minute,
        position: timing.position,
        resourceCosts,
        taskIds: [...node.taskIds, task.id],
      };
      if (conditionsMet(facts, goal.desired)) completed.push(next);
      else queue.push(next);
    }
  }
  return completed;
}

function resourceCost(agent: SimulationAgent, costs: ResourceState): number {
  return (Object.keys(EMPTY_RESOURCE_COSTS) as (keyof ResourceState)[]).reduce(
    (total, resourceId) => total + costs[resourceId] * (2 - agent.resources[resourceId]),
    0,
  );
}

function planCandidates(
  state: SimulationState,
  agent: SimulationAgent,
  goal: AgendaGoalState,
): PlanCandidateEvaluation[] {
  const nodes = searchPlans(state, agent, goal);
  const shortestDuration = Math.min(...nodes.map(node => node.minute - state.minute));
  const slack =
    goal.deadlineMinute === null
      ? Number.POSITIVE_INFINITY
      : goal.deadlineMinute - state.minute - shortestDuration;
  const urgencyPosition =
    goal.deadlineMinute === null ? 0 : clamp(1 - slack / goal.urgencyHorizonMinutes, 0, 1);
  const urgency = 1 + urgencyPosition * urgencyPosition * 3;
  const goalTurns = subtractTurns(goal.successTurns, goal.failureTurns);
  const weights = effectiveValueWeights(agent);
  const selfEmpathy = evaluateEmpathy(state, agent.id, agent.id).empathy;
  const goalAppraisal = appraiseAction({
    contractViolationCost: 0,
    impacts: [{ empathy: selfEmpathy, subjectId: agent.id, turns: goalTurns }],
    narrativeExpression: 0,
    repercussionCost: 0,
    valueWeights: weights,
  });

  return nodes.map(node => {
    let taskTurns: Partial<ValueMap<number>> = {};
    let contractViolation = 0;
    for (const taskId of node.taskIds) {
      const task = findTask(state, taskId);
      taskTurns = addTurns(taskTurns, task.valueTurns);
      contractViolation += task.contractViolation;
    }
    const taskAppraisal = appraiseAction({
      contractViolationCost: agent.profile.contractAdherence * contractViolation,
      impacts: [{ empathy: selfEmpathy, subjectId: agent.id, turns: taskTurns }],
      narrativeExpression: 0,
      repercussionCost: 0,
      valueWeights: weights,
    });
    const combinedTurns = addTurns(goalTurns, taskTurns);
    const appraisal = appraiseAction({
      contractViolationCost: agent.profile.contractAdherence * contractViolation,
      impacts: [{ empathy: selfEmpathy, subjectId: agent.id, turns: combinedTurns }],
      narrativeExpression: 0,
      repercussionCost: 0,
      valueWeights: weights,
    });
    const cost = resourceCost(agent, node.resourceCosts);
    const goalUtility = goalAppraisal.utility;
    const taskUtility = taskAppraisal.utility;
    return {
      appraisal,
      estimatedCompletionMinute: node.minute,
      estimatedDurationMinutes: node.minute - state.minute,
      goalId: goal.id,
      goalUtility,
      id: `${goal.id}:${node.taskIds.join('+')}`,
      resourceCost: cost,
      resourceCosts: { ...node.resourceCosts },
      score: goalUtility * goal.commitment * urgency + taskUtility - cost,
      taskIds: node.taskIds,
      taskUtility,
      urgency,
    };
  });
}

function addTrace(state: SimulationState, entry: TraceEntry): SimulationState {
  return { ...state, trace: appendTrace(state.trace, entry, MAX_TRACE_ENTRIES) };
}

function addMemory(
  state: SimulationState,
  agentId: string,
  memory: RuntimeMemory,
): SimulationState {
  return {
    ...state,
    agents: state.agents.map(agent =>
      agent.id === agentId
        ? { ...agent, memories: appendBounded(agent.memories, memory, MAX_MEMORIES) }
        : agent,
    ),
  };
}

function resolveGoal(
  state: SimulationState,
  goal: AgendaGoalState,
  status: 'completed' | 'failed',
): SimulationState {
  const turns = status === 'completed' ? goal.successTurns : goal.failureTurns;
  const agent = findAgent(state, goal.actorId);
  const summary = `${agent.profile.name} ${status === 'completed' ? 'completed' : 'missed'} ${goal.label.toLowerCase()}`;
  let next: SimulationState = {
    ...state,
    agendaGoals: state.agendaGoals.map(candidate =>
      candidate.id === goal.id ? { ...candidate, resolvedMinute: state.minute, status } : candidate,
    ),
    agents: state.agents.map(candidate =>
      candidate.id === agent.id ? applyTurns(candidate, turns) : candidate,
    ),
    intentions: state.intentions.filter(intention => intention.goalId !== goal.id),
    plans: state.plans.filter(plan => plan.goalId !== goal.id),
  };
  next = addMemory(next, agent.id, {
    id: `${state.tick}:${goal.id}:goal:${status}`,
    minute: state.minute,
    summary,
    type: 'goal',
  });
  return addTrace(next, {
    agentId: agent.id,
    id: `${state.tick}:${goal.id}:goal:${status}`,
    kind: 'goal',
    minute: state.minute,
    selection: null,
    summary,
    terms: [
      traceTerm('goal', goal.id, `agendaGoals.${goal.id}`),
      traceTerm('source', goal.source, `agendaGoals.${goal.id}.source`),
      traceTerm('outcome', status, `agendaGoals.${goal.id}.desired`),
      ...VALUE_IDS.filter(valueId => (turns[valueId] ?? 0) !== 0).map(valueId =>
        traceTerm(
          `turn:${valueId}`,
          turns[valueId] ?? 0,
          `agendaGoals.${goal.id}.${status === 'completed' ? 'successTurns' : 'failureTurns'}.${valueId}`,
        ),
      ),
    ],
    tick: state.tick,
  });
}

function settleGoals(state: SimulationState): SimulationState {
  let next = state;
  for (const initialGoal of state.agendaGoals) {
    let goal = next.agendaGoals.find(candidate => candidate.id === initialGoal.id);
    if (goal === undefined || goal.status === 'completed' || goal.status === 'failed') continue;
    if (goal.status === 'pending' && next.minute >= goal.activationMinute) {
      next = {
        ...next,
        agendaGoals: next.agendaGoals.map(candidate =>
          candidate.id === goal?.id ? { ...candidate, status: 'active' } : candidate,
        ),
      };
      goal = next.agendaGoals.find(candidate => candidate.id === initialGoal.id);
      if (goal === undefined) continue;
      next = addTrace(next, {
        agentId: goal.actorId,
        id: `${next.tick}:${goal.id}:goal:active`,
        kind: 'goal',
        minute: next.minute,
        selection: null,
        summary: `Activated goal: ${goal.label}`,
        terms: [
          traceTerm('source', goal.source, `agendaGoals.${goal.id}.source`),
          traceTerm('commitment', goal.commitment, `agendaGoals.${goal.id}.commitment`),
        ],
        tick: next.tick,
      });
    }
    if (goal.status === 'pending') continue;
    if (goalSatisfied(next, goal)) {
      next = resolveGoal(next, goal, 'completed');
    } else if (goal.deadlineMinute !== null && next.minute >= goal.deadlineMinute) {
      next = resolveGoal(next, goal, 'failed');
    } else if (goal.status === 'blocked' && goal.lastPlannedWorldRevision !== next.worldRevision) {
      next = {
        ...next,
        agendaGoals: next.agendaGoals.map(candidate =>
          candidate.id === goal?.id
            ? { ...candidate, lastPlannedWorldRevision: null, status: 'active' }
            : candidate,
        ),
      };
    }
  }
  return next;
}

function createIntention(
  state: SimulationState,
  plan: AgendaPlan,
  task: TaskOperator,
): TaskIntention {
  const agent = findAgent(state, plan.actorId);
  const atLocation = distance(agent.position, locationCenter(state, task.locationId)) < 0.01;
  const waiting =
    atLocation && task.availableFromMinute !== null && state.minute < task.availableFromMinute;
  return {
    actorId: plan.actorId,
    goalId: plan.goalId,
    phase: atLocation ? (waiting ? 'waiting' : 'work') : 'travel',
    planId: plan.id,
    remainingMinutes: task.durationMinutes,
    startedMinute: atLocation && !waiting ? state.minute : null,
    taskId: task.id,
  };
}

function planForActor(state: SimulationState, actorId: string): SimulationState {
  const agent = findAgent(state, actorId);
  const goals = state.agendaGoals.filter(
    goal =>
      goal.actorId === actorId &&
      goal.status === 'active' &&
      goal.lastPlannedWorldRevision !== state.worldRevision,
  );
  if (goals.length === 0) return state;

  let agendaGoals = state.agendaGoals;
  const candidates: PlanCandidateEvaluation[] = [];
  for (const goal of goals) {
    const goalCandidates = planCandidates(state, agent, goal);
    candidates.push(...goalCandidates);
    agendaGoals = agendaGoals.map(candidate =>
      candidate.id === goal.id
        ? {
            ...candidate,
            lastPlannedWorldRevision: state.worldRevision,
            status: goalCandidates.length === 0 ? 'blocked' : 'active',
          }
        : candidate,
    );
  }
  let selected = candidates[0] ?? null;
  for (const candidate of candidates.slice(1)) {
    if (selected === null || candidate.score > selected.score) selected = candidate;
  }
  const decision: AgendaDecisionRecord = {
    actorId,
    candidates,
    id: `${state.tick}:${actorId}:agenda:${state.worldRevision}`,
    minute: state.minute,
    selectedPlanId: selected?.id ?? null,
    tick: state.tick,
    worldRevision: state.worldRevision,
  };
  let next: SimulationState = {
    ...state,
    agendaDecisions: appendBounded(state.agendaDecisions, decision, MAX_AGENDA_DECISIONS),
    agendaGoals,
  };
  for (const candidate of candidates) {
    next = addTrace(next, {
      agentId: actorId,
      id: `${state.tick}:${actorId}:agenda:${candidate.id}`,
      kind: 'agenda',
      minute: state.minute,
      selection: null,
      summary: `${candidate.id}: score ${candidate.score.toFixed(4)}`,
      terms: [
        traceTerm('goal', candidate.goalId, `agendaGoals.${candidate.goalId}`),
        traceTerm(
          'goal-utility',
          candidate.goalUtility,
          `agendaGoals.${candidate.goalId}.successTurns`,
          `agendaGoals.${candidate.goalId}.failureTurns`,
          `agents.${actorId}.values`,
        ),
        traceTerm(
          'task-utility',
          candidate.taskUtility,
          ...candidate.taskIds.map(taskId => `scenario.taskOperators.${taskId}.valueTurns`),
        ),
        traceTerm(
          'resource-cost',
          candidate.resourceCost,
          ...candidate.taskIds.map(taskId => `scenario.taskOperators.${taskId}.resourceCosts`),
          `agents.${actorId}.resources`,
        ),
        ...(Object.keys(candidate.resourceCosts) as (keyof ResourceState)[])
          .filter(resourceId => candidate.resourceCosts[resourceId] > 0)
          .map(resourceId =>
            traceTerm(
              `resource:${resourceId}`,
              -candidate.resourceCosts[resourceId],
              ...candidate.taskIds.map(
                taskId => `scenario.taskOperators.${taskId}.resourceCosts.${resourceId}`,
              ),
            ),
          ),
        traceTerm(
          'urgency',
          candidate.urgency,
          `agendaGoals.${candidate.goalId}.deadlineMinute`,
          `agendaDecisions.${decision.id}.candidates.${candidate.id}.estimatedCompletionMinute`,
        ),
        traceTerm(
          'completion',
          candidate.estimatedCompletionMinute,
          ...candidate.taskIds.map(taskId => `scenario.taskOperators.${taskId}.durationMinutes`),
        ),
        ...candidate.taskIds.map(taskId =>
          traceTerm('task', taskId, `scenario.taskOperators.${taskId}`),
        ),
      ],
      tick: state.tick,
    });
  }
  if (selected === null) {
    return addTrace(next, {
      agentId: actorId,
      id: `${state.tick}:${actorId}:agenda:blocked`,
      kind: 'agenda',
      minute: state.minute,
      selection: { rule: 'highest-score-then-authored-order', selectedId: null },
      summary: `${agent.profile.name} found no feasible plan`,
      terms: goals.map(goal => traceTerm('blocked-goal', goal.id, `agendaGoals.${goal.id}`)),
      tick: state.tick,
    });
  }

  const plan: AgendaPlan = {
    actorId,
    createdMinute: state.minute,
    estimatedCompletionMinute: selected.estimatedCompletionMinute,
    goalId: selected.goalId,
    id: selected.id,
    score: selected.score,
    taskIds: selected.taskIds,
  };
  const firstTaskId = plan.taskIds[0];
  if (firstTaskId === undefined) throw new Error('A feasible plan always contains a task');
  const task = findTask(state, firstTaskId);
  const intention = createIntention(state, plan, task);
  next = {
    ...next,
    intentions: [...next.intentions, intention],
    plans: [...next.plans, plan],
  };
  return addTrace(next, {
    agentId: actorId,
    id: `${state.tick}:${actorId}:intention:${task.id}`,
    kind: 'intention',
    minute: state.minute,
    selection: { rule: 'highest-score-then-authored-order', selectedId: plan.id },
    summary: `${agent.profile.name} intends to ${task.label.toLowerCase()}`,
    terms: [
      traceTerm('goal', plan.goalId, `agendaGoals.${plan.goalId}`),
      traceTerm('plan', plan.id, `plans.${plan.id}`),
      traceTerm('score', plan.score, `agendaDecisions.${decision.id}.candidates.${plan.id}.score`),
      traceTerm('phase', intention.phase, `intentions.${actorId}.phase`),
    ],
    tick: state.tick,
  });
}

function cancelInvalidIntentions(state: SimulationState): SimulationState {
  let next = state;
  const facts = factMap(state.worldFacts);
  for (const intention of state.intentions) {
    const task = findTask(state, intention.taskId);
    const goal = state.agendaGoals.find(candidate => candidate.id === intention.goalId);
    const invalid =
      goal === undefined ||
      goal.status !== 'active' ||
      !conditionsMet(facts, task.preconditions) ||
      (task.availableUntilMinute !== null && state.minute >= task.availableUntilMinute);
    if (!invalid) continue;
    next = {
      ...next,
      agendaGoals: next.agendaGoals.map(candidate =>
        candidate.id === intention.goalId
          ? { ...candidate, lastPlannedWorldRevision: null, status: 'active' }
          : candidate,
      ),
      intentions: next.intentions.filter(candidate => candidate !== intention),
      plans: next.plans.filter(plan => plan.id !== intention.planId),
    };
    next = addTrace(next, {
      agentId: intention.actorId,
      id: `${state.tick}:${intention.actorId}:intention:canceled:${task.id}`,
      kind: 'intention',
      minute: state.minute,
      selection: null,
      summary: `Canceled intention: ${task.label}`,
      terms: [
        traceTerm('task', task.id, `scenario.taskOperators.${task.id}`),
        traceTerm(
          'reason',
          'precondition-or-window-changed',
          `scenario.taskOperators.${task.id}.preconditions`,
          `scenario.taskOperators.${task.id}.availableUntilMinute`,
          'worldFacts',
        ),
      ],
      tick: state.tick,
    });
  }
  return next;
}

export function prepareAgenda(state: SimulationState): SimulationState {
  let next = settleGoals(state);
  next = cancelInvalidIntentions(next);
  const actorIds = [
    ...new Set(
      next.agendaGoals
        .filter(goal => goal.status === 'active' || goal.status === 'blocked')
        .map(goal => goal.actorId),
    ),
  ];
  for (const actorId of actorIds) {
    if (next.intentions.some(intention => intention.actorId === actorId)) continue;
    next = planForActor(next, actorId);
  }
  return next;
}

export function intendedTask(state: SimulationState, agentId: string): TaskOperator | null {
  const intention = state.intentions.find(candidate => candidate.actorId === agentId);
  return intention === undefined ? null : findTask(state, intention.taskId);
}

export function setWorldFactAmount(
  state: SimulationState,
  factId: string,
  amount: number,
): SimulationState {
  const fact = state.worldFacts.find(candidate => candidate.id === factId);
  if (fact === undefined) throw new RangeError(`Unknown world fact "${factId}"`);
  if (!Number.isFinite(amount)) throw new RangeError('world fact amount must be finite');
  const nextAmount = clamp(amount, 0, 1_000_000);
  if (nextAmount === fact.amount) return state;
  const worldRevision = state.worldRevision + 1;
  const next = addTrace(
    {
      ...state,
      worldFacts: state.worldFacts.map(candidate =>
        candidate.id === factId ? { ...candidate, amount: nextAmount } : candidate,
      ),
      worldRevision,
    },
    {
      agentId: null,
      id: `${state.tick}:world-fact:${factId}:${worldRevision}`,
      kind: 'intervention',
      minute: state.minute,
      selection: null,
      summary: `Set ${factId} to ${nextAmount}`,
      terms: [
        traceTerm('world-fact', nextAmount, `intervention.worldFacts.${factId}`),
        traceTerm('world-revision', worldRevision, 'worldRevision'),
      ],
      tick: state.tick,
    },
  );
  return prepareAgenda(next);
}

function replaceIntention(state: SimulationState, intention: TaskIntention): SimulationState {
  return {
    ...state,
    intentions: state.intentions.map(candidate =>
      candidate.actorId === intention.actorId ? intention : candidate,
    ),
  };
}

function completeTask(
  state: SimulationState,
  intention: TaskIntention,
  task: TaskOperator,
): SimulationState {
  const facts = factMap(state.worldFacts);
  const effects = conditionsMet(facts, task.preconditions) ? applyEffects(facts, task) : null;
  const agent = findAgent(state, intention.actorId);
  const costs = addResourceCosts(emptyResourceCosts(), task.resourceCosts);
  if (effects === null || !resourcesAvailable(agent, costs)) {
    let canceled: SimulationState = {
      ...state,
      agendaGoals: state.agendaGoals.map(goal =>
        goal.id === intention.goalId
          ? { ...goal, lastPlannedWorldRevision: null, status: 'active' }
          : goal,
      ),
      intentions: state.intentions.filter(candidate => candidate.actorId !== intention.actorId),
      plans: state.plans.filter(plan => plan.id !== intention.planId),
    };
    canceled = addTrace(canceled, {
      agentId: intention.actorId,
      id: `${state.tick}:${intention.actorId}:task:failed:${task.id}`,
      kind: 'task',
      minute: state.minute,
      selection: null,
      summary: `${agent.profile.name} could not complete ${task.label.toLowerCase()}`,
      terms: [
        traceTerm('task', task.id, `scenario.taskOperators.${task.id}`),
        traceTerm(
          'reason',
          'completion-precondition-failed',
          `scenario.taskOperators.${task.id}.preconditions`,
          `scenario.taskOperators.${task.id}.resourceCosts`,
          `agents.${agent.id}.resources`,
          'worldFacts',
        ),
      ],
      tick: state.tick,
    });
    return canceled;
  }

  const resources: ResourceState = {
    executiveBudget: agent.resources.executiveBudget - costs.executiveBudget,
    physicalStamina: agent.resources.physicalStamina - costs.physicalStamina,
    regulationReserve: agent.resources.regulationReserve - costs.regulationReserve,
    socialBattery: agent.resources.socialBattery - costs.socialBattery,
  };
  const summary = `${agent.profile.name} completed ${task.label.toLowerCase()}`;
  let next: SimulationState = {
    ...state,
    agents: state.agents.map(candidate =>
      candidate.id === agent.id
        ? { ...applyTurns(candidate, task.valueTurns), currentActivity: task.label, resources }
        : candidate,
    ),
    agendaGoals: state.agendaGoals.map(goal =>
      goal.id === intention.goalId ? { ...goal, lastPlannedWorldRevision: null } : goal,
    ),
    intentions: state.intentions.filter(candidate => candidate.actorId !== intention.actorId),
    plans: state.plans.filter(plan => plan.id !== intention.planId),
    worldFacts: state.worldFacts.map(fact => ({
      ...fact,
      amount: effects.get(fact.id) ?? fact.amount,
    })),
    worldRevision: state.worldRevision + 1,
  };
  next = addMemory(next, agent.id, {
    id: `${state.tick}:${agent.id}:task:${task.id}`,
    minute: state.minute,
    summary,
    type: 'task',
  });
  next = addTrace(next, {
    agentId: agent.id,
    id: `${state.tick}:${agent.id}:task:${task.id}`,
    kind: 'task',
    minute: state.minute,
    selection: null,
    summary,
    terms: [
      traceTerm('task', task.id, `scenario.taskOperators.${task.id}`),
      ...task.effects.map(effect =>
        traceTerm(
          `fact:${effect.factId}`,
          effect.delta,
          `scenario.taskOperators.${task.id}.effects.${effect.factId}`,
        ),
      ),
      ...(Object.keys(task.resourceCosts) as (keyof ResourceState)[]).map(resourceId =>
        traceTerm(
          `resource:${resourceId}`,
          -(task.resourceCosts[resourceId] ?? 0),
          `scenario.taskOperators.${task.id}.resourceCosts.${resourceId}`,
        ),
      ),
    ],
    tick: state.tick,
  });
  return settleGoals(next);
}

export function advanceIntentions(state: SimulationState): SimulationState {
  let next = state;
  for (const initialIntention of state.intentions) {
    const intention = next.intentions.find(
      candidate =>
        candidate.actorId === initialIntention.actorId &&
        candidate.taskId === initialIntention.taskId,
    );
    if (intention === undefined) continue;
    const task = findTask(next, intention.taskId);
    const agent = findAgent(next, intention.actorId);
    if (intention.phase === 'travel') {
      if (agent.currentLocationId !== task.locationId) continue;
      const waiting = task.availableFromMinute !== null && next.minute < task.availableFromMinute;
      next = replaceIntention(next, {
        ...intention,
        phase: waiting ? 'waiting' : 'work',
        startedMinute: waiting ? null : next.minute,
      });
      continue;
    }
    if (intention.phase === 'waiting') {
      if (task.availableFromMinute !== null && next.minute < task.availableFromMinute) continue;
      next = replaceIntention(next, {
        ...intention,
        phase: 'work',
        startedMinute: next.minute,
      });
      continue;
    }
    const remainingMinutes = intention.remainingMinutes - next.scenario.tickMinutes;
    if (remainingMinutes > 0) {
      next = replaceIntention(next, { ...intention, remainingMinutes });
    } else {
      next = completeTask(next, intention, task);
    }
  }
  return settleGoals(next);
}
