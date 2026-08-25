import { downgradeSnapshotVocabulary } from './legacy.js';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import { BUILT_IN_SCENARIOS } from '../app/scenarios.js';
import {
  advanceSimulation,
  applyTransaction,
  canonicalJson,
  contentDigest,
  createAuthoringGraph,
  createResourceCatalog,
  createSimulation,
  createSimulationFromSnapshot,
  documentById,
  parseSnapshot,
  prepareRevision,
  prepareScenario,
  scenarioDocumentId,
  serializeSnapshot,
  startRevision,
  validatePreparedScenario,
} from '../src/index.js';

const SCENARIO_ID = scenarioDocumentId('pottsfield');
const NORM_ID = 'verusim:norm:pottsfield-harvest-observance';

function project() {
  const pottsfield = BUILT_IN_SCENARIOS.find(entry => entry.id === 'pottsfield');
  assert.ok(pottsfield);
  return {
    graph: createAuthoringGraph([
      ...BUILT_IN_RESOURCES,
      { source: 'content/scenarios/pottsfield.json', value: pottsfield.scenario },
    ]),
    scenario: pottsfield.scenario,
  };
}

describe('content digest', () => {
  it('canonicalizes key order and changes with content', () => {
    assert.equal(
      canonicalJson({ b: [1, { d: 1, c: 2 }], a: 'x' }),
      canonicalJson({ a: 'x', b: [1, { c: 2, d: 1 }] }),
    );
    assert.equal(contentDigest({ b: 1, a: 2 }), contentDigest({ a: 2, b: 1 }));
    assert.notEqual(contentDigest({ a: 1 }), contentDigest({ a: 2 }));
    assert.match(contentDigest('stable'), /^fnv1a64:[0-9a-f]{16}$/);
  });
});

describe('authoring revisions', () => {
  it('prepares the separate-document project identically to direct in-memory content', () => {
    const { graph, scenario } = project();
    const direct = prepareScenario({
      catalog: createResourceCatalog(BUILT_IN_RESOURCES),
      scenario,
    });
    const revision = prepareRevision(graph, SCENARIO_ID);
    assert.deepEqual(revision.prepared, direct);
    assert.equal(revision.prepared.resourceLock.digest, direct.resourceLock.digest);
    assert.match(revision.digest, /^fnv1a64:/);
  });

  it('blocks invalid and unknown authored fields at actionable paths and accepts the correction', () => {
    const { graph } = project();
    const draft = structuredClone(documentById(graph, SCENARIO_ID).draft) as Record<
      string,
      unknown
    >;
    draft.tickSeconds = 0;
    const invalid = applyTransaction(graph, {
      edits: [{ documentId: SCENARIO_ID, draft }],
      label: 'break',
    });
    assert.throws(() => prepareRevision(invalid, SCENARIO_ID), /scenario\.tickSeconds/);

    const unknown = structuredClone(documentById(graph, SCENARIO_ID).draft) as Record<
      string,
      unknown
    >;
    unknown.tickSecond = 1;
    const withUnknown = applyTransaction(graph, {
      edits: [{ documentId: SCENARIO_ID, draft: unknown }],
      label: 'typo',
    });
    assert.throws(
      () => prepareRevision(withUnknown, SCENARIO_ID),
      /scenario\.tickSecond: unknown field/,
    );
    assert.ok(
      documentById(withUnknown, SCENARIO_ID).diagnostics.some(
        d => d.path === 'scenario.tickSecond',
      ),
    );

    const placement = structuredClone(documentById(graph, SCENARIO_ID).draft) as {
      characters: Record<string, unknown>[];
    };
    (placement.characters[0] as Record<string, unknown>).initialValue = {};
    assert.throws(
      () =>
        prepareScenario({
          catalog: createResourceCatalog(BUILT_IN_RESOURCES),
          scenario: placement,
        }),
      /scenario\.characters\[0\]\.initialValue: unknown field/,
    );

    const corrected = applyTransaction(withUnknown, {
      edits: [{ documentId: SCENARIO_ID, draft: documentById(graph, SCENARIO_ID).draft }],
      label: 'fix',
    });
    assert.deepEqual(
      prepareRevision(corrected, SCENARIO_ID).prepared,
      prepareRevision(graph, SCENARIO_ID).prepared,
    );
  });

  it('isolates a started revision from later draft edits until a new revision is applied', () => {
    const { graph } = project();
    const revision = prepareRevision(graph, SCENARIO_ID);
    const started = startRevision(revision);
    const before = {
      baseline: JSON.stringify(serializeSnapshot(started.baseline)),
      state: JSON.stringify(serializeSnapshot(advanceSimulation(started.state, 5))),
    };
    const draft = structuredClone(documentById(graph, NORM_ID).draft) as {
      norm: { label: string };
    };
    draft.norm.label = 'Edited while the simulation runs';
    const edited = applyTransaction(graph, {
      edits: [{ documentId: NORM_ID, draft }],
      label: 'edit',
    });
    assert.equal(JSON.stringify(serializeSnapshot(started.baseline)), before.baseline);
    assert.equal(
      JSON.stringify(serializeSnapshot(advanceSimulation(started.state, 5))),
      before.state,
    );
    assert.equal(
      JSON.stringify(revision.prepared),
      JSON.stringify(prepareRevision(graph, SCENARIO_ID).prepared),
    );

    const next = prepareRevision(edited, SCENARIO_ID);
    assert.notEqual(next.digest, revision.digest);
    assert.notEqual(next.prepared.resourceLock.digest, revision.prepared.resourceLock.digest);
    assert.deepEqual(
      next.prepared.resourceLock.resources,
      revision.prepared.resourceLock.resources,
    );
  });

  it('rejects resuming a snapshot against changed content at the same semantic addresses', () => {
    const { graph } = project();
    const revision = prepareRevision(graph, SCENARIO_ID);
    const snapshot = serializeSnapshot(advanceSimulation(createSimulation(revision.prepared), 3));
    assert.equal(snapshot.schemaVersion, 21);
    assert.equal(snapshot.resourceLock.digest, revision.prepared.resourceLock.digest);
    const resumed = createSimulationFromSnapshot({ prepared: revision.prepared, snapshot });
    assert.deepEqual(serializeSnapshot(resumed), snapshot);

    const draft = structuredClone(documentById(graph, NORM_ID).draft) as {
      norm: { label: string };
    };
    draft.norm.label = 'Changed in place';
    const changed = prepareRevision(
      applyTransaction(graph, { edits: [{ documentId: NORM_ID, draft }], label: 'edit' }),
      SCENARIO_ID,
    );
    assert.throws(
      () => createSimulationFromSnapshot({ prepared: changed.prepared, snapshot }),
      /snapshot\.resourceLock\.digest/,
    );

    const legacy = structuredClone(snapshot) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 16;
    downgradeSnapshotVocabulary(legacy);
    delete (legacy.resourceLock as Record<string, unknown>).digest;
    const migrated = parseSnapshot(legacy);
    assert.equal(migrated.resourceLock.digest, null);
    assert.doesNotThrow(() =>
      createSimulationFromSnapshot({ prepared: changed.prepared, snapshot: legacy }),
    );
  });

  it('validates prepared scenarios structurally at the boundary', () => {
    const { graph } = project();
    const prepared = prepareRevision(graph, SCENARIO_ID).prepared;
    assert.equal(validatePreparedScenario(prepared), prepared);
    assert.throws(
      () => validatePreparedScenario({ type: 'verusim-prepared-scenario' }),
      /prepared\.schemaVersion/,
    );
    const forged = {
      ...prepared,
      resourceLock: { digest: '', resources: prepared.resourceLock.resources },
    };
    assert.throws(() => validatePreparedScenario(forged), /prepared\.resourceLock\.digest/);
    assert.throws(() => createSimulation(forged as never), /prepared\.resourceLock\.digest/);
  });
});
