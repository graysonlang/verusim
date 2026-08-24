import type { PreparedScenario, SimulationState } from '../model/types.js';
import { createSimulation } from '../scenario/load.js';
import { createResourceCatalog, prepareScenario } from '../scenario/prepare.js';
import { contentDigest } from '../scenario/digest.js';
import type { AuthoringGraph } from './graph.js';
import { documentById } from './graph.js';

// A revision is the only path from authored drafts to a runnable simulation.
// It feeds every resource draft through the ordinary catalog and the scenario
// draft through the ordinary preparation boundary, so the authoring graph
// cannot bypass migration, validation, duplicate detection, reference
// resolution, or dependency closure. The prepared value is deep-frozen and
// built from cloned drafts, so later transactions on the graph cannot reach a
// running simulation or its reset baseline; a new revision is the only way to
// change either.

export interface AuthoringRevision {
  digest: string;
  prepared: PreparedScenario;
  scenarioDocumentId: string;
}

export interface RevisionSimulation {
  baseline: SimulationState;
  state: SimulationState;
}

export function prepareRevision(
  graph: AuthoringGraph,
  scenarioDocumentId: string,
): AuthoringRevision {
  const scenario = documentById(graph, scenarioDocumentId);
  if (scenario.kind !== 'scenario') {
    throw new Error(`Document "${scenarioDocumentId}" is not a scenario`);
  }
  const catalog = createResourceCatalog(
    graph.documents
      .filter(document => document.kind !== 'scenario')
      .map(document => ({ source: document.provenance.source, value: document.draft })),
  );
  const prepared = prepareScenario({ catalog, scenario: scenario.draft });
  return {
    digest: contentDigest({
      resources: prepared.resourceLock.digest,
      scenario: prepared.scenario,
    }),
    prepared,
    scenarioDocumentId,
  };
}

/** Start a simulation and its reset baseline from one prepared revision. */
export function startRevision(revision: AuthoringRevision): RevisionSimulation {
  return {
    baseline: createSimulation(revision.prepared),
    state: createSimulation(revision.prepared),
  };
}
