import type { ScenarioFile, SimulationSnapshotFile, SimulationState } from '../model/types.js';

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function profileAddress(state: SimulationState, instanceId: string) {
  const placement = state.scenario.characters.find(
    candidate => candidate.instanceId === instanceId,
  );
  if (placement === undefined)
    throw new Error(`Missing scenario placement for agent "${instanceId}"`);
  return placement.profile;
}

export function serializeScenario(state: SimulationState): ScenarioFile {
  return clone(state.scenario);
}

export function serializeSnapshot(state: SimulationState): SimulationSnapshotFile {
  return clone({
    appraisalRecords: state.appraisalRecords,
    agendaDecisions: state.agendaDecisions,
    agendaGoals: state.agendaGoals,
    characters: state.characters.map(agent => ({
      arrivedSecond: agent.arrivedSecond,
      cascade: agent.cascade,
      cascadeDwellUntilSecond: agent.cascadeDwellUntilSecond,
      cascadeLoad: agent.cascadeLoad,
      cascadeTargetId: agent.cascadeTargetId,
      currentOutlet: agent.currentOutlet,
      currentActivity: agent.currentActivity,
      currentLocationId: agent.currentLocationId,
      destination: agent.destination,
      directedLocationId: agent.directedLocationId,
      history: agent.history,
      id: agent.id,
      memories: agent.memories,
      narrative: agent.narrative,
      outletHistory: agent.outletHistory,
      positionalRespect: agent.positionalRespect,
      position: agent.position,
      profile: profileAddress(state, agent.id),
      resources: agent.resources,
      route: agent.route,
      schedule: agent.schedule,
      somatic: agent.somatic,
      tier: agent.tier,
      values: agent.values,
      walkingMetersPerMinute: agent.walkingMetersPerMinute,
    })),
    decisions: state.decisions,
    disclosureDecisions: state.disclosureDecisions,
    disclosureItems: state.disclosureItems,
    displayExposures: state.displayExposures,
    displayRecords: state.displayRecords,
    dyads: state.dyads,
    environment: state.scenario.environment,
    incidentRecords: state.incidentRecords,
    intentions: state.intentions,
    second: state.second,
    narrativeRecords: state.narrativeRecords,
    observations: state.observations,
    plans: state.plans,
    relationshipDecisions: state.relationshipDecisions,
    reputations: state.reputations,
    resourceLock: state.resourceLock,
    resolvedDisclosureOpportunityIds: state.resolvedDisclosureOpportunityIds,
    resolvedDisplayEventIds: state.resolvedDisplayEventIds,
    resolvedIncidentEventIds: state.resolvedIncidentEventIds,
    resolvedObservationEventIds: state.resolvedObservationEventIds,
    resolvedOpportunityIds: state.resolvedOpportunityIds,
    resolvedAppraisalEventIds: state.resolvedAppraisalEventIds,
    resolvedAspirationOpportunityIds: state.resolvedAspirationOpportunityIds,
    resolvedNarrativeEventIds: state.resolvedNarrativeEventIds,
    resolvedRelationshipEventIds: state.resolvedRelationshipEventIds,
    resolvedRelationshipRequestIds: state.resolvedRelationshipRequestIds,
    resolvedSomaticEventIds: state.resolvedSomaticEventIds,
    scenario: state.scenario,
    schemaVersion: 21,
    somaticRecords: state.somaticRecords,
    tick: state.tick,
    trace: state.trace,
    type: 'verusim-snapshot',
    worldFacts: state.worldFacts,
    worldRevision: state.worldRevision,
  });
}
