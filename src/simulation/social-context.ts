import {
  VALUE_IDS,
  type IncidentContext,
  type IncidentContractTerm,
  type IncidentRootImpact,
  type NormAddress,
  type NormPerspective,
  type CharacterInstance,
  type SimulationState,
  type SocialContractPlacement,
  type ValueMap,
} from '../model/types.js';
import { effectiveNormInternalization } from './history.js';

function addressKey(address: NormAddress): string {
  return `${address.packageId}:${address.kind}:${address.resourceId}`;
}

function perspectiveFor(
  state: SimulationState,
  observerId: string,
  norm: NormAddress,
): NormPerspective | null {
  return (
    state.scenario.characters
      .find(placement => placement.instanceId === observerId)
      ?.normPerspectives.find(perspective => addressKey(perspective.norm) === addressKey(norm)) ??
    null
  );
}

function placementIsActive(
  placement: SocialContractPlacement,
  context: IncidentContext,
  eventId: string,
): boolean {
  if (placement.scope.kind === 'event') return placement.scope.eventId === eventId;
  if (placement.scope.kind === 'group') return context.groupIds.includes(placement.scope.groupId);
  if (placement.scope.kind === 'institution') {
    return context.institutionIds.includes(placement.scope.institutionId);
  }
  return placement.scope.locationId === context.locationId;
}

export function activeSocialInterpretationTerms(
  state: SimulationState,
  input: {
    context: IncidentContext;
    eventId: string;
    magnitude: number;
    observer: CharacterInstance;
    rootImpact: IncidentRootImpact;
  },
): IncidentContractTerm[] {
  const terms: IncidentContractTerm[] = [];
  for (const placement of state.scenario.socialContractPlacements) {
    if (!placementIsActive(placement, input.context, input.eventId)) continue;
    const contractKey = `${placement.contract.packageId}:${placement.contract.kind}:${placement.contract.resourceId}`;
    const contractResource = state.socialContracts.find(
      resource =>
        `${resource.address.packageId}:${resource.address.kind}:${resource.address.resourceId}` ===
        contractKey,
    );
    if (contractResource === undefined) continue;
    for (const normAddress of contractResource.contract.norms) {
      const normKey = addressKey(normAddress);
      const normResource = state.norms.find(resource => addressKey(resource.address) === normKey);
      const interpretation = normResource?.norm.interpretations.find(
        candidate => candidate.rootImpact === input.rootImpact,
      );
      if (interpretation === undefined) continue;
      const perspective = perspectiveFor(state, input.observer.id, normAddress);
      const internalization = effectiveNormInternalization(input.observer, normAddress);
      const conventionalTurns = Object.fromEntries(
        VALUE_IDS.flatMap(valueId => {
          const turn = (interpretation.turns[valueId] ?? 0) * internalization * input.magnitude;
          return turn === 0 ? [] : [[valueId, turn]];
        }),
      ) as Partial<ValueMap<number>>;
      terms.push({
        affiliated: perspective?.affiliated ?? false,
        contractId: contractKey,
        conventionalTurns,
        enforcementPressure:
          placement.enforcementPresence *
          contractResource.contract.enforcementSeverity *
          input.magnitude,
        identityStake: interpretation.identityStake * internalization,
        internalization,
        legibility: perspective?.legibility ?? 0,
        normId: normKey,
      });
    }
  }
  return terms;
}
