import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_SCENARIOS } from '../app/scenarios.js';
import {
  buildDirty,
  buildProblems,
  buildRevisionPending,
  createBuildWorkspace,
  editBuildDocument,
  markBuildApplied,
  prepareBuildRevision,
  redoBuildEdit,
  selectBuildDocument,
  selectBuildPath,
  setBuildViewport,
  toggleWorkbenchMode,
  undoBuildEdit,
} from '../app/workspace.js';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import {
  advanceSimulation,
  documentById,
  prepareRevision,
  serializeSnapshot,
  startRevision,
  type ScenarioFile,
} from '../src/index.js';

function pottsfieldWorkspace() {
  const entry = BUILT_IN_SCENARIOS.find(candidate => candidate.id === 'pottsfield');
  assert.ok(entry);
  return createBuildWorkspace({
    resources: BUILT_IN_RESOURCES,
    scenario: entry.scenario,
    source: 'content/scenarios/pottsfield.json',
  });
}

function scenarioDraft(workspace: ReturnType<typeof pottsfieldWorkspace>): ScenarioFile {
  return structuredClone(
    documentById(workspace.graph, workspace.scenarioDocumentId).draft,
  ) as ScenarioFile;
}

describe('build and simulate workspaces', () => {
  it('loads the project with the scenario selected, clean, and awaiting its first revision', () => {
    const workspace = pottsfieldWorkspace();
    assert.equal(workspace.selectedDocumentId, 'scenario:pottsfield');
    assert.equal(workspace.graph.documents.length, BUILT_IN_RESOURCES.length + 1);
    assert.equal(buildDirty(workspace), false);
    assert.equal(buildRevisionPending(workspace), true);
    assert.deepEqual(buildProblems(workspace), []);
    assert.equal(toggleWorkbenchMode('simulate'), 'build');
    assert.equal(toggleWorkbenchMode('build'), 'simulate');
  });

  it('prepares a revision through the ordinary boundary and tracks what Simulate is running', () => {
    const workspace = pottsfieldWorkspace();
    const result = prepareBuildRevision(workspace);
    assert.ok('revision' in result);
    assert.equal(
      result.revision.digest,
      prepareRevision(workspace.graph, workspace.scenarioDocumentId).digest,
    );
    assert.equal(result.workspace.appliedDigest, result.revision.digest);
    assert.equal(buildRevisionPending(result.workspace), false);
    assert.equal(buildDirty(result.workspace), false);

    const edited = editBuildDocument(
      result.workspace,
      workspace.scenarioDocumentId,
      { ...scenarioDraft(workspace), title: 'Pottsfield, revised' },
      'Retitle scenario',
    );
    assert.equal(buildDirty(edited), true);
    assert.equal(buildRevisionPending(edited), true);
    assert.equal(
      edited.appliedDigest,
      result.revision.digest,
      'editing never touches the applied revision',
    );

    const undone = undoBuildEdit(edited);
    assert.equal(buildDirty(undone), false);
    assert.equal(buildRevisionPending(undone), false, 'undo returns to the applied drafts');
    const redone = redoBuildEdit(undone);
    assert.equal(buildDirty(redone), true);
    assert.deepEqual(
      documentById(redone.graph, workspace.scenarioDocumentId).draft,
      documentById(edited.graph, workspace.scenarioDocumentId).draft,
    );
    assert.equal(undoBuildEdit(workspace), workspace, 'nothing to undo is a no-op');
  });

  it('keeps the running simulation byte-equivalent while drafts change, until a new revision starts', () => {
    const first = prepareBuildRevision(pottsfieldWorkspace());
    assert.ok('revision' in first);
    const running = startRevision(first.revision);
    const before = JSON.stringify(serializeSnapshot(advanceSimulation(running.state, 3)));

    const edited = editBuildDocument(
      first.workspace,
      first.workspace.scenarioDocumentId,
      { ...scenarioDraft(first.workspace), title: 'Pottsfield, revised' },
      'Retitle scenario',
    );
    assert.equal(JSON.stringify(serializeSnapshot(advanceSimulation(running.state, 3))), before);
    assert.equal(running.baseline.scenario.title, 'Pottsfield');

    const second = prepareBuildRevision(edited);
    assert.ok('revision' in second);
    assert.notEqual(second.revision.digest, first.revision.digest);
    assert.equal(startRevision(second.revision).state.scenario.title, 'Pottsfield, revised');
    assert.equal(running.state.scenario.title, 'Pottsfield', 'the earlier simulation is untouched');
  });

  it('reports a failing draft at its authored path without losing drafts, selection, or history', () => {
    const applied = prepareBuildRevision(pottsfieldWorkspace());
    assert.ok('revision' in applied);
    const selected = setBuildViewport(
      selectBuildPath(applied.workspace, 'characters[0].position'),
      { scrollTop: 120, selectionEnd: 40, selectionStart: 12 },
    );
    const broken = editBuildDocument(
      selected,
      selected.scenarioDocumentId,
      { ...scenarioDraft(selected), tickSeconds: 0 },
      'Break tick length',
    );
    const result = prepareBuildRevision(broken);
    assert.ok('problem' in result);
    assert.match(result.problem.path, /tickSeconds/);
    assert.equal(result.workspace.appliedDigest, applied.revision.digest);
    assert.equal(result.workspace.selectedPath, 'characters[0].position');
    assert.deepEqual(result.workspace.viewport, {
      scrollTop: 120,
      selectionEnd: 40,
      selectionStart: 12,
    });
    assert.equal(result.workspace.graph.undoStack.length, 1);
    const listed = buildProblems(result.workspace).filter(
      problem => problem.path === result.problem.path,
    );
    assert.equal(
      listed.length,
      1,
      'the document diagnostic and preparation failure are one problem',
    );
    assert.equal(listed[0]?.message, 'expected a number from 1 through 86400');

    const repaired = prepareBuildRevision(undoBuildEdit(result.workspace));
    assert.ok('revision' in repaired);
    assert.equal(repaired.workspace.preparationProblem, null);
    assert.equal(repaired.revision.digest, applied.revision.digest);
  });

  it('changes selection without touching the graph and marks externally started revisions', () => {
    const workspace = pottsfieldWorkspace();
    const normId = workspace.graph.documents.find(document => document.kind === 'norm')?.id;
    assert.ok(normId);
    const selected = selectBuildDocument(workspace, normId);
    assert.equal(selected.graph, workspace.graph);
    assert.equal(selected.selectedDocumentId, normId);
    assert.equal(selectBuildDocument(selected, normId), selected);
    assert.throws(() => selectBuildDocument(workspace, 'scenario:missing'));

    const marked = markBuildApplied(workspace, 'external-digest');
    assert.equal(marked.appliedDigest, 'external-digest');
    assert.equal(buildRevisionPending(marked), false);
  });
});
