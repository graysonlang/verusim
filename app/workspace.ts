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

/** Where the Build draft editor is looking: the JSON view's scroll and caret. */
export interface EditorViewport {
  scrollTop: number;
  selectionEnd: number;
  selectionStart: number;
}

/** The layout editor's spatial camera: the active layer, world-space center in meters, and zoom. */
export interface EditorCamera {
  layerId: string | null;
  x: number;
  y: number;
  zoom: number;
}

export type BuildEditorView = 'canvas' | 'form' | 'json';

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
  /** Per-document spatial cameras, keyed by document id, kept across selection changes. */
  cameras: Readonly<Record<string, EditorCamera>>;
  graph: AuthoringGraph;
  /** The last preparation failure, cleared by the next successful preparation. */
  preparationProblem: BuildProblem | null;
  scenarioDocumentId: string;
  selectedDocumentId: string;
  selectedPath: string | null;
  /** The authoring-store revision the drafts were loaded from or last committed to, or null. */
  storeRevision: string | null;
  /** Which editor presents the selected document: form, spatial canvas, or the raw JSON advanced view. */
  view: BuildEditorView;
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
    cameras: {},
    graph,
    preparationProblem: null,
    scenarioDocumentId: documentId,
    selectedDocumentId: documentId,
    selectedPath: null,
    storeRevision: null,
    view: 'form',
    viewport: IDLE_EDITOR_VIEWPORT,
  };
}

/** After a store commit: the committed graph (re-baselined) and the new store revision. */
export function rebaselineBuildWorkspace(
  workspace: BuildWorkspace,
  graph: AuthoringGraph,
  revision: string,
): BuildWorkspace {
  return { ...workspace, graph, storeRevision: revision };
}

/**
 * Replace the project with one loaded from a store. Selection stays on the
 * same documents when they still exist, cameras and view are kept, and the
 * applied revision is untouched: Simulate keeps running what it was running.
 */
export function replaceBuildProject(
  workspace: BuildWorkspace,
  graph: AuthoringGraph,
  revision: string | null,
): BuildWorkspace {
  const has = (id: string): boolean => graph.documents.some(document => document.id === id);
  const scenario = has(workspace.scenarioDocumentId)
    ? workspace.scenarioDocumentId
    : (graph.documents.find(document => document.kind === 'scenario')?.id ?? null);
  if (scenario === null) throw new Error('The loaded project has no scenario document');
  return {
    ...workspace,
    graph,
    preparationProblem: null,
    scenarioDocumentId: scenario,
    selectedDocumentId: has(workspace.selectedDocumentId) ? workspace.selectedDocumentId : scenario,
    selectedPath: null,
    storeRevision: revision,
  };
}

export function selectBuildDocument(workspace: BuildWorkspace, documentId: string): BuildWorkspace {
  documentById(workspace.graph, documentId);
  if (documentId === workspace.selectedDocumentId) return workspace;
  const kind = documentById(workspace.graph, documentId).kind;
  return {
    ...workspace,
    selectedDocumentId: documentId,
    selectedPath: null,
    view: workspace.view === 'canvas' && kind !== 'environment-layout' ? 'form' : workspace.view,
    viewport: IDLE_EDITOR_VIEWPORT,
  };
}

export function setBuildView(workspace: BuildWorkspace, view: BuildEditorView): BuildWorkspace {
  return view === workspace.view ? workspace : { ...workspace, view };
}

/** Remember the spatial camera for one document; it survives selection and mode changes. */
export function setBuildCamera(
  workspace: BuildWorkspace,
  documentId: string,
  camera: EditorCamera,
): BuildWorkspace {
  return { ...workspace, cameras: { ...workspace.cameras, [documentId]: { ...camera } } };
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

/** Parser messages repeat their authored path; problems carry the path separately. */
function problemMessage(path: string, message: string): string {
  const prefix = `${path}: `;
  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

/** Document validation diagnostics plus the last preparation failure, in explorer order, without duplicates. */
export function buildProblems(workspace: BuildWorkspace): readonly BuildProblem[] {
  const problems: BuildProblem[] = workspace.graph.documents.flatMap(document =>
    document.diagnostics.map((diagnostic: AuthoringDiagnostic) => ({
      documentId: diagnostic.documentId,
      message: problemMessage(diagnostic.path, diagnostic.message),
      path: diagnostic.path,
    })),
  );
  if (workspace.preparationProblem !== null) {
    problems.push({
      ...workspace.preparationProblem,
      message: problemMessage(
        workspace.preparationProblem.path,
        workspace.preparationProblem.message,
      ),
    });
  }
  const seen = new Set<string>();
  return problems.filter(problem => {
    const key = `${problem.documentId ?? ''}\u0000${problem.path}\u0000${problem.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
