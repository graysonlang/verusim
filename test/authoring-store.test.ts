import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_SCENARIOS } from '../app/scenarios.js';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import {
  AuthoringStoreConflictError,
  applyTransaction,
  canonicalJson,
  changeSetForGraph,
  commitAuthoringProject,
  createAuthoringGraph,
  createAuthoringStore,
  createMemoryAuthoringStore,
  documentById,
  documentIdentity,
  loadAuthoringProject,
  prepareRevision,
  scenarioDocumentId,
  storeRevision,
  undoTransaction,
  type AuthoredResource,
  type AuthoringStoreBackend,
  type AuthoringStoreRecord,
} from '../src/index.js';

const SCENARIO_ID = scenarioDocumentId('pottsfield');

function project(): AuthoredResource[] {
  const pottsfield = BUILT_IN_SCENARIOS.find(entry => entry.id === 'pottsfield');
  assert.ok(pottsfield);
  return [
    ...BUILT_IN_RESOURCES,
    { source: 'content/scenarios/pottsfield.json', value: pottsfield.scenario },
  ];
}

/**
 * A second adapter with the shape of the browser one: records rest in a
 * keyed table with one metadata row, every load copies them out in whatever
 * order the table yields, and save replaces the table atomically.
 */
function createTableStore() {
  const table = new Map<string, AuthoringStoreRecord>();
  let meta: string | null = null;
  const backend: AuthoringStoreBackend = {
    load: async () => ({
      records: [...table.values()].reverse().map(record => structuredClone(record)),
      revision: meta,
    }),
    save: async (records, revision) => {
      table.clear();
      for (const record of records) table.set(record.id, structuredClone(record));
      meta = revision;
    },
  };
  return { store: createAuthoringStore(backend), table };
}

function documentBytes(graph: ReturnType<typeof createAuthoringGraph>): string {
  return canonicalJson(
    graph.documents.map(document => ({
      baseline: document.baseline,
      diagnostics: document.diagnostics,
      dirty: document.dirty,
      draft: document.draft,
      id: document.id,
      incoming: document.incoming,
      kind: document.kind,
      outgoing: document.outgoing,
      provenance: document.provenance,
    })),
  );
}

describe('authoring store port', () => {
  it('discovers documents in identity order and reads copies', async () => {
    const store = createMemoryAuthoringStore(project());
    const entries = await store.list();
    assert.equal(entries.length, project().length);
    assert.deepEqual(
      entries.map(entry => entry.id),
      [...entries.map(entry => entry.id)].sort(),
    );
    const record = await store.read(SCENARIO_ID);
    assert.equal(record.source, 'content/scenarios/pottsfield.json');
    (record.value as { title: string }).title = 'mutated copy';
    assert.equal(
      ((await store.read(SCENARIO_ID)).value as { title: string }).title,
      'Pottsfield',
      'mutating a read copy never reaches the store',
    );
    await assert.rejects(store.read('scenario:missing'), /no document/);
  });

  it('commits change sets atomically and refuses stale revisions', async () => {
    const store = createMemoryAuthoringStore(project());
    const revision = await store.revision();
    assert.ok(revision);
    const scenario = await store.read(SCENARIO_ID);
    const retitled = { ...(scenario.value as object), title: 'Pottsfield, stored' };
    await assert.rejects(
      store.commit({
        baseRevision: revision,
        deletes: [],
        writes: [
          { id: SCENARIO_ID, source: scenario.source, value: retitled },
          { id: 'scenario:wrong', source: 'x.json', value: retitled },
        ],
      }),
      /identity/,
    );
    assert.equal(
      ((await store.read(SCENARIO_ID)).value as { title: string }).title,
      'Pottsfield',
      'a failing change set writes nothing',
    );
    await assert.rejects(
      store.commit({ baseRevision: 'fnv1a64:stale', deletes: [], writes: [] }),
      AuthoringStoreConflictError,
    );
    const result = await store.commit({
      baseRevision: revision,
      deletes: [],
      writes: [{ id: SCENARIO_ID, source: scenario.source, value: retitled }],
    });
    assert.deepEqual(result.written, [SCENARIO_ID]);
    assert.notEqual(result.revision, revision);
    assert.equal(await store.revision(), result.revision);
    assert.equal(
      ((await store.read(SCENARIO_ID)).value as { title: string }).title,
      'Pottsfield, stored',
    );
    const deleted = await store.commit({
      baseRevision: result.revision,
      deletes: [SCENARIO_ID],
      writes: [],
    });
    assert.equal(
      (await store.list()).some(entry => entry.id === SCENARIO_ID),
      false,
    );
    assert.equal(deleted.revision, storeRevision(await store.readAll()));
  });

  it('loads, commits, and reloads the same project byte-for-byte through both adapters', async () => {
    const documents = project();
    const memory = createMemoryAuthoringStore(documents);
    const table = createTableStore();
    await table.store.commit({
      baseRevision: null,
      deletes: [],
      writes: documents.map(document => ({
        id: documentIdentity(document.value).id,
        source: document.source,
        value: document.value,
      })),
    });
    const direct = createAuthoringGraph(documents);
    const loadedMemory = await loadAuthoringProject(memory);
    const loadedTable = await loadAuthoringProject(table.store);
    assert.equal(documentBytes(loadedMemory.graph), documentBytes(direct));
    assert.equal(documentBytes(loadedTable.graph), documentBytes(direct));
    assert.equal(
      loadedMemory.revision,
      loadedTable.revision,
      'the same records digest to the same revision',
    );
    assert.equal(
      prepareRevision(loadedMemory.graph, SCENARIO_ID).digest,
      prepareRevision(direct, SCENARIO_ID).digest,
    );

    const edit = (graph: typeof direct) =>
      applyTransaction(graph, {
        edits: [
          {
            documentId: SCENARIO_ID,
            draft: {
              ...(documentById(graph, SCENARIO_ID).draft as object),
              title: 'Pottsfield, stored',
            },
          },
        ],
        label: 'Retitle',
      });
    const editedMemory = edit(loadedMemory.graph);
    const editedTable = edit(loadedTable.graph);
    assert.deepEqual(
      changeSetForGraph(editedMemory, loadedMemory.revision).writes.map(write => write.id),
      [SCENARIO_ID],
      'only the dirty document is written against a populated store',
    );
    const committedMemory = await commitAuthoringProject(
      memory,
      editedMemory,
      loadedMemory.revision,
    );
    const committedTable = await commitAuthoringProject(
      table.store,
      editedTable,
      loadedTable.revision,
    );
    assert.equal(committedMemory.result.revision, committedTable.result.revision);
    assert.equal(documentById(committedMemory.graph, SCENARIO_ID).dirty, false);
    assert.equal(committedMemory.graph.undoStack.length, 1, 'history survives a commit');
    assert.equal(
      documentById(undoTransaction(committedMemory.graph), SCENARIO_ID).dirty,
      true,
      'undoing past the commit makes the document dirty against the new baseline',
    );

    const reloadedMemory = await loadAuthoringProject(memory);
    const reloadedTable = await loadAuthoringProject(table.store);
    assert.equal(documentBytes(reloadedMemory.graph), documentBytes(reloadedTable.graph));
    assert.equal(
      documentBytes(reloadedMemory.graph),
      documentBytes({ ...committedMemory.graph, redoStack: [], undoStack: [] }),
      'a reload sees exactly the committed drafts as clean baselines',
    );
    assert.equal(
      (documentById(reloadedTable.graph, SCENARIO_ID).draft as { title: string }).title,
      'Pottsfield, stored',
    );
    assert.equal(
      prepareRevision(reloadedMemory.graph, SCENARIO_ID).digest,
      prepareRevision(committedMemory.graph, SCENARIO_ID).digest,
    );
    assert.equal(
      prepareRevision(reloadedTable.graph, SCENARIO_ID).digest,
      prepareRevision(editedTable, SCENARIO_ID).digest,
    );
  });

  it('writes every document against an empty store and keeps invalid drafts as authored', async () => {
    const store = createMemoryAuthoringStore();
    assert.equal(await store.revision(), null);
    const graph = applyTransaction(createAuthoringGraph(project()), {
      edits: [
        {
          documentId: SCENARIO_ID,
          draft: {
            ...(documentById(createAuthoringGraph(project()), SCENARIO_ID).draft as object),
            tickSeconds: 0,
          },
        },
      ],
      label: 'Break tick',
    });
    const committed = await commitAuthoringProject(store, graph, null);
    assert.equal(committed.result.written.length, project().length);
    const reloaded = await loadAuthoringProject(store);
    assert.equal(documentById(reloaded.graph, SCENARIO_ID).diagnostics.length, 1);
    assert.equal(
      canonicalJson(documentById(reloaded.graph, SCENARIO_ID).diagnostics),
      canonicalJson(documentById(committed.graph, SCENARIO_ID).diagnostics),
      'validation results are the same after reload',
    );
  });
});
