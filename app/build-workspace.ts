import type { AuthoringDocument } from '../src/index.js';
import { button, element } from './dom.js';
import { activeDocumentElement, morphChildren } from './morph.js';
import {
  buildDirty,
  buildProblems,
  buildRevisionPending,
  type BuildProblem,
  type BuildWorkspace,
  type EditorViewport,
} from './workspace.js';

/**
 * Build workspace presentation: a content explorer over the document graph, a
 * raw JSON draft editor (the advanced view that precedes the Phase 8D editors),
 * and a document inspector with provenance, references, and problems.
 *
 * The panels never touch Simulate state. Every change goes through the handlers,
 * which the shell routes into the pure workspace model, and the panels are
 * re-rendered from that model with in-place reconciliation so the explorer
 * selection, editor scroll, and caret survive every render.
 */
export interface BuildHandlers {
  onEdit: (documentId: string, draft: unknown, label: string) => void;
  onRedo: () => void;
  onRunRevision: () => void;
  onSelectDocument: (documentId: string) => void;
  onSelectPath: (path: string | null) => void;
  onStatus: (message: string) => void;
  onUndo: () => void;
  onViewport: (viewport: EditorViewport) => void;
}

export interface BuildPanels {
  editor: HTMLElement;
  explorer: HTMLElement;
  inspector: HTMLElement;
  render: (workspace: BuildWorkspace) => void;
}

const KIND_LABELS: Record<string, string> = {
  'character-profile': 'Characters',
  'environment-layout': 'Environments',
  norm: 'Norms',
  scenario: 'Scenario',
  'social-contract': 'Social contracts',
};

/** The key each resource file keeps its payload under. */
const PAYLOAD_KEYS: Record<string, string> = {
  'character-profile': 'profile',
  'environment-layout': 'layout',
  norm: 'norm',
  'social-contract': 'contract',
};

const KIND_ORDER = [
  'scenario',
  'environment-layout',
  'character-profile',
  'norm',
  'social-contract',
];

function documentLabel(document: AuthoringDocument): string {
  const draft = document.draft;
  if (typeof draft === 'object' && draft !== null) {
    const record = draft as Record<string, unknown>;
    for (const key of ['title', 'name', 'label']) {
      const value = record[key];
      if (typeof value === 'string' && value.length > 0) return value;
    }
    const inner = record[PAYLOAD_KEYS[document.kind] ?? document.kind];
    if (typeof inner === 'object' && inner !== null) {
      const label = (inner as Record<string, unknown>).label;
      if (typeof label === 'string' && label.length > 0) return label;
      const name = (inner as Record<string, unknown>).name;
      if (typeof name === 'string' && name.length > 0) return name;
    }
  }
  return document.id;
}

function formatDraft(draft: unknown): string {
  return `${JSON.stringify(draft, null, 2)}\n`;
}

function kindRank(kind: string): number {
  const index = KIND_ORDER.indexOf(kind);
  return index === -1 ? KIND_ORDER.length : index;
}

function problemItem(problem: BuildProblem, showDocument: boolean): HTMLElement {
  const item = element('li', 'build-problem');
  const control = button('', 'build-problem-button');
  const path = element('code');
  const message = element('span');
  control.dataset.problemPath = problem.path;
  if (problem.documentId !== null) control.dataset.problemDocument = problem.documentId;
  path.textContent =
    showDocument && problem.documentId !== null
      ? `${problem.documentId} ${problem.path}`
      : problem.path;
  message.textContent = problem.message;
  control.append(path, message);
  item.append(control);
  return item;
}

export function createBuildPanels(handlers: BuildHandlers): BuildPanels {
  const explorer = element('aside', 'build-explorer');
  const explorerHeader = element('div', 'panel-header');
  const explorerTitle = element('h2');
  const explorerList = element('div', 'build-explorer-list');
  const editor = element('section', 'build-editor');
  const toolbar = element('div', 'build-toolbar');
  const editorTitle = element('h2', 'build-editor-title');
  const editorMeta = element('span', 'build-editor-meta');
  const applyEdit = button('Apply edit', 'button');
  const revertEdit = button('Revert', 'button subtle');
  const undo = button('Undo', 'button subtle');
  const redo = button('Redo', 'button subtle');
  const runRevision = button('Run revision', 'button primary');
  const textarea = element('textarea', 'build-draft');
  const editorStatus = element('p', 'build-editor-status');
  const problemsHeading = element('h3', 'build-problems-title');
  const problemsList = element('ol', 'build-problems');
  const inspector = element('aside', 'build-inspector');
  const inspectorContent = element('div', 'build-inspector-content');

  explorer.dataset.testid = 'build-explorer';
  explorerTitle.textContent = 'Content';
  explorerHeader.append(explorerTitle);
  explorer.append(explorerHeader, explorerList);
  explorer.setAttribute('aria-label', 'Content explorer');
  editor.dataset.testid = 'build-editor';
  editor.setAttribute('aria-label', 'Draft editor');
  applyEdit.dataset.testid = 'build-apply-edit';
  applyEdit.title = 'Record the editor text as an undoable edit of this draft';
  revertEdit.dataset.testid = 'build-revert-edit';
  revertEdit.title = 'Discard editor text and show the current draft';
  undo.dataset.testid = 'build-undo';
  redo.dataset.testid = 'build-redo';
  runRevision.dataset.testid = 'build-run-revision';
  runRevision.title =
    'Prepare every draft through the ordinary boundary and start a new simulation from it';
  textarea.dataset.testid = 'build-draft';
  textarea.spellcheck = false;
  textarea.setAttribute('aria-label', 'Draft JSON');
  textarea.wrap = 'off';
  editorStatus.dataset.testid = 'build-editor-status';
  editorStatus.setAttribute('aria-live', 'polite');
  problemsList.dataset.testid = 'build-problems';
  inspector.dataset.testid = 'build-inspector';
  inspector.setAttribute('aria-label', 'Document inspector');
  inspector.append(inspectorContent);
  toolbar.append(editorTitle, editorMeta, applyEdit, revertEdit, undo, redo, runRevision);
  editor.append(toolbar, textarea, editorStatus, problemsHeading, problemsList);

  let renderedDocumentId: string | null = null;
  let renderedDraftText = '';
  let current: BuildWorkspace | null = null;

  const selectedDocument = (): AuthoringDocument | null =>
    current?.graph.documents.find(document => document.id === current?.selectedDocumentId) ?? null;

  const editorDirty = (): boolean => textarea.value !== renderedDraftText;

  const reportViewport = (): void => {
    handlers.onViewport({
      scrollTop: textarea.scrollTop,
      selectionEnd: textarea.selectionEnd,
      selectionStart: textarea.selectionStart,
    });
  };

  explorerList.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const control = target.closest<HTMLElement>('[data-document-id]');
    if (control?.dataset.documentId !== undefined) {
      handlers.onSelectDocument(control.dataset.documentId);
    }
  });
  inspectorContent.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const reference = target.closest<HTMLElement>('[data-document-id]');
    if (reference?.dataset.documentId !== undefined) {
      handlers.onSelectDocument(reference.dataset.documentId);
      return;
    }
    const problem = target.closest<HTMLElement>('[data-problem-path]');
    if (problem?.dataset.problemPath !== undefined)
      handlers.onSelectPath(problem.dataset.problemPath);
  });
  problemsList.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const problem = target.closest<HTMLElement>('[data-problem-path]');
    if (problem?.dataset.problemPath === undefined) return;
    if (
      problem.dataset.problemDocument !== undefined &&
      problem.dataset.problemDocument !== current?.selectedDocumentId
    ) {
      handlers.onSelectDocument(problem.dataset.problemDocument);
    }
    handlers.onSelectPath(problem.dataset.problemPath);
  });
  applyEdit.addEventListener('click', () => {
    const document = selectedDocument();
    if (document === null) return;
    let draft: unknown;
    try {
      draft = JSON.parse(textarea.value);
    } catch (error) {
      editorStatus.textContent = `Draft is not valid JSON: ${error instanceof Error ? error.message : String(error)}`;
      editorStatus.dataset.tone = 'error';
      return;
    }
    if (JSON.stringify(draft) === JSON.stringify(document.draft)) {
      editorStatus.textContent = 'Editor text matches the current draft; nothing to record.';
      editorStatus.dataset.tone = 'muted';
      textarea.value = renderedDraftText;
      return;
    }
    handlers.onEdit(document.id, draft, `Edit ${document.id}`);
  });
  revertEdit.addEventListener('click', () => {
    textarea.value = renderedDraftText;
    editorStatus.textContent = 'Editor text reverted to the current draft.';
    editorStatus.dataset.tone = 'muted';
    reportViewport();
  });
  undo.addEventListener('click', () => handlers.onUndo());
  redo.addEventListener('click', () => handlers.onRedo());
  runRevision.addEventListener('click', () => {
    if (editorDirty()) {
      editorStatus.textContent = 'Apply or revert the editor text before running a revision.';
      editorStatus.dataset.tone = 'error';
      return;
    }
    handlers.onRunRevision();
  });
  for (const type of ['scroll', 'select', 'keyup', 'mouseup', 'blur']) {
    textarea.addEventListener(type, reportViewport);
  }
  textarea.addEventListener('input', () => {
    editorStatus.textContent = editorDirty()
      ? 'Editor text differs from the draft; apply it to record an edit.'
      : '';
    editorStatus.dataset.tone = 'muted';
  });

  function renderExplorer(workspace: BuildWorkspace): void {
    const groups = new Map<string, AuthoringDocument[]>();
    for (const document of workspace.graph.documents) {
      const list = groups.get(document.kind) ?? [];
      list.push(document);
      groups.set(document.kind, list);
    }
    const sections = [...groups.entries()]
      .toSorted(([left], [right]) => kindRank(left) - kindRank(right) || left.localeCompare(right))
      .map(([kind, documents]) => {
        const section = element('section', 'build-explorer-group');
        const heading = element('h3');
        const list = element('ul');
        heading.textContent = `${KIND_LABELS[kind] ?? kind} (${documents.length})`;
        for (const document of documents.toSorted((left, right) =>
          documentLabel(left).localeCompare(documentLabel(right)),
        )) {
          const item = element('li');
          const control = button('', 'build-document');
          const label = element('span', 'build-document-label');
          const meta = element('small', 'build-document-meta');
          control.dataset.documentId = document.id;
          control.dataset.testid = `build-document-${document.id}`;
          control.classList.toggle('selected', document.id === workspace.selectedDocumentId);
          control.setAttribute(
            'aria-current',
            document.id === workspace.selectedDocumentId ? 'true' : 'false',
          );
          label.textContent = documentLabel(document);
          meta.textContent = `${document.id}${document.dirty ? ' / edited' : ''}${document.diagnostics.length > 0 ? ` / ${document.diagnostics.length} problem${document.diagnostics.length === 1 ? '' : 's'}` : ''}`;
          control.append(label, meta);
          item.append(control);
          list.append(item);
        }
        section.append(heading, list);
        return section;
      });
    morphChildren(explorerList, sections);
  }

  function renderEditor(workspace: BuildWorkspace): void {
    const document = selectedDocument();
    if (document === null) return;
    const draftText = formatDraft(document.draft);
    const documentChanged = renderedDocumentId !== document.id;
    const focused = activeDocumentElement() === textarea;
    if (
      documentChanged ||
      (!focused && !editorDirty()) ||
      (renderedDraftText !== draftText && !editorDirty())
    ) {
      if (textarea.value !== draftText) textarea.value = draftText;
      if (documentChanged) {
        textarea.scrollTop = workspace.viewport.scrollTop;
        textarea.setSelectionRange(
          workspace.viewport.selectionStart,
          workspace.viewport.selectionEnd,
        );
        editorStatus.textContent = '';
        editorStatus.dataset.tone = 'muted';
      }
    }
    renderedDocumentId = document.id;
    renderedDraftText = draftText;
    if (!editorDirty() && editorStatus.dataset.tone !== 'error') editorStatus.textContent = '';
    textarea.dataset.documentId = document.id;
    editorTitle.textContent = documentLabel(document);
    const pending = buildRevisionPending(workspace);
    editorMeta.textContent = `${document.kind} / ${document.id}${document.dirty ? ' / edited' : ''} / ${pending ? 'revision pending' : 'running applied revision'}`;
    editorMeta.dataset.pending = String(pending);
    undo.disabled = workspace.graph.undoStack.length === 0;
    redo.disabled = workspace.graph.redoStack.length === 0;
    undo.title =
      workspace.graph.undoStack.at(-1)?.label === undefined
        ? 'Nothing to undo'
        : `Undo ${workspace.graph.undoStack.at(-1)?.label}`;
    redo.title =
      workspace.graph.redoStack.at(-1)?.label === undefined
        ? 'Nothing to redo'
        : `Redo ${workspace.graph.redoStack.at(-1)?.label}`;
    const problems = buildProblems(workspace);
    problemsHeading.textContent = `Problems (${problems.length})`;
    morphChildren(
      problemsList,
      problems.map(problem => problemItem(problem, true)),
    );
    if (workspace.selectedPath !== null && !focused) {
      const needle = workspace.selectedPath
        .split(/[.[\]]/)
        .filter(Boolean)
        .at(-1);
      const index = needle === undefined ? -1 : textarea.value.indexOf(`"${needle}"`);
      if (needle !== undefined && index >= 0) {
        textarea.setSelectionRange(index, index + needle.length + 2);
      }
    }
  }

  function renderInspector(workspace: BuildWorkspace): void {
    const document = selectedDocument();
    if (document === null) return;
    const hero = element('section', 'character-hero');
    const title = element('h2');
    const summary = element('p', 'character-summary');
    title.textContent = documentLabel(document);
    summary.textContent = `${KIND_LABELS[document.kind] ?? document.kind} document`;
    hero.append(title, summary);

    const details = element('section', 'inspector-section');
    const detailsHeading = element('div', 'section-heading');
    const detailsTitle = element('h3');
    const grid = element('dl', 'definition-grid');
    detailsTitle.textContent = 'Document';
    detailsHeading.append(detailsTitle);
    for (const [term, value] of [
      ['Identity', document.id],
      ['Source', document.provenance.source],
      ['State', document.dirty ? 'Edited since load' : 'Matches loaded baseline'],
      ['Project', buildDirty(workspace) ? 'Has unsaved edits' : 'Clean'],
      [
        'History',
        `${workspace.graph.undoStack.length} undoable / ${workspace.graph.redoStack.length} redoable`,
      ],
      [
        'Applied revision',
        workspace.appliedDigest === null ? 'None' : workspace.appliedDigest.slice(0, 16),
      ],
    ] as const) {
      const dt = element('dt');
      const dd = element('dd');
      dt.textContent = term;
      dd.textContent = value;
      grid.append(dt, dd);
    }
    const detailsBody = element('div', 'section-body');
    detailsBody.append(grid);
    details.append(detailsHeading, detailsBody);

    const referenceSection = (label: string, ids: readonly string[]): HTMLElement => {
      const section = element('section', 'inspector-section');
      const heading = element('div', 'section-heading');
      const headingTitle = element('h3');
      const body = element('div', 'section-body');
      headingTitle.textContent = `${label} (${ids.length})`;
      heading.append(headingTitle);
      if (ids.length === 0) {
        const empty = element('p', 'empty-copy');
        empty.textContent = `No ${label.toLowerCase()}.`;
        body.append(empty);
      } else {
        const list = element('ul', 'build-reference-list');
        for (const id of ids) {
          const item = element('li');
          const control = button(id, 'build-reference');
          control.dataset.documentId = id;
          item.append(control);
          list.append(item);
        }
        body.append(list);
      }
      section.append(heading, body);
      return section;
    };

    const problemSection = element('section', 'inspector-section');
    const problemHeading = element('div', 'section-heading');
    const problemTitle = element('h3');
    const problemBody = element('div', 'section-body');
    const documentProblems = buildProblems(workspace).filter(
      problem => problem.documentId === document.id,
    );
    problemTitle.textContent = `Problems (${documentProblems.length})`;
    problemHeading.append(problemTitle);
    if (documentProblems.length === 0) {
      const empty = element('p', 'empty-copy');
      empty.textContent = 'No problems in this document.';
      problemBody.append(empty);
    } else {
      const list = element('ol', 'build-problems');
      list.append(...documentProblems.map(problem => problemItem(problem, false)));
      problemBody.append(list);
    }
    problemSection.append(problemHeading, problemBody);

    morphChildren(inspectorContent, [
      hero,
      details,
      referenceSection('Outgoing references', document.outgoing),
      referenceSection('Incoming references', document.incoming),
      problemSection,
    ]);
  }

  return {
    editor,
    explorer,
    inspector,
    render(workspace) {
      current = workspace;
      renderExplorer(workspace);
      renderEditor(workspace);
      renderInspector(workspace);
    },
  };
}
