import { ScenarioValidationError } from '../src/model/validation.js';
import {
  applyTransaction,
  contentDigest,
  createAuthoringGraph,
  documentById,
  prepareRevision,
  redoTransaction,
  scenarioDocumentId,
  undoTransaction,
  type AuthoredResource,
  type AuthoringDiagnostic,
  type AuthoringGraph,
  type AuthoringRevision,
} from '../src/index.js';

/**
 * The workbench has two workspaces that never share state.
 *
 * Build owns the authored project: the document graph with its drafts, dirty
 * state, and undo history, plus the editing selection and viewport. Simulate
 * owns only runtime state derived from one explicitly prepared revision. The
 * only bridge is `prepareBuildRevision`, which runs the ordinary preparation
 * boundary and hands back a prepared revision for Simulate to start; nothing
 * flows the other way, so interventions, snapshots, runtime selection, and the
 * world camera can never reach a draft.
 */
export type WorkbenchMode = 'build' | 'simulate';

export const WORKBENCH_MODES: readonly WorkbenchMode[] = ['build', 'simulate'];

/** Where the Build editor is looking; the spatial camera arrives with the layout editor in Phase 8D. */
export interface EditorViewport {
  scrollTop: number;
  selectionEnd: number;
  selectionStart: number;
}

export interface BuildProblem {
  documentId: string | null;
  message: string;
  path: string;
}

export interface BuildWorkspace {
  /** Digest of the drafts at the last successful preparation, or null before any. */
  appliedDraftDigest: string | null;
  /** Revision digest Simulate is running, or null before any preparation. */
  appliedDigest: string | null;
  graph: AuthoringGraph;
  /** The last preparation failure, cleared by the next successful preparation. */
  preparationProblem: BuildProblem | null;
  scenarioDocumentId: string;
  selectedDocumentId: string;
  selectedPath: string | null;
  viewport: EditorViewport;
}

export type BuildRevisionResult =
  | { problem: BuildProblem; workspace: BuildWorkspace }
  | { revision: AuthoringRevision; workspace: BuildWorkspace };

export const IDLE_EDITOR_VIEWPORT: EditorViewport = Object.freeze({
  scrollTop: 0,
  selectionEnd: 0,
  selectionStart: 0,
});

function draftsDigest(graph: AuthoringGraph): string {
  return contentDigest(
    graph.documents.map(document => ({ draft: document.draft, id: document.id })),
  );
}

export function createBuildWorkspace(input: {
  resources: readonly AuthoredResource[];
  scenario: { id: string };
  source: string;
}): BuildWorkspace {
  const documentId = scenarioDocumentId(input.scenario.id);
  const graph = createAuthoringGraph([
    ...input.resources,
    { source: input.source, value: input.scenario },
  ]);
  documentById(graph, documentId);
  return {
    appliedDigest: null,
    appliedDraftDigest: null,
    graph,
    preparationProblem: null,
    scenarioDocumentId: documentId,
    selectedDocumentId: documentId,
    selectedPath: null,
    viewport: IDLE_EDITOR_VIEWPORT,
  };
}

export function selectBuildDocument(workspace: BuildWorkspace, documentId: string): BuildWorkspace {
  documentById(workspace.graph, documentId);
  if (documentId === workspace.selectedDocumentId) return workspace;
  return {
    ...workspace,
    selectedDocumentId: documentId,
    selectedPath: null,
    viewport: IDLE_EDITOR_VIEWPORT,
  };
}

export function selectBuildPath(workspace: BuildWorkspace, path: string | null): BuildWorkspace {
  return path === workspace.selectedPath ? workspace : { ...workspace, selectedPath: path };
}

export function setBuildViewport(
  workspace: BuildWorkspace,
  viewport: EditorViewport,
): BuildWorkspace {
  return { ...workspace, viewport: { ...viewport } };
}

/** Replace one document's draft as an undoable transaction. */
export function editBuildDocument(
  workspace: BuildWorkspace,
  documentId: string,
  draft: unknown,
  label: string,
): BuildWorkspace {
  return {
    ...workspace,
    graph: applyTransaction(workspace.graph, { edits: [{ documentId, draft }], label }),
  };
}

export function undoBuildEdit(workspace: BuildWorkspace): BuildWorkspace {
  if (workspace.graph.undoStack.length === 0) return workspace;
  return { ...workspace, graph: undoTransaction(workspace.graph) };
}

export function redoBuildEdit(workspace: BuildWorkspace): BuildWorkspace {
  if (workspace.graph.redoStack.length === 0) return workspace;
  return { ...workspace, graph: redoTransaction(workspace.graph) };
}

/** True when any draft differs from its loaded baseline. */
export function buildDirty(workspace: BuildWorkspace): boolean {
  return workspace.graph.documents.some(document => document.dirty);
}

/** True when the drafts differ from the revision Simulate is running (or none has run). */
export function buildRevisionPending(workspace: BuildWorkspace): boolean {
  return (
    workspace.appliedDraftDigest === null ||
    draftsDigest(workspace.graph) !== workspace.appliedDraftDigest
  );
}

/** Document validation diagnostics plus the last preparation failure, in explorer order. */
export function buildProblems(workspace: BuildWorkspace): readonly BuildProblem[] {
  const problems: BuildProblem[] = workspace.graph.documents.flatMap(document =>
    document.diagnostics.map((diagnostic: AuthoringDiagnostic) => ({
      documentId: diagnostic.documentId,
      message: diagnostic.message,
      path: diagnostic.path,
    })),
  );
  if (workspace.preparationProblem !== null) problems.push(workspace.preparationProblem);
  return problems;
}

/**
 * Prepare the drafts into a runnable revision through the ordinary boundary.
 * On failure the workspace records the problem at its authored path and keeps
 * every draft, selection, and history intact; the previously applied revision
 * is untouched either way.
 */
export function prepareBuildRevision(workspace: BuildWorkspace): BuildRevisionResult {
  try {
    const revision = prepareRevision(workspace.graph, workspace.scenarioDocumentId);
    return {
      revision,
      workspace: {
        ...workspace,
        appliedDigest: revision.digest,
        appliedDraftDigest: draftsDigest(workspace.graph),
        preparationProblem: null,
      },
    };
  } catch (error) {
    const problem: BuildProblem = {
      documentId: workspace.scenarioDocumentId,
      message: error instanceof Error ? error.message : String(error),
      path: error instanceof ScenarioValidationError ? error.path : 'scenario',
    };
    return { problem, workspace: { ...workspace, preparationProblem: problem } };
  }
}

/** Mark the workspace as running a revision prepared elsewhere (a loaded file or built-in). */
export function markBuildApplied(workspace: BuildWorkspace, digest: string): BuildWorkspace {
  return {
    ...workspace,
    appliedDigest: digest,
    appliedDraftDigest: draftsDigest(workspace.graph),
    preparationProblem: null,
  };
}

export function toggleWorkbenchMode(mode: WorkbenchMode): WorkbenchMode {
  return mode === 'build' ? 'simulate' : 'build';
}
