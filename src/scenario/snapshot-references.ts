import type { SimulationSnapshotFile, SimulationState } from '../model/types.js';
import { ScenarioValidationError } from '../model/validation.js';
import { isDerivedSomaticState } from '../simulation/somatic.js';
import { resourceAddressKey } from './parse.js';

// Cross-reference validation for a parsed snapshot against the freshly
// prepared base state it resumes into. `parseSnapshot` proves the file's own
// shape; these checks prove every identifier it carries names something the
// prepared content actually defines, and that derived aggregates match their
// sources. They live beside snapshot parsing rather than inside the runtime
// constructor so the transition module only assembles state, and each check
// is one entry in an ordered table so a new persisted collection adds a row
// rather than growing one function.

type SnapshotAddress = { kind: string; packageId: string; resourceId: string };

function sameAddress(left: SnapshotAddress, right: SnapshotAddress): boolean {
  return resourceAddressKey(left as never) === resourceAddressKey(right as never);
}

function sameResourceLock(
  left: readonly SnapshotAddress[],
  right: readonly SnapshotAddress[],
): boolean {
  return (
    left.length === right.length &&
    left.every((address, index) => sameAddress(address, right[index] as SnapshotAddress))
  );
}

function goalSeedSignature(goal: {
  actorId: string;
  claimExpressions: unknown;
  commitment: number;
  deadlineSecond: number | null;
  desired: unknown;
  failureTurns: unknown;
  id: string;
  label: string;
  source: string;
  successTurns: unknown;
  urgencyHorizonSeconds: number;
}): string {
  return JSON.stringify([
    goal.actorId,
    goal.claimExpressions,
    goal.commitment,
    goal.deadlineSecond,
    goal.desired,
    goal.failureTurns,
    goal.id,
    goal.label,
    goal.source,
    goal.successTurns,
    goal.urgencyHorizonSeconds,
  ]);
}

export interface SnapshotReferenceContext {
  base: SimulationState;
  snapshot: SimulationSnapshotFile;
}

type SnapshotReferenceValidator = (context: SnapshotReferenceContext) => void;

function validateLockAndAgents({ base, snapshot }: SnapshotReferenceContext): void {
  const baseAgents = new Map(base.characters.map(agent => [agent.id, agent]));
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
  if (
    snapshot.resourceLock.digest !== null &&
    snapshot.resourceLock.digest !== base.resourceLock.digest
  ) {
    throw new ScenarioValidationError(
      'snapshot.resourceLock.digest',
      'locked content changed at the same semantic addresses; prepare a new revision instead of resuming',
    );
  }
  if (snapshot.characters.length !== base.characters.length) {
    throw new ScenarioValidationError(
      'snapshot.characters',
      'must contain exactly the scenario agent instances',
    );
  }
  const locationIds = new Set(base.environment.locations.map(location => location.id));
  const layerIds = new Set(base.environment.layers.map(layer => layer.id));
  snapshot.characters.forEach((saved, index) => {
    const agent = baseAgents.get(saved.id);
    if (agent === undefined) {
      throw new ScenarioValidationError(
        `snapshot.characters[${index}].id`,
        `unknown agent "${saved.id}"`,
      );
    }
    const placement = base.scenario.characters.find(item => item.instanceId === saved.id);
    if (placement === undefined || !sameAddress(saved.profile, placement.profile)) {
      throw new ScenarioValidationError(
        `snapshot.characters[${index}].profile`,
        `expected character profile "${agent.profile.profileId}"`,
      );
    }
    if (saved.currentLocationId !== null && !locationIds.has(saved.currentLocationId)) {
      throw new ScenarioValidationError(
        `snapshot.characters[${index}].currentLocationId`,
        `unknown location "${saved.currentLocationId}"`,
      );
    }
    if (!layerIds.has(saved.position.layerId)) {
      throw new ScenarioValidationError(
        `snapshot.characters[${index}].position.layerId`,
        `unknown layer "${saved.position.layerId}"`,
      );
    }
    if (!layerIds.has(saved.destination.layerId)) {
      throw new ScenarioValidationError(
        `snapshot.characters[${index}].destination.layerId`,
        `unknown layer "${saved.destination.layerId}"`,
      );
    }
    saved.schedule.forEach((block, blockIndex) => {
      if (!locationIds.has(block.locationId)) {
        throw new ScenarioValidationError(
          `snapshot.characters[${index}].schedule[${blockIndex}].locationId`,
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
        `snapshot.characters[${index}].history.formativeRecords`,
        'must match formative execution for the prepared character profile',
      );
    }
    const empathyOverride = saved.history.overrides.empathy;
    const effectiveFloor = empathyOverride?.floor ?? agent.profile.empathy.floor;
    const effectiveCeiling = empathyOverride?.ceiling ?? agent.profile.empathy.ceiling;
    if (effectiveCeiling < effectiveFloor) {
      throw new ScenarioValidationError(
        `snapshot.characters[${index}].history.overrides.empathy.ceiling`,
        'expected effective ceiling at or above effective floor',
      );
    }
    if (!isDerivedSomaticState(saved.somatic)) {
      throw new ScenarioValidationError(
        `snapshot.characters[${index}].somatic`,
        'must match its exact sorted somatic source ledger',
      );
    }
  });
}

function validateCollections({ base, snapshot }: SnapshotReferenceContext): void {
  const baseAgents = new Map(base.characters.map(agent => [agent.id, agent]));
  const instanceIds = new Set(snapshot.characters.map(agent => agent.id));
  const outletAffordanceIds = new Set(base.environment.outletAffordances.map(item => item.id));
  snapshot.characters.forEach((saved, index) => {
    if (saved.cascadeTargetId !== null && !instanceIds.has(saved.cascadeTargetId)) {
      throw new ScenarioValidationError(
        `snapshot.characters[${index}].cascadeTargetId`,
        `unknown agent "${saved.cascadeTargetId}"`,
      );
    }
    if (
      saved.currentOutlet !== null &&
      !outletAffordanceIds.has(saved.currentOutlet.affordanceId)
    ) {
      throw new ScenarioValidationError(
        `snapshot.characters[${index}].currentOutlet.affordanceId`,
        `unknown outlet affordance "${saved.currentOutlet.affordanceId}"`,
      );
    }
    if (saved.narrative !== null) {
      const profileClaimIds = new Set(
        baseAgents.get(saved.id)?.profile.narrativeClaims.map(claim => claim.id),
      );
      if (
        saved.narrative.claims.length !== profileClaimIds.size ||
        saved.narrative.claims.some(claim => !profileClaimIds.has(claim.id))
      ) {
        throw new ScenarioValidationError(
          `snapshot.characters[${index}].narrative.claims`,
          'must contain exactly the character narrative claims',
        );
      }
    }
    saved.positionalRespect.references.forEach((reference, referenceIndex) => {
      if (!instanceIds.has(reference.subjectId) || reference.subjectId === saved.id) {
        throw new ScenarioValidationError(
          `snapshot.characters[${index}].positionalRespect.references[${referenceIndex}].subjectId`,
          'positional reference must name another snapshot agent',
        );
      }
    });
  });
  snapshot.dyads.forEach((dyad, index) => {
    if (!instanceIds.has(dyad.observerId) || !instanceIds.has(dyad.subjectId)) {
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
      !instanceIds.has(observation.observerId) ||
      !instanceIds.has(observation.subjectId) ||
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
    if (!incidentEventIds.has(record.eventId) || !instanceIds.has(record.observerId)) {
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
      !instanceIds.has(record.wearerId) ||
      record.appraisals.some(
        appraisal => appraisal.eventId !== record.eventId || !instanceIds.has(appraisal.observerId),
      )
    ) {
      throw new ScenarioValidationError(
        `snapshot.displayRecords[${index}]`,
        'display record must reference snapshot agents and an authored event',
      );
    }
  });
  snapshot.displayExposures.forEach((exposure, index) => {
    if (!instanceIds.has(exposure.observerId) || !displayIds.has(exposure.displayId)) {
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
      !instanceIds.has(record.subjectId) ||
      record.observations.some(
        observation =>
          observation.eventId !== record.eventId ||
          observation.subjectId !== record.subjectId ||
          !instanceIds.has(observation.observerId),
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
    if (!instanceIds.has(decision.requesterId) || !instanceIds.has(decision.responderId)) {
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
    if (!instanceIds.has(record.instanceId) || !appraisalEventIds.has(record.eventId)) {
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
    if (!instanceIds.has(record.actorId) || !narrativeEventIds.has(record.eventId)) {
      throw new ScenarioValidationError(
        `snapshot.narrativeRecords[${index}]`,
        'narrative record must reference a snapshot agent and authored event',
      );
    }
  });
  const reputationGroupIds = new Set(snapshot.scenario.reputationGroups.map(group => group.id));
  snapshot.reputations.forEach((reputation, index) => {
    if (
      !instanceIds.has(reputation.subjectId) ||
      reputation.sourceIds.some(sourceId => !instanceIds.has(sourceId)) ||
      (reputation.audienceType === 'agent' && !instanceIds.has(reputation.audienceId)) ||
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
    if (!instanceIds.has(item.ownerId) || item.knownByIds.some(id => !instanceIds.has(id))) {
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
      goal.activationSecond >= aspiration.atSecond &&
      goal.commitment === aspiration.commitment &&
      goal.deadlineSecond === aspiration.deadlineSecond &&
      JSON.stringify(goal.claimExpressions) === JSON.stringify(aspiration.claimExpressions) &&
      JSON.stringify(goal.desired) === JSON.stringify(aspiration.desired) &&
      JSON.stringify(goal.failureTurns) === JSON.stringify(aspiration.failureTurns) &&
      goal.label === aspiration.label &&
      JSON.stringify(goal.successTurns) === JSON.stringify(aspiration.successTurns) &&
      goal.urgencyHorizonSeconds === aspiration.urgencyHorizonSeconds;
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
    if (resolved !== (goal.resolvedSecond !== null)) {
      throw new ScenarioValidationError(
        `snapshot.agendaGoals[${index}].resolvedSecond`,
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
    if (goal === undefined || goal.actorId !== plan.actorId || !instanceIds.has(plan.actorId)) {
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
    if (!instanceIds.has(decision.actorId)) {
      throw new ScenarioValidationError(
        `snapshot.agendaDecisions[${index}].actorId`,
        `unknown agent "${decision.actorId}"`,
      );
    }
  });
}

export const SNAPSHOT_REFERENCE_VALIDATORS: readonly SnapshotReferenceValidator[] = [
  validateLockAndAgents,
  validateCollections,
];

/** Run every snapshot reference validator in table order against the prepared base state. */
export function validateSnapshotReferences(context: SnapshotReferenceContext): void {
  for (const validator of SNAPSHOT_REFERENCE_VALIDATORS) validator(context);
}
