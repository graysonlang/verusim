import { clamp } from '../model/retention.js';
import {
  VALUE_IDS,
  type CascadePosition,
  type CharacterDefinition,
  type DisclosureEnvelope,
  type EmpathyEnvelope,
  type HistoryDerivedState,
  type IdentityMarker,
  type NormAddress,
  type OutletPreference,
  type RuntimeMemory,
  type SatisfierPreference,
  type SimulationAgent,
  type ValueId,
  type ValueMap,
  type ValueState,
} from '../model/types.js';
import { applyValueTurns, reactiveValueTurn } from './value-turn.js';

const FORMATIVE_WEIGHT_GAIN = 0.2;

function emptyFormativeValues(): ValueMap<ValueState> {
  return Object.fromEntries(
    VALUE_IDS.map(valueId => [valueId, { charge: 0, deficitIntegral: 0, variance: 0 }]),
  ) as ValueMap<ValueState>;
}

export function initializeHistoryDerivedState(profile: CharacterDefinition): {
  history: HistoryDerivedState;
  memories: RuntimeMemory[];
} {
  let formativeValues = emptyFormativeValues();
  let overrides: HistoryDerivedState['overrides'] = {};
  const formativeRecords: HistoryDerivedState['formativeRecords'] = [];
  const memories: RuntimeMemory[] = [];

  profile.formativeEvents.forEach((event, eventIndex) => {
    const eventId = `formative:${profile.profileId}:${eventIndex}`;
    const source = `characters.${profile.profileId}.formativeEvents[${eventIndex}]`;
    const memoryId = `${eventId}:memory`;
    const previousCharge = formativeValues[event.value].charge;
    const appliedTurn = reactiveValueTurn(profile.constitution.reactivity, event.turn);
    formativeValues = applyValueTurns(formativeValues, { [event.value]: appliedTurn });
    const resultingCharge = formativeValues[event.value].charge;
    const retainedTurn = Math.abs(resultingCharge - previousCharge);
    const previousWeight = effectiveProfileValueWeight(
      profile,
      overrides.valueWeights,
      event.value,
    );
    const salience = retainedTurn * (1 + (1 - event.copingPotential) * 0.5);
    const resultingWeight = clamp(previousWeight + salience * FORMATIVE_WEIGHT_GAIN, 0, 2);
    overrides = {
      ...overrides,
      valueWeights: { ...overrides.valueWeights, [event.value]: resultingWeight },
    };
    formativeRecords.push({
      age: event.age,
      appliedTurn,
      attribution: event.attribution,
      authoredTurn: event.turn,
      copingPotential: event.copingPotential,
      eventId,
      eventIndex,
      memoryId,
      previousCharge,
      previousWeight,
      profileId: profile.profileId,
      resultingCharge,
      resultingWeight,
      source,
      valueId: event.value,
    });
    memories.push({
      emotionalTurn: appliedTurn,
      id: memoryId,
      minute: -1,
      provenance: {
        age: event.age,
        attribution: event.attribution,
        copingPotential: event.copingPotential,
        eventId,
        eventIndex,
        profileId: profile.profileId,
        source,
        turn: event.turn,
        valueId: event.value,
      },
      summary: event.summary,
      type: 'formative',
    });
  });

  return {
    history: {
      formativeRecords,
      overrides,
      plasticity: { accumulators: [], records: [] },
    },
    memories,
  };
}

function effectiveProfileValueWeight(
  profile: CharacterDefinition,
  overrides: Partial<ValueMap<number>> | undefined,
  valueId: ValueId,
): number {
  return overrides?.[valueId] ?? profile.values[valueId].weight;
}

export function effectiveValueWeight(agent: SimulationAgent, valueId: ValueId): number {
  return effectiveProfileValueWeight(agent.profile, agent.history.overrides.valueWeights, valueId);
}

export function effectiveCascadePrior(
  agent: SimulationAgent,
  position: Exclude<CascadePosition, 'none'>,
): number {
  return agent.history.overrides.cascadePriors?.[position] ?? agent.profile.cascadePriors[position];
}

export function effectiveContractAdherence(agent: SimulationAgent): number {
  return agent.history.overrides.contractAdherence ?? agent.profile.contractAdherence;
}

export function effectiveDisclosure(agent: SimulationAgent): DisclosureEnvelope {
  return { ...agent.profile.disclosure, ...agent.history.overrides.disclosure };
}

export function effectiveEmpathy(agent: SimulationAgent): EmpathyEnvelope {
  const override = agent.history.overrides.empathy;
  return {
    ...agent.profile.empathy,
    ...override,
    featureWeights: {
      ...agent.profile.empathy.featureWeights,
      ...override?.featureWeights,
    },
  };
}

export function effectiveIdentity(agent: SimulationAgent): IdentityMarker[] {
  return agent.history.overrides.identity ?? agent.profile.identity;
}

export function effectiveNormInternalization(agent: SimulationAgent, norm: NormAddress): number {
  const key = `${norm.packageId}:${norm.kind}:${norm.resourceId}`;
  return agent.history.overrides.normInternalizations?.[key] ?? 0;
}

export function effectiveOutletPreferences(agent: SimulationAgent): OutletPreference[] {
  return agent.history.overrides.outletPreferences ?? agent.profile.outletPreferences;
}

export function effectiveSatisfierPreferences(agent: SimulationAgent): SatisfierPreference[] {
  return agent.history.overrides.satisfierPreferences ?? agent.profile.satisfierPreferences;
}
