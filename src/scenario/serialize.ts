import type { ScenarioFile, SimulationSnapshotFile, SimulationState } from '../model/types.js';

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
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
      outletHistory: agent.outletHistory,
      position: agent.position,
      profileId: agent.profile.id,
      resources: agent.resources,
      schedule: agent.schedule,
      values: agent.values,
      walkingMetersPerMinute: agent.walkingMetersPerMinute,
    })),
    decisions: state.decisions,
    disclosureDecisions: state.disclosureDecisions,
    disclosureItems: state.disclosureItems,
    dyads: state.dyads,
    environmentId: state.environment.id,
    intentions: state.intentions,
    minute: state.minute,
    observations: state.observations,
    plans: state.plans,
    relationshipDecisions: state.relationshipDecisions,
    resolvedDisclosureOpportunityIds: state.resolvedDisclosureOpportunityIds,
    resolvedObservationEventIds: state.resolvedObservationEventIds,
    resolvedOpportunityIds: state.resolvedOpportunityIds,
    resolvedAppraisalEventIds: state.resolvedAppraisalEventIds,
    resolvedRelationshipEventIds: state.resolvedRelationshipEventIds,
    resolvedRelationshipRequestIds: state.resolvedRelationshipRequestIds,
    scenario: state.scenario,
    schemaVersion: 7,
    tick: state.tick,
    trace: state.trace,
    type: 'verusim-snapshot',
    worldFacts: state.worldFacts,
    worldRevision: state.worldRevision,
  });
}
