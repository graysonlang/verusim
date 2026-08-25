import { documentById } from '../../src/index.js';
import { type BuildWorkspace, editBuildDocument } from '../workspace.js';
import { getAtPath, insertAtPath, removeAtPath, setAtPath } from './paths.js';

/**
 * Field-level draft edits over the Build workspace. Every operation reads the
 * selected document's draft, derives the next draft immutably, and records one
 * undoable transaction through `editBuildDocument`; the authoring graph then
 * recomputes dirty state, references, and diagnostics for that document.
 */

export function setDraftValue(
  workspace: BuildWorkspace,
  documentId: string,
  path: string,
  value: unknown,
  label: string,
): BuildWorkspace {
  const draft = documentById(workspace.graph, documentId).draft;
  if (JSON.stringify(getAtPath(draft, path)) === JSON.stringify(value)) return workspace;
  return editBuildDocument(workspace, documentId, setAtPath(draft, path, value), label);
}

export function removeDraftEntry(
  workspace: BuildWorkspace,
  documentId: string,
  path: string,
  label: string,
): BuildWorkspace {
  const draft = documentById(workspace.graph, documentId).draft;
  if (getAtPath(draft, path) === undefined) return workspace;
  return editBuildDocument(workspace, documentId, removeAtPath(draft, path), label);
}

export function insertDraftEntry(
  workspace: BuildWorkspace,
  documentId: string,
  listPath: string,
  item: unknown,
  label: string,
  index?: number,
): BuildWorkspace {
  const draft = documentById(workspace.graph, documentId).draft;
  return editBuildDocument(
    workspace,
    documentId,
    insertAtPath(draft, listPath, item, index),
    label,
  );
}

/** Move an array entry from one index to another within the same list. */
export function moveDraftEntry(
  workspace: BuildWorkspace,
  documentId: string,
  listPath: string,
  from: number,
  to: number,
  label: string,
): BuildWorkspace {
  const draft = documentById(workspace.graph, documentId).draft;
  const list = getAtPath(draft, listPath);
  if (!Array.isArray(list) || from === to || from < 0 || from >= list.length) return workspace;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return editBuildDocument(workspace, documentId, setAtPath(draft, listPath, next), label);
}
