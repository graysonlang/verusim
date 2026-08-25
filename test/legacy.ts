// Version-aware downgrades of current authored content, used to build legacy
// fixtures for the migration matrix and for explicit migration probes.
//
// Each step removes exactly what the corresponding migration gate reinstates,
// in reverse gate order, so this file is the explicit statement of the
// migration-order assumptions the parser relies on: a fixture at version N is
// the current shape with every gate above N undone.

type Doc = Record<string, unknown>;

function objects(value: unknown): Doc[] {
  return Array.isArray(value) ? (value as Doc[]) : [];
}

function resourceId(address: unknown): string {
  return (address as { resourceId: string }).resourceId;
}

export const LEGACY_SCENARIO_VERSIONS: readonly number[] = Array.from(
  { length: 17 },
  (_, index) => index + 1,
);

function renameKeysDeepForLegacy(
  value: unknown,
  renames: Readonly<Record<string, string>>,
  placements: readonly Doc[],
): void {
  // Placements legitimately carry `instanceId`; only event and metadata records renamed it.
  if (Array.isArray(value)) {
    for (const item of value) renameKeysDeepForLegacy(item, renames, placements);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  const record = value as Doc;
  if (!placements.includes(record)) {
    for (const [key, replacement] of Object.entries(renames)) {
      if (key in record) {
        record[replacement] = record[key];
        delete record[key];
      }
    }
  }
  for (const child of Object.values(record)) renameKeysDeepForLegacy(child, renames, placements);
}

export function downgradeScenario(value: unknown, schemaVersion: number): Doc {
  const file = structuredClone(value) as Doc;
  const placements = objects(file.characters);
  if (schemaVersion < 18) {
    renameKeysDeepForLegacy(
      file,
      { affectedInstanceId: 'affectedAgentId', instanceId: 'agentId' },
      placements,
    );
  }
  if (schemaVersion < 17) {
    delete file.ambientSomaticSources;
    delete file.somaticEvents;
    for (const placement of placements) delete placement.initialSomaticSources;
    for (const task of objects(file.taskOperators)) delete task.somaticDemand;
    for (const opportunity of objects(file.behaviorOpportunities)) {
      for (const candidate of objects(opportunity.candidates)) {
        delete candidate.selfDirected;
        delete candidate.somaticDemand;
      }
    }
  }
  if (schemaVersion < 16) delete file.displayEvents;
  if (schemaVersion < 15) {
    delete file.incidentEvents;
    for (const norm of objects(file.legacyLocalNorms)) delete norm.interpretations;
    for (const placement of objects(file.socialContractPlacements)) {
      delete placement.enforcementPresence;
    }
    for (const placement of placements) {
      for (const perspective of objects(placement.normPerspectives)) {
        perspective.member = perspective.affiliated === true;
        delete perspective.affiliated;
        delete perspective.internalization;
      }
    }
  }
  if (schemaVersion < 14) {
    for (const placement of placements) delete (placement.position as Doc).layerId;
    delete file.socialContractPlacements;
    file.localNorms = objects(file.legacyLocalNorms).map(norm => {
      const { address, ...rest } = norm;
      return { id: resourceId(address), ...rest };
    });
    delete file.legacyLocalNorms;
    for (const placement of placements) {
      for (const perspective of objects(placement.normPerspectives)) {
        perspective.normId = resourceId(perspective.norm);
        delete perspective.norm;
      }
    }
    for (const event of objects(file.observationEvents)) {
      if (event.eventType === 'norm') {
        event.normId = resourceId(event.norm);
        delete event.norm;
      }
    }
  }
  if (schemaVersion < 12) {
    file.environmentId = resourceId(file.environment);
    delete file.environment;
    for (const placement of placements) {
      placement.characterId = resourceId(placement.profile);
      delete placement.profile;
    }
  }
  if (schemaVersion < 11) {
    delete file.aspirationOpportunities;
    delete file.narrativeEvents;
    delete file.reputationGroups;
    for (const placement of placements) {
      delete placement.agency;
      delete placement.narrativeOverrides;
    }
    for (const dyad of objects(file.dyads)) delete dyad.validatorClaimIds;
    for (const goal of objects(file.agendaGoals)) delete goal.claimExpressions;
    for (const task of objects(file.taskOperators)) delete task.claimExpressions;
    for (const opportunity of objects(file.behaviorOpportunities)) {
      for (const candidate of objects(opportunity.candidates)) delete candidate.claimExpressions;
    }
  }
  if (schemaVersion < 10) {
    delete file.appraisalEvents;
    for (const task of objects(file.taskOperators)) {
      delete task.maskingDemand;
      delete task.resourceDrainsPerHour;
    }
    for (const placement of placements) {
      for (const block of objects(placement.schedule)) {
        delete block.maskingDemand;
        delete block.resourceDrainsPerHour;
      }
    }
  }
  if (schemaVersion < 9) {
    delete file.relationshipEvents;
    delete file.relationshipRequests;
    for (const dyad of objects(file.dyads)) delete dyad.exposureDebt;
  }
  if (schemaVersion < 8) {
    delete file.localNorms;
    for (const placement of placements) delete placement.normPerspectives;
    // Version 7 observation events were all mind-model events.
    file.observationEvents = objects(file.observationEvents)
      .filter(event => event.eventType !== 'norm')
      .map(event => {
        const { eventType, ...rest } = event;
        void eventType;
        return rest;
      });
  }
  if (schemaVersion < 7) {
    for (const dyad of objects(file.dyads)) delete dyad.suspicion;
    delete file.observationEvents;
  }
  if (schemaVersion < 6) delete file.environmentConditions;
  if (schemaVersion < 5) {
    for (const task of objects(file.taskOperators)) delete task.recoveryMode;
    for (const placement of placements) {
      for (const block of objects(placement.schedule)) delete block.recoveryMode;
    }
  }
  if (schemaVersion < 4) {
    delete file.agendaGoals;
    delete file.taskOperators;
    delete file.worldFacts;
  }
  if (schemaVersion < 3) {
    file.socialRelations = objects(file.dyads).map(dyad => {
      const {
        behaviorVariance,
        estimateConfidence,
        estimatedDisclosure,
        estimatedEmpathy,
        integratedHistory,
        mode,
        predictionError,
        stance,
        ...relation
      } = dyad;
      void [
        behaviorVariance,
        estimateConfidence,
        estimatedDisclosure,
        estimatedEmpathy,
        integratedHistory,
        mode,
        predictionError,
        stance,
      ];
      return relation;
    });
    delete file.dyads;
    delete file.disclosureItems;
    delete file.disclosureOpportunities;
  }
  if (schemaVersion < 2) {
    delete file.behaviorOpportunities;
    delete file.socialRelations;
  }
  file.schemaVersion = schemaVersion;
  return file;
}

/** Return a snapshot to the pre-18 vocabulary: `agents`, `agentId`, and `affectedAgentId`. */
export function downgradeSnapshotVocabulary(snapshot: Doc): void {
  // Legacy files carried `agents`; the current alias stays on the fixture so a
  // test can keep mutating the same instance array after downgrading, and the
  // migration's `characters = agents` assignment overwrites it identically.
  if ('characters' in snapshot) snapshot.agents = snapshot.characters;
  for (const instance of objects(snapshot.characters)) delete instance.tier;
  const trace = snapshot.trace as Doc | undefined;
  if (trace !== undefined && trace.schemaVersion === 2) {
    snapshot.trace = {
      entries: objects(trace.entries).map(entry => {
        const { sequence, ...rest } = entry;
        void sequence;
        return rest;
      }),
      schemaVersion: 1,
    };
  }
  const scenario = snapshot.scenario as Doc | undefined;
  const placements = objects(scenario?.characters);
  renameKeysDeepForLegacy(
    snapshot,
    { affectedInstanceId: 'affectedAgentId', instanceId: 'agentId' },
    placements,
  );
}
