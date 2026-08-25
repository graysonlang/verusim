import type { AuthoredResource } from '../model/types.js';
import { contentDigest } from '../scenario/digest.js';
import {
  type AuthoringGraph,
  createAuthoringGraph,
  documentIdentity,
  rebaselineDocuments,
} from './graph.js';

// The authoring-store port is how a host persists an authored project without
// the engine learning where documents live. A store discovers documents in a
// deterministic order, reads them by semantic identity, and commits a change
// set atomically: every write lands or none does, and a commit made against a
// stale revision is refused. Adapters differ only in where records rest - an
// in-memory map for embedded consumers and tests, IndexedDB in the browser -
// and none of them may change identity, content, validation, or transaction
// boundaries: the graph is built from what a store returns exactly as it would
// be from files, and a committed draft is the same bytes that were authored.

/** One stored document: its semantic identity, provenance, and authored value. */
export interface AuthoringStoreRecord {
  id: string;
  source: string;
  value: unknown;
}

export interface AuthoringStoreEntry {
  id: string;
  source: string;
}

export interface AuthoringChangeSet {
  /** The revision the change set was derived from; a different current revision refuses the commit. */
  baseRevision: string | null;
  deletes: readonly string[];
  writes: readonly AuthoringStoreRecord[];
}

export interface AuthoringCommitResult {
  /** The store revision after the commit: a content digest of every stored record. */
  revision: string;
  written: readonly string[];
}

export interface AuthoringStore {
  commit: (changeSet: AuthoringChangeSet) => Promise<AuthoringCommitResult>;
  list: () => Promise<readonly AuthoringStoreEntry[]>;
  read: (id: string) => Promise<AuthoringStoreRecord>;
  readAll: () => Promise<readonly AuthoringStoreRecord[]>;
  revision: () => Promise<string | null>;
}

/**
 * What an adapter must provide: read every record with the stored revision,
 * and replace the whole record set with a new revision atomically. Everything
 * else - ordering, identity checks, revision digests, change-set semantics -
 * lives in the shared core so adapters cannot diverge.
 */
export interface AuthoringStoreBackend {
  load: () => Promise<{ records: readonly AuthoringStoreRecord[]; revision: string | null }>;
  save: (records: readonly AuthoringStoreRecord[], revision: string) => Promise<void>;
}

export class AuthoringStoreConflictError extends Error {
  readonly currentRevision: string | null;
  readonly expectedRevision: string | null;

  constructor(expectedRevision: string | null, currentRevision: string | null) {
    super(
      `authoring store revision ${currentRevision ?? 'none'} does not match the change set's base ${expectedRevision ?? 'none'}`,
    );
    this.name = 'AuthoringStoreConflictError';
    this.currentRevision = currentRevision;
    this.expectedRevision = expectedRevision;
  }
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function byId(left: { id: string }, right: { id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/** The revision of a record set: a digest of identities, provenance, and values in identity order. */
export function storeRevision(records: readonly AuthoringStoreRecord[]): string {
  return contentDigest(
    [...records]
      .sort(byId)
      .map(record => ({ id: record.id, source: record.source, value: record.value })),
  );
}

function checkedRecord(record: AuthoringStoreRecord): AuthoringStoreRecord {
  const identity = documentIdentity(record.value);
  if (identity.id !== record.id) {
    throw new Error(
      `authoring store record "${record.id}" carries a value whose identity is "${identity.id}"`,
    );
  }
  if (typeof record.source !== 'string' || record.source.length === 0) {
    throw new Error(`authoring store record "${record.id}" needs a source`);
  }
  return { id: record.id, source: record.source, value: clone(record.value) };
}

/** Wrap a backend in the shared store semantics. */
export function createAuthoringStore(backend: AuthoringStoreBackend): AuthoringStore {
  const current = async (): Promise<{
    records: Map<string, AuthoringStoreRecord>;
    revision: string | null;
  }> => {
    const loaded = await backend.load();
    return {
      records: new Map(
        [...loaded.records].sort(byId).map(record => [record.id, checkedRecord(record)]),
      ),
      revision: loaded.revision,
    };
  };
  return {
    async commit(changeSet) {
      const state = await current();
      if (state.revision !== changeSet.baseRevision) {
        throw new AuthoringStoreConflictError(changeSet.baseRevision, state.revision);
      }
      const next = new Map(state.records);
      const written: string[] = [];
      const seen = new Set<string>();
      for (const write of changeSet.writes) {
        if (seen.has(write.id)) {
          throw new Error(`change set writes document "${write.id}" more than once`);
        }
        seen.add(write.id);
        next.set(write.id, checkedRecord(write));
        written.push(write.id);
      }
      for (const id of changeSet.deletes) {
        if (!next.has(id)) throw new Error(`change set deletes unknown document "${id}"`);
        next.delete(id);
      }
      const records = [...next.values()].sort(byId);
      const revision = storeRevision(records);
      await backend.save(records, revision);
      return { revision, written: written.sort() };
    },
    async list() {
      const state = await current();
      return [...state.records.values()].map(record => ({ id: record.id, source: record.source }));
    },
    async read(id) {
      const state = await current();
      const record = state.records.get(id);
      if (record === undefined) throw new Error(`authoring store has no document "${id}"`);
      return clone(record);
    },
    async readAll() {
      const state = await current();
      return [...state.records.values()].map(record => clone(record));
    },
    async revision() {
      return (await backend.load()).revision;
    },
  };
}

/** The in-memory adapter: records live in a map owned by the store; every read is a copy. */
export function createMemoryAuthoringStore(
  initial: readonly AuthoredResource[] = [],
): AuthoringStore {
  let records: AuthoringStoreRecord[] = initial.map(document =>
    checkedRecord({ id: documentIdentity(document.value).id, ...document }),
  );
  let revision: string | null = records.length === 0 ? null : storeRevision(records);
  return createAuthoringStore({
    load: async () => ({ records: records.map(record => clone(record)), revision }),
    save: async (next, nextRevision) => {
      records = next.map(record => clone(record));
      revision = nextRevision;
    },
  });
}

export interface LoadedAuthoringProject {
  graph: AuthoringGraph;
  revision: string | null;
}

/** Build a graph from everything a store holds; identity and content come from the records exactly. */
export async function loadAuthoringProject(store: AuthoringStore): Promise<LoadedAuthoringProject> {
  const [records, revision] = await Promise.all([store.readAll(), store.revision()]);
  return {
    graph: createAuthoringGraph(
      records.map(record => ({ source: record.source, value: record.value })),
    ),
    revision,
  };
}

/**
 * The change set that brings a store from `baseRevision` to the graph's drafts.
 * Against an empty store every document is written; otherwise only documents
 * whose draft differs from the loaded baseline are, so a commit records exactly
 * the authored changes and nothing about the editing session's history.
 */
export function changeSetForGraph(
  graph: AuthoringGraph,
  baseRevision: string | null,
): AuthoringChangeSet {
  const all = baseRevision === null;
  return {
    baseRevision,
    deletes: [],
    writes: graph.documents
      .filter(document => all || document.dirty)
      .map(document => ({
        id: document.id,
        source: document.provenance.source,
        value: clone(document.draft),
      })),
  };
}

export interface CommittedAuthoringProject {
  graph: AuthoringGraph;
  result: AuthoringCommitResult;
}

/**
 * Commit the graph's changes and re-baseline the written documents so dirty
 * state now means "changed since the last commit"; undo and redo history is
 * untouched, so transaction boundaries survive a save.
 */
export async function commitAuthoringProject(
  store: AuthoringStore,
  graph: AuthoringGraph,
  baseRevision: string | null,
): Promise<CommittedAuthoringProject> {
  const changeSet = changeSetForGraph(graph, baseRevision);
  const result = await store.commit(changeSet);
  return { graph: rebaselineDocuments(graph, result.written), result };
}
