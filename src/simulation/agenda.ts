import { SECONDS_PER_MINUTE } from '../model/time.js';
import {
  appendBounded,
  clamp,
  memoryWindow,
  recordWindows,
  retainCharacterRecord,
} from '../model/retention.js';
import {
  VALUE_IDS,
  type AgendaDecisionRecord,
  type AgendaGoalState,
  type AgendaPlan,
  type FactCondition,
  type LayerPosition,
  type PlanCandidateEvaluation,
  type ResourceState,
  type RuntimeMemory,
  type CharacterInstance,
  type SimulationState,
  type TaskIntention,
  type TaskOperator,
  type TraceEntryInput,
  type ValueMap,
  type WorldFact,
} from '../model/types.js';
import { appraiseAction } from './appraisal.js';
import { evaluateEmpathy } from './empathy.js';
import { effectiveContractAdherence } from './history.js';
import { claimExpressionPayoff } from './narrative.js';
import { locationCenter, navigationDistance, sameLayerPosition } from './navigation.js';
import { effectiveValueWeights } from './salience.js';
import { somaticActionAvailable } from './somatic.js';
import { appendTrace, traceTerm } from './trace.js';
import { applyCharacterValueTurns } from './value-turn.js';

const MAX_PLAN_CANDIDATES = 24;
const MAX_PLAN_DEPTH = 8;
const MAX_SEARCH_NODES = 256;

interface SearchNode {
  facts: Map<string, number>;
  second: number;
  position: LayerPosition;
  resourceCosts: ResourceState;
  taskIds: string[];
}

const EMPTY_RESOURCE_COSTS: ResourceState = {
  executiveBudget: 0,
  physicalStamina: 0,
  regulationReserve: 0,
  socialBattery: 0,
};

function findAgent(state: SimulationState, instanceId: string): CharacterInstance {
  const agent = state.characters.find(candidate => candidate.id === instanceId);
  if (agent === undefined) throw new RangeError(`Unknown agenda agent "${instanceId}"`);
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

function taskLocationCenter(state: SimulationState, locationId: string): LayerPosition {
  const location = state.environment.locations.find(candidate => candidate.id === locationId);
  if (location === undefined) throw new RangeError(`Unknown task location "${locationId}"`);
  return locationCenter(location);
}

function tickDuration(seconds: number, tickSeconds: number): number {
  return Math.ceil(seconds / tickSeconds) * tickSeconds;
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

function resourcesAvailable(agent: CharacterInstance, costs: ResourceState): boolean {
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
  const actor = findAgent(state, actorId);
  const available = state.scenario.taskOperators.filter(
    task => task.actorIds.includes(actorId) && somaticActionAvailable(actor, task.somaticDemand),
  );
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
  agent: CharacterInstance,
  node: SearchNode,
  task: TaskOperator,
): { second: number; position: LayerPosition } | null {
  const position = taskLocationCenter(state, task.locationId);
  const travelSeconds = tickDuration(
    (navigationDistance(state.environment, node.position, position) /
      agent.walkingMetersPerMinute) *
      SECONDS_PER_MINUTE,
    state.scenario.tickSeconds,
  );
  const arrivalSecond = node.second + travelSeconds;
  const startSecond = Math.max(arrivalSecond, task.availableFromSecond ?? arrivalSecond);
  const second = startSecond + tickDuration(task.durationSeconds, state.scenario.tickSeconds);
  if (task.availableUntilSecond !== null && second > task.availableUntilSecond) return null;
  return { second, position };
}

function searchPlans(
  state: SimulationState,
  agent: CharacterInstance,
  goal: AgendaGoalState,
): SearchNode[] {
  const tasks = relevantTasks(state, agent.id, goal);
  const queue: SearchNode[] = [
    {
      facts: factMap(state.worldFacts),
      second: state.second,
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
        (goal.deadlineSecond !== null && timing.second > goal.deadlineSecond)
      ) {
        continue;
      }
      const facts = applyEffects(node.facts, task);
      if (facts === null) continue;
      const next: SearchNode = {
        facts,
        second: timing.second,
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

function resourceCost(agent: CharacterInstance, costs: ResourceState): number {
  return (Object.keys(EMPTY_RESOURCE_COSTS) as (keyof ResourceState)[]).reduce(
    (total, resourceId) => total + costs[resourceId] * (2 - agent.resources[resourceId]),
    0,
  );
}

function planCandidates(
  state: SimulationState,
  agent: CharacterInstance,
  goal: AgendaGoalState,
): PlanCandidateEvaluation[] {
  const nodes = searchPlans(state, agent, goal);
  const shortestDuration = Math.min(...nodes.map(node => node.second - state.second));
  const slack =
    goal.deadlineSecond === null
      ? Number.POSITIVE_INFINITY
      : goal.deadlineSecond - state.second - shortestDuration;
  const urgencyPosition =
    goal.deadlineSecond === null ? 0 : clamp(1 - slack / goal.urgencyHorizonSeconds, 0, 1);
  const urgency = 1 + urgencyPosition * urgencyPosition * 3;
  const goalTurns = subtractTurns(goal.successTurns, goal.failureTurns);
  const weights = effectiveValueWeights(agent);
  const selfEmpathy = evaluateEmpathy(state, agent.id, agent.id).empathy;
  const goalAppraisal = appraiseAction({
    contractViolationCost: 0,
    impacts: [{ empathy: selfEmpathy, subjectId: agent.id, turns: goalTurns }],
    narrativeExpression: claimExpressionPayoff(agent, goal.claimExpressions),
    repercussionCost: 0,
    valueWeights: weights,
  });

  return nodes.map(node => {
    let taskTurns: Partial<ValueMap<number>> = {};
    let taskExpressions = [] as TaskOperator['claimExpressions'];
    let contractViolation = 0;
    for (const taskId of node.taskIds) {
      const task = findTask(state, taskId);
      taskTurns = addTurns(taskTurns, task.valueTurns);
      taskExpressions = [...taskExpressions, ...task.claimExpressions];
      contractViolation += task.contractViolation;
    }
    const taskAppraisal = appraiseAction({
      contractViolationCost: effectiveContractAdherence(agent) * contractViolation,
      impacts: [{ empathy: selfEmpathy, subjectId: agent.id, turns: taskTurns }],
      narrativeExpression: claimExpressionPayoff(agent, taskExpressions),
      repercussionCost: 0,
      valueWeights: weights,
    });
    const combinedTurns = addTurns(goalTurns, taskTurns);
    const appraisal = appraiseAction({
      contractViolationCost: effectiveContractAdherence(agent) * contractViolation,
      impacts: [{ empathy: selfEmpathy, subjectId: agent.id, turns: combinedTurns }],
      narrativeExpression: claimExpressionPayoff(agent, [
        ...goal.claimExpressions,
        ...taskExpressions,
      ]),
      repercussionCost: 0,
      valueWeights: weights,
    });
    const cost = resourceCost(agent, node.resourceCosts);
    const goalUtility = goalAppraisal.utility;
    const taskUtility = taskAppraisal.utility;
    return {
      appraisal,
      estimatedCompletionSecond: node.second,
      estimatedDurationSeconds: node.second - state.second,
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

function addTrace(state: SimulationState, entry: TraceEntryInput): SimulationState {
  return { ...state, trace: appendTrace(state.trace, entry) };
}

function addMemory(
  state: SimulationState,
  instanceId: string,
  memory: RuntimeMemory,
): SimulationState {
  return {
    ...state,
    characters: state.characters.map(agent =>
      agent.id === instanceId
        ? { ...agent, memories: appendBounded(agent.memories, memory, memoryWindow(agent.tier)) }
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
      candidate.id === goal.id ? { ...candidate, resolvedSecond: state.second, status } : candidate,
    ),
    characters: state.characters.map(candidate =>
      candidate.id === agent.id ? applyCharacterValueTurns(candidate, turns) : candidate,
    ),
    intentions: state.intentions.filter(intention => intention.goalId !== goal.id),
    plans: state.plans.filter(plan => plan.goalId !== goal.id),
  };
  next = addMemory(next, agent.id, {
    id: `${state.tick}:${goal.id}:goal:${status}`,
    second: state.second,
    summary,
    type: 'goal',
  });
  return addTrace(next, {
    instanceId: agent.id,
    id: `${state.tick}:${goal.id}:goal:${status}`,
    kind: 'goal',
    second: state.second,
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
    if (goal.status === 'pending' && next.second >= goal.activationSecond) {
      next = {
        ...next,
        agendaGoals: next.agendaGoals.map(candidate =>
          candidate.id === goal?.id ? { ...candidate, status: 'active' } : candidate,
        ),
      };
      goal = next.agendaGoals.find(candidate => candidate.id === initialGoal.id);
      if (goal === undefined) continue;
      next = addTrace(next, {
        instanceId: goal.actorId,
        id: `${next.tick}:${goal.id}:goal:active`,
        kind: 'goal',
        second: next.second,
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
    } else if (goal.deadlineSecond !== null && next.second >= goal.deadlineSecond) {
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
  const atLocation = sameLayerPosition(agent.position, taskLocationCenter(state, task.locationId));
  const waiting =
    atLocation && task.availableFromSecond !== null && state.second < task.availableFromSecond;
  return {
    actorId: plan.actorId,
    goalId: plan.goalId,
    phase: atLocation ? (waiting ? 'waiting' : 'work') : 'travel',
    planId: plan.id,
    remainingSeconds: task.durationSeconds,
    startedSecond: atLocation && !waiting ? state.second : null,
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
    second: state.second,
    selectedPlanId: selected?.id ?? null,
    tick: state.tick,
    worldRevision: state.worldRevision,
  };
  let next: SimulationState = {
    ...state,
    agendaDecisions: retainCharacterRecord(
      state.agendaDecisions,
      decision,
      record => record.actorId,
      recordWindows(state.characters),
    ),
    agendaGoals,
  };
  for (const candidate of candidates) {
    next = addTrace(next, {
      instanceId: actorId,
      id: `${state.tick}:${actorId}:agenda:${candidate.id}`,
      kind: 'agenda',
      second: state.second,
      selection: null,
      summary: `${candidate.id}: score ${candidate.score.toFixed(4)}`,
      terms: [
        traceTerm(
          'candidate',
          candidate.id,
          `agendaDecisions.${decision.id}.candidates.${candidate.id}`,
        ),
        traceTerm('goal', candidate.goalId, `agendaGoals.${candidate.goalId}`),
        traceTerm(
          'goal-utility',
          candidate.goalUtility,
          `agendaGoals.${candidate.goalId}.successTurns`,
          `agendaGoals.${candidate.goalId}.failureTurns`,
          `characters.${actorId}.values`,
        ),
        traceTerm(
          'task-utility',
          candidate.taskUtility,
          ...candidate.taskIds.map(taskId => `scenario.taskOperators.${taskId}.valueTurns`),
        ),
        traceTerm(
          'narrative-expression',
          candidate.appraisal.narrativeExpression,
          `agendaGoals.${candidate.goalId}.claimExpressions`,
          ...candidate.taskIds.map(taskId => `scenario.taskOperators.${taskId}.claimExpressions`),
          `characters.${actorId}.narrative`,
        ),
        traceTerm(
          'resource-cost',
          candidate.resourceCost,
          ...candidate.taskIds.map(taskId => `scenario.taskOperators.${taskId}.resourceCosts`),
          `characters.${actorId}.resources`,
        ),
        ...(Object.keys(EMPTY_RESOURCE_COSTS) as (keyof ResourceState)[])
          .filter(resourceId => (candidate.resourceCosts[resourceId] ?? 0) > 0)
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
          `agendaGoals.${candidate.goalId}.deadlineSecond`,
          `agendaDecisions.${decision.id}.candidates.${candidate.id}.estimatedCompletionSecond`,
        ),
        traceTerm(
          'completion',
          candidate.estimatedCompletionSecond,
          ...candidate.taskIds.map(taskId => `scenario.taskOperators.${taskId}.durationSeconds`),
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
      instanceId: actorId,
      id: `${state.tick}:${actorId}:agenda:blocked`,
      kind: 'agenda',
      second: state.second,
      selection: { rule: 'highest-score-then-authored-order', selectedId: null },
      summary: `${agent.profile.name} found no feasible plan`,
      terms: goals.map(goal => traceTerm('blocked-goal', goal.id, `agendaGoals.${goal.id}`)),
      tick: state.tick,
    });
  }

  const plan: AgendaPlan = {
    actorId,
    createdSecond: state.second,
    estimatedCompletionSecond: selected.estimatedCompletionSecond,
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
    instanceId: actorId,
    id: `${state.tick}:${actorId}:intention:${task.id}`,
    kind: 'intention',
    second: state.second,
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
    const actor = findAgent(state, intention.actorId);
    const invalid =
      goal === undefined ||
      goal.status !== 'active' ||
      !conditionsMet(facts, task.preconditions) ||
      !somaticActionAvailable(actor, task.somaticDemand) ||
      (task.availableUntilSecond !== null && state.second >= task.availableUntilSecond);
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
      instanceId: intention.actorId,
      id: `${state.tick}:${intention.actorId}:intention:canceled:${task.id}`,
      kind: 'intention',
      second: state.second,
      selection: null,
      summary: `Canceled intention: ${task.label}`,
      terms: [
        traceTerm('task', task.id, `scenario.taskOperators.${task.id}`),
        traceTerm(
          'reason',
          'availability-changed',
          `scenario.taskOperators.${task.id}.preconditions`,
          `scenario.taskOperators.${task.id}.availableUntilSecond`,
          `characters.${actor.id}.somatic`,
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

export function intendedTask(state: SimulationState, instanceId: string): TaskOperator | null {
  const intention = state.intentions.find(candidate => candidate.actorId === instanceId);
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
      instanceId: null,
      id: `${state.tick}:world-fact:${factId}:${worldRevision}`,
      kind: 'intervention',
      second: state.second,
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
      instanceId: intention.actorId,
      id: `${state.tick}:${intention.actorId}:task:failed:${task.id}`,
      kind: 'task',
      second: state.second,
      selection: null,
      summary: `${agent.profile.name} could not complete ${task.label.toLowerCase()}`,
      terms: [
        traceTerm('task', task.id, `scenario.taskOperators.${task.id}`),
        traceTerm(
          'reason',
          'completion-precondition-failed',
          `scenario.taskOperators.${task.id}.preconditions`,
          `scenario.taskOperators.${task.id}.resourceCosts`,
          `characters.${agent.id}.resources`,
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
    characters: state.characters.map(candidate =>
      candidate.id === agent.id
        ? {
            ...applyCharacterValueTurns(candidate, task.valueTurns),
            currentActivity: task.label,
            resources,
          }
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
    second: state.second,
    summary,
    type: 'task',
  });
  next = addTrace(next, {
    instanceId: agent.id,
    id: `${state.tick}:${agent.id}:task:${task.id}`,
    kind: 'task',
    second: state.second,
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
      ...(Object.keys(EMPTY_RESOURCE_COSTS) as (keyof ResourceState)[])
        .filter(resourceId => resourceId in task.resourceCosts)
        .map(resourceId =>
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

export function advanceIntentions(state: SimulationState, elapsedSeconds: number): SimulationState {
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
      const waiting = task.availableFromSecond !== null && next.second < task.availableFromSecond;
      next = replaceIntention(next, {
        ...intention,
        phase: waiting ? 'waiting' : 'work',
        startedSecond: waiting ? null : next.second,
      });
      continue;
    }
    if (intention.phase === 'waiting') {
      if (task.availableFromSecond !== null && next.second < task.availableFromSecond) continue;
      next = replaceIntention(next, {
        ...intention,
        phase: 'work',
        startedSecond: next.second,
      });
      continue;
    }
    const remainingSeconds = intention.remainingSeconds - elapsedSeconds;
    if (remainingSeconds > 0) {
      next = replaceIntention(next, { ...intention, remainingSeconds });
    } else {
      next = completeTask(next, intention, task);
    }
  }
  return settleGoals(next);
}
