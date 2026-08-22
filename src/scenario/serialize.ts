import type { ScenarioFile, SimulationSnapshotFile, SimulationState } from '../model/types.js';

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

export function serializeScenario(state: SimulationState): ScenarioFile {
  return clone(state.scenario);
}

export function serializeSnapshot(state: SimulationState): SimulationSnapshotFile {
  return clone({
    agendaDecisions: state.agendaDecisions,
    agendaGoals: state.agendaGoals,
    agents: state.agents.map(agent => ({
      cascade: agent.cascade,
      currentActivity: agent.currentActivity,
      currentLocationId: agent.currentLocationId,
      destination: agent.destination,
      id: agent.id,
      memories: agent.memories,
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
    plans: state.plans,
    resolvedDisclosureOpportunityIds: state.resolvedDisclosureOpportunityIds,
    resolvedOpportunityIds: state.resolvedOpportunityIds,
    scenario: state.scenario,
    schemaVersion: 2,
    tick: state.tick,
    trace: state.trace,
    type: 'verusim-snapshot',
    worldFacts: state.worldFacts,
    worldRevision: state.worldRevision,
  });
}
