import type { AuthoredResource, ResourceAddress, ResourceKind } from '../model/types.js';
import { RESOURCE_KINDS } from '../model/types.js';
import { parseResourceFile, parseScenario, resourceAddressKey } from '../scenario/parse.js';

// The authoring graph is the host-neutral in-memory representation of an
// authored project. Documents are keyed by semantic identity - a resource's
// address key or a scenario's identifier - never by the path they were loaded
// from, so reorganizing a source tree is a provenance change and nothing else.
// Every operation is a pure function from one graph value to the next, and the
// undo and redo stacks hold byte-equivalent draft values so a round trip
// restores drafts, reference indexes, diagnostics, and dirty state exactly.

export type AuthoringDocumentKind = 'scenario' | ResourceKind;

export interface AuthoringProvenance {
  source: string;
}

export interface AuthoringDiagnostic {
  documentId: string;
  message: string;
  path: string;
}

export interface AuthoringDocument {
  baseline: unknown;
  diagnostics: readonly AuthoringDiagnostic[];
  dirty: boolean;
  draft: unknown;
  id: string;
  incoming: readonly string[];
  kind: AuthoringDocumentKind;
  outgoing: readonly string[];
  provenance: AuthoringProvenance;
}

export interface AuthoringEdit {
  documentId: string;
  draft: unknown;
}

export interface AuthoringTransaction {
  edits: readonly AuthoringEdit[];
  label: string;
}

export interface AuthoringHistoryEntry {
  after: readonly AuthoringEdit[];
  before: readonly AuthoringEdit[];
  label: string;
}

export interface AuthoringGraph {
  documents: readonly AuthoringDocument[];
  redoStack: readonly AuthoringHistoryEntry[];
  undoStack: readonly AuthoringHistoryEntry[];
}

const RESOURCE_KIND_SET: ReadonlySet<string> = new Set(RESOURCE_KINDS);

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function canonical(value: unknown): string {
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addressKeyOf(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const { kind, packageId, resourceId } = value;
  if (
    typeof kind !== 'string' ||
    !RESOURCE_KIND_SET.has(kind) ||
    typeof packageId !== 'string' ||
    typeof resourceId !== 'string'
  ) {
    return null;
  }
  return resourceAddressKey({ kind, packageId, resourceId } as ResourceAddress);
}

export function scenarioDocumentId(scenarioId: string): string {
  return `scenario:${scenarioId}`;
}

/** Derive a document's semantic identity from its authored value. */
export function documentIdentity(value: unknown): { id: string; kind: AuthoringDocumentKind } {
  if (!isRecord(value)) throw new Error('An authored document must be an object');
  if ('address' in value) {
    const address = value.address;
    const key = addressKeyOf(address);
    if (key === null) throw new Error('An authored resource needs a structured semantic address');
    return { id: key, kind: (address as ResourceAddress).kind };
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error('An authored scenario needs a string identifier');
  }
  return { id: scenarioDocumentId(value.id), kind: 'scenario' };
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function outgoingReferences(kind: AuthoringDocumentKind, draft: unknown): string[] {
  const keys = new Set<string>();
  const add = (address: unknown): void => {
    const key = addressKeyOf(address);
    if (key !== null) keys.add(key);
  };
  if (!isRecord(draft)) return [];
  if (kind === 'scenario') {
    add(draft.environment);
    for (const placement of records(draft.characters)) {
      add(placement.profile);
      for (const perspective of records(placement.normPerspectives)) add(perspective.norm);
    }
    for (const placement of records(draft.socialContractPlacements)) add(placement.contract);
    for (const event of records(draft.observationEvents)) add(event.norm);
  } else if (kind === 'social-contract' && isRecord(draft.contract)) {
    for (const address of records(draft.contract.norms)) add(address);
  }
  return [...keys].sort();
}

function validationDiagnostics(document: {
  draft: unknown;
  id: string;
  kind: AuthoringDocumentKind;
}): AuthoringDiagnostic[] {
  try {
    if (document.kind === 'scenario') parseScenario(document.draft);
    else parseResourceFile(document.draft, document.id);
    return [];
  } catch (error) {
    const path = isRecord(error) && typeof error.path === 'string' ? error.path : document.id;
    const message = error instanceof Error ? error.message : String(error);
    return [{ documentId: document.id, message, path }];
  }
}

function refreshIndexes(
  documents: readonly Omit<AuthoringDocument, 'diagnostics' | 'incoming'>[],
): AuthoringDocument[] {
  const ids = new Set(documents.map(document => document.id));
  const incoming = new Map<string, string[]>();
  for (const document of documents) {
    for (const target of document.outgoing) {
      const list = incoming.get(target) ?? [];
      list.push(document.id);
      incoming.set(target, list);
    }
  }
  return documents.map(document => {
    const diagnostics = validationDiagnostics(document);
    const identity = (() => {
      try {
        return documentIdentity(document.draft).id;
      } catch {
        return document.id;
      }
    })();
    if (identity !== document.id) {
      diagnostics.push({
        documentId: document.id,
        message: `draft identity "${identity}" differs from document identity; renaming is a separate operation`,
        path: document.id,
      });
    }
    for (const target of document.outgoing) {
      if (!ids.has(target)) {
        diagnostics.push({
          documentId: document.id,
          message: `unresolved reference "${target}"`,
          path: document.id,
        });
      }
    }
    return {
      ...document,
      diagnostics: Object.freeze(diagnostics),
      incoming: Object.freeze([...new Set(incoming.get(document.id) ?? [])].sort()),
    };
  });
}

function withDraft(
  document: AuthoringDocument,
  draft: unknown,
): Omit<AuthoringDocument, 'diagnostics' | 'incoming'> {
  const next = clone(draft);
  return {
    baseline: document.baseline,
    dirty: canonical(next) !== canonical(document.baseline),
    draft: next,
    id: document.id,
    kind: document.kind,
    outgoing: Object.freeze(outgoingReferences(document.kind, next)),
    provenance: document.provenance,
  };
}

/** Build a graph from authored documents; identity comes from each value, never its source. */
export function createAuthoringGraph(documents: readonly AuthoredResource[]): AuthoringGraph {
  const seen = new Map<string, string>();
  const loaded = documents.map(input => {
    const { id, kind } = documentIdentity(input.value);
    const previous = seen.get(id);
    if (previous !== undefined) {
      throw new Error(
        `${input.source}: duplicate document identity "${id}"; first authored at ${previous}`,
      );
    }
    seen.set(id, input.source);
    const baseline = clone(input.value);
    return {
      baseline,
      dirty: false,
      draft: clone(baseline),
      id,
      kind,
      outgoing: Object.freeze(outgoingReferences(kind, baseline)),
      provenance: { source: input.source },
    };
  });
  loaded.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return { documents: refreshIndexes(loaded), redoStack: [], undoStack: [] };
}

export function documentById(graph: AuthoringGraph, documentId: string): AuthoringDocument {
  const document = graph.documents.find(candidate => candidate.id === documentId);
  if (document === undefined) throw new Error(`Unknown authoring document "${documentId}"`);
  return document;
}

function replaceDrafts(
  graph: AuthoringGraph,
  edits: readonly AuthoringEdit[],
): AuthoringDocument[] {
  const byId = new Map(edits.map(edit => [edit.documentId, edit.draft] as const));
  return refreshIndexes(
    graph.documents.map(document =>
      byId.has(document.id) ? withDraft(document, byId.get(document.id)) : document,
    ),
  );
}

/** Apply one atomic transaction; every edit succeeds or the graph is unchanged. */
export function applyTransaction(
  graph: AuthoringGraph,
  transaction: AuthoringTransaction,
): AuthoringGraph {
  const seen = new Set<string>();
  const before = transaction.edits.map(edit => {
    if (seen.has(edit.documentId)) {
      throw new Error(`Transaction edits document "${edit.documentId}" more than once`);
    }
    seen.add(edit.documentId);
    return {
      documentId: edit.documentId,
      draft: clone(documentById(graph, edit.documentId).draft),
    };
  });
  const after = transaction.edits.map(edit => ({
    documentId: edit.documentId,
    draft: clone(edit.draft),
  }));
  return {
    documents: replaceDrafts(graph, after),
    redoStack: [],
    undoStack: [...graph.undoStack, { after, before, label: transaction.label }],
  };
}

export function undoTransaction(graph: AuthoringGraph): AuthoringGraph {
  const entry = graph.undoStack.at(-1);
  if (entry === undefined) return graph;
  return {
    documents: replaceDrafts(graph, entry.before),
    redoStack: [...graph.redoStack, entry],
    undoStack: graph.undoStack.slice(0, -1),
  };
}

export function redoTransaction(graph: AuthoringGraph): AuthoringGraph {
  const entry = graph.redoStack.at(-1);
  if (entry === undefined) return graph;
  return {
    documents: replaceDrafts(graph, entry.after),
    redoStack: graph.redoStack.slice(0, -1),
    undoStack: [...graph.undoStack, entry],
  };
}

/** Change where a document came from without touching identity, drafts, or references. */
export function relocateDocument(
  graph: AuthoringGraph,
  documentId: string,
  source: string,
): AuthoringGraph {
  documentById(graph, documentId);
  return {
    ...graph,
    documents: graph.documents.map(document =>
      document.id === documentId ? { ...document, provenance: { source } } : document,
    ),
  };
}
