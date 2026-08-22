import { VALUE_IDS, type SimulationSnapshotFile } from '../model/types.js';
import { parseScenario, ScenarioValidationError } from './parse.js';

const CASCADE_POSITIONS = new Set(['none', 'freeze', 'fight', 'flight', 'fawn', 'flop']);
const MEMORY_TYPES = new Set([
  'activity',
  'aftermath',
  'disclosure',
  'formative',
  'goal',
  'intervention',
  'task',
]);
const TRACE_KINDS = new Set([
  'activity',
  'aftermath',
  'agenda',
  'appraisal',
  'decision',
  'disclosure-appraisal',
  'disclosure-decision',
  'goal',
  'intervention',
  'intention',
  'relationship',
  'scenario',
  'task',
  'value-turn',
]);
const GOAL_STATUSES = new Set(['active', 'blocked', 'completed', 'failed', 'pending']);
const INTENTION_PHASES = new Set(['travel', 'waiting', 'work']);

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ScenarioValidationError(path, 'expected an object');
  }
  return value as Record<string, unknown>;
}

function arrayValue(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ScenarioValidationError(path, 'expected an array');
  return value;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ScenarioValidationError(path, 'expected a non-empty string');
  }
  return value;
}

function numberValue(
  value: unknown,
  path: string,
  minimum = Number.NEGATIVE_INFINITY,
  maximum = Number.POSITIVE_INFINITY,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ScenarioValidationError(path, 'expected a finite number');
  }
  if (value < minimum || value > maximum) {
    throw new ScenarioValidationError(path, `expected a number from ${minimum} through ${maximum}`);
  }
  return value;
}

function integerValue(value: unknown, path: string, minimum = 0): number {
  const result = numberValue(value, path, minimum, Number.MAX_SAFE_INTEGER);
  if (!Number.isInteger(result)) throw new ScenarioValidationError(path, 'expected an integer');
  return result;
}

function validatePoint(value: unknown, path: string): void {
  const point = objectValue(value, path);
  numberValue(point.x, `${path}.x`);
  numberValue(point.y, `${path}.y`);
}

function validateValueState(value: unknown, path: string): void {
  const state = objectValue(value, path);
  numberValue(state.charge, `${path}.charge`, -1, 1);
  numberValue(state.deficitIntegral, `${path}.deficitIntegral`, 0, 1);
  numberValue(state.variance, `${path}.variance`, 0, 1);
}

function validateAgent(value: unknown, path: string): void {
  const agent = objectValue(value, path);
  stringValue(agent.id, `${path}.id`);
  stringValue(agent.profileId, `${path}.profileId`);
  validatePoint(agent.position, `${path}.position`);
  validatePoint(agent.destination, `${path}.destination`);
  if (agent.currentLocationId !== null) {
    stringValue(agent.currentLocationId, `${path}.currentLocationId`);
  }
  stringValue(agent.currentActivity, `${path}.currentActivity`);
  if (typeof agent.cascade !== 'string' || !CASCADE_POSITIONS.has(agent.cascade)) {
    throw new ScenarioValidationError(`${path}.cascade`, 'expected a known cascade position');
  }
  numberValue(agent.walkingMetersPerMinute, `${path}.walkingMetersPerMinute`, 0.1, 500);

  const resources = objectValue(agent.resources, `${path}.resources`);
  for (const resourceId of [
    'executiveBudget',
    'physicalStamina',
    'regulationReserve',
    'socialBattery',
  ]) {
    numberValue(resources[resourceId], `${path}.resources.${resourceId}`, 0, 1);
  }

  const values = objectValue(agent.values, `${path}.values`);
  for (const valueId of VALUE_IDS) validateValueState(values[valueId], `${path}.values.${valueId}`);

  const schedule = arrayValue(agent.schedule, `${path}.schedule`);
  if (schedule.length === 0) {
    throw new ScenarioValidationError(`${path}.schedule`, 'expected at least one block');
  }
  schedule.forEach((value, index) => {
    const blockPath = `${path}.schedule[${index}]`;
    const block = objectValue(value, blockPath);
    integerValue(block.startMinute, `${blockPath}.startMinute`);
    stringValue(block.locationId, `${blockPath}.locationId`);
    stringValue(block.activity, `${blockPath}.activity`);
  });

  arrayValue(agent.memories, `${path}.memories`).forEach((value, index) => {
    const memoryPath = `${path}.memories[${index}]`;
    const memory = objectValue(value, memoryPath);
    stringValue(memory.id, `${memoryPath}.id`);
    integerValue(memory.minute, `${memoryPath}.minute`, -1);
    stringValue(memory.summary, `${memoryPath}.summary`);
    if (typeof memory.type !== 'string' || !MEMORY_TYPES.has(memory.type)) {
      throw new ScenarioValidationError(`${memoryPath}.type`, 'expected a known memory type');
    }
  });
}

function validateTrace(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    stringValue(entry.id, `${entryPath}.id`);
    if (entry.agentId !== null) stringValue(entry.agentId, `${entryPath}.agentId`);
    integerValue(entry.minute, `${entryPath}.minute`);
    integerValue(entry.tick, `${entryPath}.tick`);
    stringValue(entry.summary, `${entryPath}.summary`);
    if (typeof entry.kind !== 'string' || !TRACE_KINDS.has(entry.kind)) {
      throw new ScenarioValidationError(`${entryPath}.kind`, 'expected a known trace kind');
    }
    arrayValue(entry.causes, `${entryPath}.causes`).forEach((cause, causeIndex) => {
      stringValue(cause, `${entryPath}.causes[${causeIndex}]`);
    });
  });
}

function validateDecisionHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    stringValue(entry.id, `${entryPath}.id`);
    stringValue(entry.actorId, `${entryPath}.actorId`);
    stringValue(entry.opportunityId, `${entryPath}.opportunityId`);
    stringValue(entry.selectedCandidateId, `${entryPath}.selectedCandidateId`);
    if (entry.targetId !== null) stringValue(entry.targetId, `${entryPath}.targetId`);
    integerValue(entry.minute, `${entryPath}.minute`);
    integerValue(entry.tick, `${entryPath}.tick`);
    const candidates = arrayValue(entry.candidates, `${entryPath}.candidates`);
    if (candidates.length === 0) {
      throw new ScenarioValidationError(
        `${entryPath}.candidates`,
        'expected at least one candidate',
      );
    }
    candidates.forEach((candidateValue, candidateIndex) => {
      const candidatePath = `${entryPath}.candidates[${candidateIndex}]`;
      const candidate = objectValue(candidateValue, candidatePath);
      stringValue(candidate.candidateId, `${candidatePath}.candidateId`);
      stringValue(candidate.label, `${candidatePath}.label`);
      stringValue(candidate.operation, `${candidatePath}.operation`);
      const appraisal = objectValue(candidate.appraisal, `${candidatePath}.appraisal`);
      for (const key of [
        'contractViolationCost',
        'narrativeExpression',
        'repercussionCost',
        'turnFelt',
        'utility',
      ]) {
        numberValue(appraisal[key], `${candidatePath}.appraisal.${key}`);
      }
      arrayValue(appraisal.contributions, `${candidatePath}.appraisal.contributions`).forEach(
        (contributionValue, contributionIndex) => {
          const contributionPath = `${candidatePath}.appraisal.contributions[${contributionIndex}]`;
          const contribution = objectValue(contributionValue, contributionPath);
          stringValue(contribution.subjectId, `${contributionPath}.subjectId`);
          stringValue(contribution.value, `${contributionPath}.value`);
          for (const key of ['amount', 'empathy', 'turn', 'weight']) {
            numberValue(contribution[key], `${contributionPath}.${key}`);
          }
        },
      );
      const weights = objectValue(
        candidate.effectiveValueWeights,
        `${candidatePath}.effectiveValueWeights`,
      );
      for (const valueId of VALUE_IDS) {
        numberValue(weights[valueId], `${candidatePath}.effectiveValueWeights.${valueId}`, 0);
      }
      arrayValue(candidate.empathy, `${candidatePath}.empathy`).forEach(
        (empathyValue, empathyIndex) => {
          const empathyPath = `${candidatePath}.empathy[${empathyIndex}]`;
          const empathy = objectValue(empathyValue, empathyPath);
          stringValue(empathy.observerId, `${empathyPath}.observerId`);
          stringValue(empathy.subjectId, `${empathyPath}.subjectId`);
          for (const key of ['distance', 'effectiveFloor', 'empathy']) {
            numberValue(empathy[key], `${empathyPath}.${key}`, 0, 1);
          }
          const features = objectValue(empathy.features, `${empathyPath}.features`);
          for (const key of ['category', 'familiarity', 'kinship', 'reciprocity', 'similarity']) {
            numberValue(features[key], `${empathyPath}.features.${key}`, 0, 1);
          }
        },
      );
      const repercussion = objectValue(candidate.repercussion, `${candidatePath}.repercussion`);
      numberValue(repercussion.cost, `${candidatePath}.repercussion.cost`, 0);
      numberValue(repercussion.probability, `${candidatePath}.repercussion.probability`, 0, 1);
      arrayValue(repercussion.witnesses, `${candidatePath}.repercussion.witnesses`).forEach(
        (witnessValue, witnessIndex) => {
          const witnessPath = `${candidatePath}.repercussion.witnesses[${witnessIndex}]`;
          const witness = objectValue(witnessValue, witnessPath);
          stringValue(witness.witnessId, `${witnessPath}.witnessId`);
          numberValue(witness.actorEmpathy, `${witnessPath}.actorEmpathy`, 0, 1);
          numberValue(witness.targetEmpathy, `${witnessPath}.targetEmpathy`, 0, 1);
          numberValue(witness.reportProbability, `${witnessPath}.reportProbability`, 0, 1);
        },
      );
    });
  });
}

function validateDisclosureHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((entryValue, index) => {
    const entryPath = `${path}[${index}]`;
    const entry = objectValue(entryValue, entryPath);
    stringValue(entry.id, `${entryPath}.id`);
    stringValue(entry.ownerId, `${entryPath}.ownerId`);
    stringValue(entry.itemId, `${entryPath}.itemId`);
    stringValue(entry.opportunityId, `${entryPath}.opportunityId`);
    integerValue(entry.minute, `${entryPath}.minute`);
    integerValue(entry.tick, `${entryPath}.tick`);
    numberValue(entry.disclosureBenefit, `${entryPath}.disclosureBenefit`);
    numberValue(entry.worstCost, `${entryPath}.worstCost`, 0);
    numberValue(entry.utility, `${entryPath}.utility`);
    if (entry.worstAudienceId !== null) {
      stringValue(entry.worstAudienceId, `${entryPath}.worstAudienceId`);
    }
    if (entry.outcome !== 'conceal' && entry.outcome !== 'disclose') {
      throw new ScenarioValidationError(`${entryPath}.outcome`, 'expected conceal or disclose');
    }
    arrayValue(entry.audiences, `${entryPath}.audiences`).forEach(
      (audienceValue, audienceIndex) => {
        const audiencePath = `${entryPath}.audiences[${audienceIndex}]`;
        const audience = objectValue(audienceValue, audiencePath);
        stringValue(audience.audienceId, `${audiencePath}.audienceId`);
        for (const key of [
          'disclosureSafety',
          'embeddedness',
          'estimatedEmpathy',
          'exposureRisk',
          'subjectiveCost',
        ]) {
          numberValue(audience[key], `${audiencePath}.${key}`, 0);
        }
      },
    );
  });
}

function validateIdentifierList(value: unknown, path: string): void {
  const values = arrayValue(value, path);
  values.forEach((entry, index) => {
    stringValue(entry, `${path}[${index}]`);
  });
  if (new Set(values).size !== values.length) {
    throw new ScenarioValidationError(path, 'duplicate identifier');
  }
}

function validateAgendaState(value: unknown, path: string): void {
  arrayValue(value, path).forEach((goalValue, index) => {
    const goalPath = `${path}[${index}]`;
    const goal = objectValue(goalValue, goalPath);
    if (typeof goal.status !== 'string' || !GOAL_STATUSES.has(goal.status)) {
      throw new ScenarioValidationError(`${goalPath}.status`, 'expected a known goal status');
    }
    if (goal.lastPlannedWorldRevision !== null) {
      integerValue(goal.lastPlannedWorldRevision, `${goalPath}.lastPlannedWorldRevision`);
    }
    if (goal.resolvedMinute !== null) {
      integerValue(goal.resolvedMinute, `${goalPath}.resolvedMinute`);
    }
  });
}

function validatePlans(value: unknown, path: string): void {
  arrayValue(value, path).forEach((planValue, index) => {
    const planPath = `${path}[${index}]`;
    const plan = objectValue(planValue, planPath);
    stringValue(plan.id, `${planPath}.id`);
    stringValue(plan.actorId, `${planPath}.actorId`);
    stringValue(plan.goalId, `${planPath}.goalId`);
    integerValue(plan.createdMinute, `${planPath}.createdMinute`);
    integerValue(plan.estimatedCompletionMinute, `${planPath}.estimatedCompletionMinute`);
    numberValue(plan.score, `${planPath}.score`);
    const taskIds = arrayValue(plan.taskIds, `${planPath}.taskIds`);
    if (taskIds.length === 0) {
      throw new ScenarioValidationError(`${planPath}.taskIds`, 'expected at least one task');
    }
    taskIds.forEach((taskId, taskIndex) => {
      stringValue(taskId, `${planPath}.taskIds[${taskIndex}]`);
    });
  });
}

function validateIntentions(value: unknown, path: string): void {
  arrayValue(value, path).forEach((intentionValue, index) => {
    const intentionPath = `${path}[${index}]`;
    const intention = objectValue(intentionValue, intentionPath);
    stringValue(intention.actorId, `${intentionPath}.actorId`);
    stringValue(intention.goalId, `${intentionPath}.goalId`);
    stringValue(intention.planId, `${intentionPath}.planId`);
    stringValue(intention.taskId, `${intentionPath}.taskId`);
    numberValue(intention.remainingMinutes, `${intentionPath}.remainingMinutes`, 0);
    if (intention.startedMinute !== null) {
      integerValue(intention.startedMinute, `${intentionPath}.startedMinute`);
    }
    if (typeof intention.phase !== 'string' || !INTENTION_PHASES.has(intention.phase)) {
      throw new ScenarioValidationError(
        `${intentionPath}.phase`,
        'expected a known intention phase',
      );
    }
  });
}

function validatePlanAppraisal(value: unknown, path: string): void {
  const appraisal = objectValue(value, path);
  for (const key of [
    'contractViolationCost',
    'narrativeExpression',
    'repercussionCost',
    'turnFelt',
    'utility',
  ]) {
    numberValue(appraisal[key], `${path}.${key}`);
  }
  arrayValue(appraisal.contributions, `${path}.contributions`).forEach(
    (contributionValue, index) => {
      const contributionPath = `${path}.contributions[${index}]`;
      const contribution = objectValue(contributionValue, contributionPath);
      stringValue(contribution.subjectId, `${contributionPath}.subjectId`);
      stringValue(contribution.value, `${contributionPath}.value`);
      for (const key of ['amount', 'empathy', 'turn', 'weight']) {
        numberValue(contribution[key], `${contributionPath}.${key}`);
      }
    },
  );
}

function validateAgendaHistory(value: unknown, path: string): void {
  arrayValue(value, path).forEach((decisionValue, index) => {
    const decisionPath = `${path}[${index}]`;
    const decision = objectValue(decisionValue, decisionPath);
    stringValue(decision.id, `${decisionPath}.id`);
    stringValue(decision.actorId, `${decisionPath}.actorId`);
    integerValue(decision.minute, `${decisionPath}.minute`);
    integerValue(decision.tick, `${decisionPath}.tick`);
    integerValue(decision.worldRevision, `${decisionPath}.worldRevision`);
    if (decision.selectedPlanId !== null) {
      stringValue(decision.selectedPlanId, `${decisionPath}.selectedPlanId`);
    }
    const candidateIds: string[] = [];
    arrayValue(decision.candidates, `${decisionPath}.candidates`).forEach(
      (candidateValue, candidateIndex) => {
        const candidatePath = `${decisionPath}.candidates[${candidateIndex}]`;
        const candidate = objectValue(candidateValue, candidatePath);
        candidateIds.push(stringValue(candidate.id, `${candidatePath}.id`));
        stringValue(candidate.goalId, `${candidatePath}.goalId`);
        integerValue(
          candidate.estimatedCompletionMinute,
          `${candidatePath}.estimatedCompletionMinute`,
        );
        integerValue(
          candidate.estimatedDurationMinutes,
          `${candidatePath}.estimatedDurationMinutes`,
        );
        for (const key of ['goalUtility', 'resourceCost', 'score', 'taskUtility', 'urgency']) {
          numberValue(candidate[key], `${candidatePath}.${key}`);
        }
        const resourceCosts = objectValue(
          candidate.resourceCosts,
          `${candidatePath}.resourceCosts`,
        );
        for (const resourceId of [
          'executiveBudget',
          'physicalStamina',
          'regulationReserve',
          'socialBattery',
        ]) {
          numberValue(resourceCosts[resourceId], `${candidatePath}.resourceCosts.${resourceId}`, 0);
        }
        arrayValue(candidate.taskIds, `${candidatePath}.taskIds`).forEach((taskId, taskIndex) => {
          stringValue(taskId, `${candidatePath}.taskIds[${taskIndex}]`);
        });
        validatePlanAppraisal(candidate.appraisal, `${candidatePath}.appraisal`);
      },
    );
    if (
      decision.selectedPlanId !== null &&
      !candidateIds.includes(decision.selectedPlanId as string)
    ) {
      throw new ScenarioValidationError(
        `${decisionPath}.selectedPlanId`,
        'selected plan must belong to the decision candidates',
      );
    }
  });
}

function migrateSnapshot(value: unknown): Record<string, unknown> {
  const file = clone(objectValue(value, 'snapshot'));
  if (file.schemaVersion === 2) return file;
  if (file.schemaVersion !== 1) {
    throw new ScenarioValidationError('snapshot.schemaVersion', 'unsupported schema version');
  }
  const scenario = parseScenario(file.scenario);
  file.scenario = scenario;
  file.agendaDecisions = [];
  file.agendaGoals = [];
  file.intentions = [];
  file.plans = [];
  file.worldFacts = scenario.worldFacts;
  file.worldRevision = 0;
  file.schemaVersion = 2;
  return file;
}

export function parseSnapshot(value: unknown): SimulationSnapshotFile {
  const file = migrateSnapshot(value);
  if (file.type !== 'verusim-snapshot') {
    throw new ScenarioValidationError('snapshot.type', 'expected verusim-snapshot');
  }
  if (file.schemaVersion !== 2) {
    throw new ScenarioValidationError('snapshot.schemaVersion', 'unsupported schema version');
  }
  const scenario = parseScenario(file.scenario);
  const environmentId = stringValue(file.environmentId, 'snapshot.environmentId');
  if (environmentId !== scenario.environmentId) {
    throw new ScenarioValidationError(
      'snapshot.environmentId',
      'must match the snapshot scenario environment',
    );
  }
  integerValue(file.minute, 'snapshot.minute');
  integerValue(file.tick, 'snapshot.tick');

  const agents = arrayValue(file.agents, 'snapshot.agents');
  agents.forEach((agent, index) => {
    validateAgent(agent, `snapshot.agents[${index}]`);
  });
  const agentIds = agents.map((agent, index) =>
    stringValue(objectValue(agent, `snapshot.agents[${index}]`).id, `snapshot.agents[${index}].id`),
  );
  if (new Set(agentIds).size !== agentIds.length) {
    throw new ScenarioValidationError('snapshot.agents', 'duplicate agent identifier');
  }

  const runtimeScenario = parseScenario({
    ...scenario,
    agendaGoals: file.agendaGoals,
    disclosureItems: file.disclosureItems,
    dyads: file.dyads,
    worldFacts: file.worldFacts,
  });
  validateAgendaState(file.agendaGoals, 'snapshot.agendaGoals');
  validateAgendaHistory(file.agendaDecisions, 'snapshot.agendaDecisions');
  validatePlans(file.plans, 'snapshot.plans');
  validateIntentions(file.intentions, 'snapshot.intentions');
  integerValue(file.worldRevision, 'snapshot.worldRevision');
  validateDecisionHistory(file.decisions, 'snapshot.decisions');
  validateDisclosureHistory(file.disclosureDecisions, 'snapshot.disclosureDecisions');
  validateTrace(file.trace, 'snapshot.trace');
  validateIdentifierList(file.resolvedOpportunityIds, 'snapshot.resolvedOpportunityIds');
  validateIdentifierList(
    file.resolvedDisclosureOpportunityIds,
    'snapshot.resolvedDisclosureOpportunityIds',
  );

  return {
    ...(file as unknown as SimulationSnapshotFile),
    agendaGoals: runtimeScenario.agendaGoals as SimulationSnapshotFile['agendaGoals'],
    disclosureItems: runtimeScenario.disclosureItems,
    dyads: runtimeScenario.dyads,
    scenario,
    worldFacts: runtimeScenario.worldFacts,
  };
}
