import type { ScenarioContent } from '../model/types.js';
import { ScenarioValidationError } from '../model/validation.js';
import { resourceAddressKey } from './parse.js';

export function validateReferences(content: ScenarioContent): void {
  const characters = new Map(
    content.characterLibrary.characters.map(character => [character.profileId, character]),
  );
  const environment = content.environmentLibrary.environments.find(
    candidate => candidate.layoutId === content.scenario.environment.resourceId,
  );
  if (environment === undefined) {
    throw new ScenarioValidationError(
      'scenario.environment',
      `unknown environment layout "${content.scenario.environment.resourceId}"`,
    );
  }
  const locationIds = new Set(environment.locations.map(location => location.id));
  const layerIds = new Set(environment.layers.map(layer => layer.id));
  const instanceIds = new Set(content.scenario.characters.map(placement => placement.instanceId));
  const profileByInstance = new Map(
    content.scenario.characters.map(placement => [
      placement.instanceId,
      characters.get(placement.profile.resourceId),
    ]),
  );
  const claimIdsFor = (instanceId: string) =>
    new Set(profileByInstance.get(instanceId)?.narrativeClaims.map(claim => claim.id) ?? []);
  const normKeys = new Set(content.norms.map(resource => resourceAddressKey(resource.address)));
  for (const norm of content.scenario.legacyLocalNorms) {
    const key = resourceAddressKey(norm.address);
    if (normKeys.has(key)) {
      throw new ScenarioValidationError(
        'scenario.legacyLocalNorms',
        `legacy local norm duplicates resolved resource "${key}"`,
      );
    }
    normKeys.add(key);
  }
  const socialContracts = new Map(
    content.socialContracts.map(resource => [resourceAddressKey(resource.address), resource]),
  );
  content.socialContracts.forEach((resource, contractIndex) => {
    resource.contract.norms.forEach((norm, normIndex) => {
      const key = resourceAddressKey(norm);
      if (!normKeys.has(key)) {
        throw new ScenarioValidationError(
          `socialContracts[${contractIndex}].contract.norms[${normIndex}]`,
          `unknown norm resource "${key}"`,
        );
      }
    });
  });
  content.scenario.socialContractPlacements.forEach((placement, index) => {
    const key = resourceAddressKey(placement.contract);
    if (!socialContracts.has(key)) {
      throw new ScenarioValidationError(
        `scenario.socialContractPlacements[${index}].contract`,
        `unknown social contract resource "${key}"`,
      );
    }
    if (placement.scope.kind === 'location' && !locationIds.has(placement.scope.locationId)) {
      throw new ScenarioValidationError(
        `scenario.socialContractPlacements[${index}].scope.locationId`,
        `unknown location "${placement.scope.locationId}"`,
      );
    }
  });
  content.scenario.characters.forEach((placement, index) => {
    if (!characters.has(placement.profile.resourceId)) {
      throw new ScenarioValidationError(
        `scenario.characters[${index}].profile`,
        `unknown character profile "${placement.profile.resourceId}"`,
      );
    }
    if (!layerIds.has(placement.position.layerId)) {
      throw new ScenarioValidationError(
        `scenario.characters[${index}].position.layerId`,
        `unknown layer "${placement.position.layerId}"`,
      );
    }
    const profileClaimIds = new Set(
      characters.get(placement.profile.resourceId)?.narrativeClaims.map(claim => claim.id) ?? [],
    );
    placement.narrativeOverrides.forEach((override, overrideIndex) => {
      if (!profileClaimIds.has(override.claimId)) {
        throw new ScenarioValidationError(
          `scenario.characters[${index}].narrativeOverrides[${overrideIndex}].claimId`,
          `unknown narrative claim "${override.claimId}"`,
        );
      }
    });
    placement.schedule.forEach((block, blockIndex) => {
      if (!locationIds.has(block.locationId)) {
        throw new ScenarioValidationError(
          `scenario.characters[${index}].schedule[${blockIndex}].locationId`,
          `unknown location "${block.locationId}"`,
        );
      }
    });
    placement.normPerspectives.forEach((perspective, perspectiveIndex) => {
      const key = resourceAddressKey(perspective.norm);
      if (!normKeys.has(key)) {
        throw new ScenarioValidationError(
          `scenario.characters[${index}].normPerspectives[${perspectiveIndex}].norm`,
          `unknown norm resource "${key}"`,
        );
      }
    });
  });
  content.scenario.dyads.forEach((dyad, index) => {
    if (!instanceIds.has(dyad.observerId)) {
      throw new ScenarioValidationError(
        `scenario.dyads[${index}].observerId`,
        `unknown agent "${dyad.observerId}"`,
      );
    }
    if (!instanceIds.has(dyad.subjectId)) {
      throw new ScenarioValidationError(
        `scenario.dyads[${index}].subjectId`,
        `unknown agent "${dyad.subjectId}"`,
      );
    }
    dyad.validatorClaimIds.forEach((claimId, claimIndex) => {
      if (!claimIdsFor(dyad.observerId).has(claimId)) {
        throw new ScenarioValidationError(
          `scenario.dyads[${index}].validatorClaimIds[${claimIndex}]`,
          `unknown narrative claim "${claimId}" for observer "${dyad.observerId}"`,
        );
      }
    });
  });
  const disclosureItemIds = new Set(content.scenario.disclosureItems.map(item => item.id));
  content.scenario.disclosureItems.forEach((item, index) => {
    const path = `scenario.disclosureItems[${index}]`;
    if (!instanceIds.has(item.ownerId)) {
      throw new ScenarioValidationError(`${path}.ownerId`, `unknown agent "${item.ownerId}"`);
    }
    item.knownByIds.forEach((agentId, agentIndex) => {
      if (!instanceIds.has(agentId)) {
        throw new ScenarioValidationError(
          `${path}.knownByIds[${agentIndex}]`,
          `unknown agent "${agentId}"`,
        );
      }
    });
  });
  content.scenario.disclosureOpportunities.forEach((opportunity, index) => {
    const path = `scenario.disclosureOpportunities[${index}]`;
    if (!instanceIds.has(opportunity.ownerId)) {
      throw new ScenarioValidationError(
        `${path}.ownerId`,
        `unknown agent "${opportunity.ownerId}"`,
      );
    }
    if (!disclosureItemIds.has(opportunity.itemId)) {
      throw new ScenarioValidationError(
        `${path}.itemId`,
        `unknown disclosure item "${opportunity.itemId}"`,
      );
    }
    const item = content.scenario.disclosureItems.find(
      candidate => candidate.id === opportunity.itemId,
    );
    if (item?.ownerId !== opportunity.ownerId) {
      throw new ScenarioValidationError(
        `${path}.itemId`,
        'disclosure item must belong to the opportunity owner',
      );
    }
    opportunity.audienceIds.forEach((agentId, agentIndex) => {
      if (!instanceIds.has(agentId)) {
        throw new ScenarioValidationError(
          `${path}.audienceIds[${agentIndex}]`,
          `unknown agent "${agentId}"`,
        );
      }
    });
  });
  content.scenario.observationEvents.forEach((event, index) => {
    const path = `scenario.observationEvents[${index}]`;
    if (!instanceIds.has(event.subjectId)) {
      throw new ScenarioValidationError(`${path}.subjectId`, `unknown agent "${event.subjectId}"`);
    }
    if (event.eventType === 'norm' && !normKeys.has(resourceAddressKey(event.norm))) {
      throw new ScenarioValidationError(
        `${path}.norm`,
        `unknown norm resource "${resourceAddressKey(event.norm)}"`,
      );
    }
    event.observerIds.forEach((observerId, observerIndex) => {
      if (!instanceIds.has(observerId)) {
        throw new ScenarioValidationError(
          `${path}.observerIds[${observerIndex}]`,
          `unknown agent "${observerId}"`,
        );
      }
      if (observerId === event.subjectId) {
        throw new ScenarioValidationError(
          `${path}.observerIds[${observerIndex}]`,
          'an agent cannot observe its own social signal',
        );
      }
      if (
        event.eventType === 'norm' &&
        !content.scenario.characters
          .find(placement => placement.instanceId === observerId)
          ?.normPerspectives.some(
            perspective => resourceAddressKey(perspective.norm) === resourceAddressKey(event.norm),
          )
      ) {
        throw new ScenarioValidationError(
          `${path}.observerIds[${observerIndex}]`,
          `agent "${observerId}" lacks a perspective on norm "${resourceAddressKey(event.norm)}"`,
        );
      }
    });
  });
  content.scenario.relationshipEvents.forEach((event, index) => {
    const path = `scenario.relationshipEvents[${index}]`;
    if (!instanceIds.has(event.observerId)) {
      throw new ScenarioValidationError(
        `${path}.observerId`,
        `unknown agent "${event.observerId}"`,
      );
    }
    if (!instanceIds.has(event.subjectId)) {
      throw new ScenarioValidationError(`${path}.subjectId`, `unknown agent "${event.subjectId}"`);
    }
    if (event.observerId === event.subjectId) {
      throw new ScenarioValidationError(`${path}.subjectId`, 'a dyad must contain two agents');
    }
  });
  content.scenario.relationshipRequests.forEach((request, index) => {
    const path = `scenario.relationshipRequests[${index}]`;
    if (!instanceIds.has(request.requesterId)) {
      throw new ScenarioValidationError(
        `${path}.requesterId`,
        `unknown agent "${request.requesterId}"`,
      );
    }
    if (!instanceIds.has(request.responderId)) {
      throw new ScenarioValidationError(
        `${path}.responderId`,
        `unknown agent "${request.responderId}"`,
      );
    }
    if (request.requesterId === request.responderId) {
      throw new ScenarioValidationError(`${path}.responderId`, 'a request requires two agents');
    }
  });
  content.scenario.appraisalEvents.forEach((event, index) => {
    const path = `scenario.appraisalEvents[${index}]`;
    if (!instanceIds.has(event.agentId)) {
      throw new ScenarioValidationError(`${path}.agentId`, `unknown agent "${event.agentId}"`);
    }
    if (event.socialTargetId !== null && !instanceIds.has(event.socialTargetId)) {
      throw new ScenarioValidationError(
        `${path}.socialTargetId`,
        `unknown agent "${event.socialTargetId}"`,
      );
    }
    if (event.socialTargetId === event.agentId) {
      throw new ScenarioValidationError(
        `${path}.socialTargetId`,
        'an agent cannot be its own social threat target',
      );
    }
  });
  const factIds = new Set(content.scenario.worldFacts.map(fact => fact.id));
  content.scenario.agendaGoals.forEach((goal, index) => {
    const path = `scenario.agendaGoals[${index}]`;
    if (!instanceIds.has(goal.actorId)) {
      throw new ScenarioValidationError(`${path}.actorId`, `unknown agent "${goal.actorId}"`);
    }
    goal.claimExpressions.forEach((expression, expressionIndex) => {
      if (!claimIdsFor(goal.actorId).has(expression.claimId)) {
        throw new ScenarioValidationError(
          `${path}.claimExpressions[${expressionIndex}].claimId`,
          `unknown narrative claim "${expression.claimId}" for actor "${goal.actorId}"`,
        );
      }
    });
    goal.desired.forEach((condition, conditionIndex) => {
      if (!factIds.has(condition.factId)) {
        throw new ScenarioValidationError(
          `${path}.desired[${conditionIndex}].factId`,
          `unknown world fact "${condition.factId}"`,
        );
      }
    });
  });
  content.scenario.taskOperators.forEach((task, index) => {
    const path = `scenario.taskOperators[${index}]`;
    if (!locationIds.has(task.locationId)) {
      throw new ScenarioValidationError(
        `${path}.locationId`,
        `unknown location "${task.locationId}"`,
      );
    }
    task.actorIds.forEach((actorId, actorIndex) => {
      if (!instanceIds.has(actorId)) {
        throw new ScenarioValidationError(
          `${path}.actorIds[${actorIndex}]`,
          `unknown agent "${actorId}"`,
        );
      }
      task.claimExpressions.forEach((expression, expressionIndex) => {
        if (!claimIdsFor(actorId).has(expression.claimId)) {
          throw new ScenarioValidationError(
            `${path}.claimExpressions[${expressionIndex}].claimId`,
            `unknown narrative claim "${expression.claimId}" for actor "${actorId}"`,
          );
        }
      });
    });
    task.preconditions.forEach((condition, conditionIndex) => {
      if (!factIds.has(condition.factId)) {
        throw new ScenarioValidationError(
          `${path}.preconditions[${conditionIndex}].factId`,
          `unknown world fact "${condition.factId}"`,
        );
      }
    });
    task.effects.forEach((effect, effectIndex) => {
      if (!factIds.has(effect.factId)) {
        throw new ScenarioValidationError(
          `${path}.effects[${effectIndex}].factId`,
          `unknown world fact "${effect.factId}"`,
        );
      }
    });
  });
  content.scenario.behaviorOpportunities.forEach((opportunity, index) => {
    const path = `scenario.behaviorOpportunities[${index}]`;
    if (!instanceIds.has(opportunity.actorId)) {
      throw new ScenarioValidationError(
        `${path}.actorId`,
        `unknown agent "${opportunity.actorId}"`,
      );
    }
    if (opportunity.targetId !== null && !instanceIds.has(opportunity.targetId)) {
      throw new ScenarioValidationError(
        `${path}.targetId`,
        `unknown agent "${opportunity.targetId}"`,
      );
    }
    opportunity.context.witnessIds.forEach((witnessId, witnessIndex) => {
      if (!instanceIds.has(witnessId)) {
        throw new ScenarioValidationError(
          `${path}.context.witnessIds[${witnessIndex}]`,
          `unknown agent "${witnessId}"`,
        );
      }
    });
    opportunity.candidates.forEach((candidate, candidateIndex) => {
      candidate.claimExpressions.forEach((expression, expressionIndex) => {
        if (!claimIdsFor(opportunity.actorId).has(expression.claimId)) {
          throw new ScenarioValidationError(
            `${path}.candidates[${candidateIndex}].claimExpressions[${expressionIndex}].claimId`,
            `unknown narrative claim "${expression.claimId}" for actor "${opportunity.actorId}"`,
          );
        }
      });
      candidate.impacts.forEach((impact, impactIndex) => {
        if (!instanceIds.has(impact.subjectId)) {
          throw new ScenarioValidationError(
            `${path}.candidates[${candidateIndex}].impacts[${impactIndex}].subjectId`,
            `unknown agent "${impact.subjectId}"`,
          );
        }
      });
    });
  });
  const groupIds = new Set(content.scenario.reputationGroups.map(group => group.id));
  content.scenario.reputationGroups.forEach((group, index) => {
    group.memberIds.forEach((memberId, memberIndex) => {
      if (!instanceIds.has(memberId)) {
        throw new ScenarioValidationError(
          `scenario.reputationGroups[${index}].memberIds[${memberIndex}]`,
          `unknown agent "${memberId}"`,
        );
      }
    });
  });
  content.scenario.aspirationOpportunities.forEach((opportunity, index) => {
    const path = `scenario.aspirationOpportunities[${index}]`;
    if (!instanceIds.has(opportunity.actorId)) {
      throw new ScenarioValidationError(
        `${path}.actorId`,
        `unknown agent "${opportunity.actorId}"`,
      );
    }
    if (!claimIdsFor(opportunity.actorId).has(opportunity.claimId)) {
      throw new ScenarioValidationError(
        `${path}.claimId`,
        `unknown narrative claim "${opportunity.claimId}"`,
      );
    }
    opportunity.desired.forEach((condition, conditionIndex) => {
      if (!factIds.has(condition.factId)) {
        throw new ScenarioValidationError(
          `${path}.desired[${conditionIndex}].factId`,
          `unknown world fact "${condition.factId}"`,
        );
      }
    });
  });
  const disclosureItemIdsForNarrative = new Set(
    content.scenario.disclosureItems.map(item => item.id),
  );
  content.scenario.narrativeEvents.forEach((event, index) => {
    const path = `scenario.narrativeEvents[${index}]`;
    if (event.eventType === 'attribution') {
      for (const [field, agentId] of [
        ['sourceId', event.sourceId],
        ['subjectId', event.subjectId],
      ] as const) {
        if (!instanceIds.has(agentId)) {
          throw new ScenarioValidationError(`${path}.${field}`, `unknown agent "${agentId}"`);
        }
      }
      if (
        (event.audienceType === 'agent' && !instanceIds.has(event.audienceId)) ||
        (event.audienceType === 'group' && !groupIds.has(event.audienceId))
      ) {
        throw new ScenarioValidationError(
          `${path}.audienceId`,
          `unknown ${event.audienceType} audience "${event.audienceId}"`,
        );
      }
      if (!claimIdsFor(event.subjectId).has(event.selfClaimId)) {
        throw new ScenarioValidationError(`${path}.selfClaimId`, 'unknown subject narrative claim');
      }
    } else {
      if (!instanceIds.has(event.actorId)) {
        throw new ScenarioValidationError(`${path}.actorId`, `unknown agent "${event.actorId}"`);
      }
      if (!claimIdsFor(event.actorId).has(event.claimId)) {
        throw new ScenarioValidationError(`${path}.claimId`, 'unknown actor narrative claim');
      }
      if (event.eventType === 'self-deprecation-agreement') {
        if (!instanceIds.has(event.responderId)) {
          throw new ScenarioValidationError(
            `${path}.responderId`,
            `unknown agent "${event.responderId}"`,
          );
        }
        if (
          event.disclosureItemId !== null &&
          !disclosureItemIdsForNarrative.has(event.disclosureItemId)
        ) {
          throw new ScenarioValidationError(
            `${path}.disclosureItemId`,
            `unknown disclosure item "${event.disclosureItemId}"`,
          );
        }
      }
    }
  });
}
