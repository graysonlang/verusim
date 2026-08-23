import type { ScenarioFile, SimulationSnapshotFile, SimulationState } from '../model/types.js';

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function profileAddress(state: SimulationState, agentId: string) {
  const placement = state.scenario.characters.find(candidate => candidate.instanceId === agentId);
  if (placement === undefined) throw new Error(`Missing scenario placement for agent "${agentId}"`);
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
    agents: state.agents.map(agent => ({
      cascade: agent.cascade,
      cascadeDwellUntilMinute: agent.cascadeDwellUntilMinute,
      cascadeLoad: agent.cascadeLoad,
      cascadeTargetId: agent.cascadeTargetId,
      currentOutlet: agent.currentOutlet,
      currentActivity: agent.currentActivity,
      currentLocationId: agent.currentLocationId,
      destination: agent.destination,
      id: agent.id,
      memories: agent.memories,
      narrative: agent.narrative,
      outletHistory: agent.outletHistory,
      position: agent.position,
      profile: profileAddress(state, agent.id),
      resources: agent.resources,
      schedule: agent.schedule,
      values: agent.values,
      walkingMetersPerMinute: agent.walkingMetersPerMinute,
    })),
    decisions: state.decisions,
    disclosureDecisions: state.disclosureDecisions,
    disclosureItems: state.disclosureItems,
    dyads: state.dyads,
    environment: state.scenario.environment,
    intentions: state.intentions,
    minute: state.minute,
    narrativeRecords: state.narrativeRecords,
    observations: state.observations,
    plans: state.plans,
    relationshipDecisions: state.relationshipDecisions,
    reputations: state.reputations,
    resourceLock: state.resourceLock,
    resolvedDisclosureOpportunityIds: state.resolvedDisclosureOpportunityIds,
    resolvedObservationEventIds: state.resolvedObservationEventIds,
    resolvedOpportunityIds: state.resolvedOpportunityIds,
    resolvedAppraisalEventIds: state.resolvedAppraisalEventIds,
    resolvedAspirationOpportunityIds: state.resolvedAspirationOpportunityIds,
    resolvedNarrativeEventIds: state.resolvedNarrativeEventIds,
    resolvedRelationshipEventIds: state.resolvedRelationshipEventIds,
    resolvedRelationshipRequestIds: state.resolvedRelationshipRequestIds,
    scenario: state.scenario,
    schemaVersion: 9,
    tick: state.tick,
    trace: state.trace,
    type: 'verusim-snapshot',
    worldFacts: state.worldFacts,
    worldRevision: state.worldRevision,
  });
}
