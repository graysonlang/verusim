import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  insertDraftEntry,
  moveDraftEntry,
  removeDraftEntry,
  setDraftValue,
} from '../app/editing/edits.js';
import {
  fieldValueFromInput,
  formSpecFor,
  inputValueForField,
  joinFieldPath,
  specFields,
} from '../app/editing/forms.js';
import {
  addressFromDocumentId,
  documentIdFromAddress,
  draftPathFromDiagnostic,
  formatPath,
  getAtPath,
  insertAtPath,
  parsePath,
  pathStartsWith,
  removeAtPath,
  setAtPath,
} from '../app/editing/paths.js';
import { BUILT_IN_SCENARIOS } from '../app/scenarios.js';
import {
  buildProblems,
  createBuildWorkspace,
  prepareBuildRevision,
  undoBuildEdit,
} from '../app/workspace.js';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import { canonicalJson, documentById, startRevision } from '../src/index.js';

function pottsfield() {
  const entry = BUILT_IN_SCENARIOS.find(candidate => candidate.id === 'pottsfield');
  assert.ok(entry);
  return createBuildWorkspace({
    resources: BUILT_IN_RESOURCES,
    scenario: entry.scenario,
    source: 'content/scenarios/pottsfield.json',
  });
}

function documentOfKind(workspace: ReturnType<typeof pottsfield>, kind: string, id?: string) {
  const document = workspace.graph.documents.find(
    candidate => candidate.kind === kind && (id === undefined || candidate.id === id),
  );
  assert.ok(document, `${kind} document`);
  return document;
}

describe('draft paths', () => {
  it('parses, formats, reads, and writes dot and index paths immutably', () => {
    assert.deepEqual(parsePath('characters[0].position.x'), ['characters', 0, 'position', 'x']);
    assert.equal(formatPath(['layout', 'locations', 2, 'name']), 'layout.locations[2].name');
    const draft = { characters: [{ position: { x: 1, y: 2 } }], title: 't' };
    assert.equal(getAtPath(draft, 'characters[0].position.y'), 2);
    const next = setAtPath(draft, 'characters[0].position.x', 5);
    assert.equal(getAtPath(next, 'characters[0].position.x'), 5);
    assert.equal(draft.characters[0]?.position.x, 1, 'the original is untouched');
    assert.equal(next.title, draft.title);
    const removed = removeAtPath(next, 'characters[0]');
    assert.deepEqual(removed.characters, []);
    const inserted = insertAtPath(removed, 'characters', { position: { x: 0, y: 0 } });
    assert.equal(inserted.characters.length, 1);
    const created = setAtPath({}, 'ambientTurnsPerHour.safety', 0.1);
    assert.deepEqual(created, { ambientTurnsPerHour: { safety: 0.1 } });
    assert.equal(pathStartsWith('characters[0].schedule[1]', 'characters[0]'), true);
    assert.equal(pathStartsWith('characters[10]', 'characters[1]'), false);
  });

  it('maps diagnostic paths onto draft paths and round-trips addresses', () => {
    assert.equal(
      draftPathFromDiagnostic('scenario', 'scenario.characters[0].tier'),
      'characters[0].tier',
    );
    assert.equal(draftPathFromDiagnostic('norm', 'resource.norm.label'), 'norm.label');
    assert.equal(draftPathFromDiagnostic('scenario', 'scenario'), '');
    assert.equal(draftPathFromDiagnostic('norm', 'verusim:norm:x'), null);
    const address = {
      kind: 'norm',
      packageId: 'verusim',
      resourceId: 'pottsfield-harvest-observance',
    };
    assert.equal(documentIdFromAddress(address), 'verusim:norm:pottsfield-harvest-observance');
    assert.deepEqual(addressFromDocumentId('verusim:norm:pottsfield-harvest-observance'), address);
    assert.equal(addressFromDocumentId('nonsense'), null);
  });
});

describe('form specifications', () => {
  it('address existing draft values in every document kind', () => {
    const workspace = pottsfield();
    const kinds = [
      'scenario',
      'character-profile',
      'environment-layout',
      'norm',
      'social-contract',
    ];
    for (const kind of kinds) {
      const document = documentOfKind(workspace, kind);
      const spec = formSpecFor(document, workspace.graph);
      assert.ok(spec.groups.length > 0, `${kind} has groups`);
      const required = specFields(spec, document.draft).filter(
        entry => entry.field.optional !== true,
      );
      assert.ok(required.length > 0, `${kind} has fields`);
      const missing = required.filter(entry => getAtPath(document.draft, entry.path) === undefined);
      assert.deepEqual(
        missing.map(entry => entry.path),
        [],
        `${kind}: every required spec field exists in the draft`,
      );
    }
  });

  it('offer environment layers and locations to scenario placements and documents to references', () => {
    const workspace = pottsfield();
    const scenario = documentById(workspace.graph, workspace.scenarioDocumentId);
    const spec = formSpecFor(scenario, workspace.graph);
    const characters = spec.lists.find(list => list.path === 'characters');
    assert.ok(characters);
    const layer = characters.groups[0]?.fields.find(field => field.path === 'position.layerId');
    const location = characters.lists?.[0]?.groups[0]?.fields.find(
      field => field.path === 'locationId',
    );
    assert.ok(layer?.options && layer.options.length > 0);
    assert.ok(location?.options?.some(option => option.value === 'market-square'));
    const environment = spec.groups[0]?.fields.find(field => field.path === 'environment');
    assert.equal(environment?.kind, 'reference');
    assert.ok(environment?.options?.some(option => option.value.includes('environment-layout')));
    assert.equal(
      inputValueForField(environment, getAtPath(scenario.draft, 'environment')),
      'verusim:environment-layout:alders-edge',
    );
    assert.deepEqual(fieldValueFromInput(environment, 'verusim:environment-layout:alders-edge'), {
      remove: false,
      value: { kind: 'environment-layout', packageId: 'verusim', resourceId: 'alders-edge' },
    });
    assert.deepEqual(
      fieldValueFromInput({ kind: 'number', label: '', optional: true, path: '' }, ''),
      {
        remove: true,
        value: undefined,
      },
    );
    assert.deepEqual(fieldValueFromInput({ kind: 'integer', label: '', path: '' }, '2.7'), {
      remove: false,
      value: 3,
    });
    assert.equal(joinFieldPath('characters[0]', 'position.x'), 'characters[0].position.x');
  });
});

describe('field edits over the workspace', () => {
  it('author a representative field in every kind, prepare, run, and undo byte-for-byte', () => {
    let workspace = pottsfield();
    const before = canonicalJson(workspace.graph.documents.map(document => document.draft));
    const placedProfile = getAtPath(
      documentById(workspace.graph, workspace.scenarioDocumentId).draft,
      'characters[0].profile',
    ) as { kind: string; packageId: string; resourceId: string };
    const profile = documentOfKind(
      workspace,
      'character-profile',
      documentIdFromAddress(placedProfile),
    );
    const layout = documentOfKind(
      workspace,
      'environment-layout',
      'verusim:environment-layout:alders-edge',
    );
    const norm = documentOfKind(workspace, 'norm', 'verusim:norm:pottsfield-harvest-observance');
    const contract = documentOfKind(
      workspace,
      'social-contract',
      'verusim:social-contract:pottsfield-harvest-customs',
    );
    const scenarioId = workspace.scenarioDocumentId;

    workspace = setDraftValue(workspace, profile.id, 'profile.physical.ageYears', 44, 'Age');
    workspace = setDraftValue(workspace, profile.id, 'profile.name', 'Renamed Farmer', 'Name');
    workspace = setDraftValue(workspace, layout.id, 'layout.locations[0].x', 12.5, 'Move location');
    workspace = setDraftValue(
      workspace,
      norm.id,
      'norm.interpretations[0].identityStake',
      0.9,
      'Stake',
    );
    workspace = setDraftValue(
      workspace,
      scenarioId,
      'characters[0].schedule[0].activity',
      'Mending nets',
      'Activity',
    );
    workspace = setDraftValue(
      workspace,
      scenarioId,
      'environmentConditions.weather',
      'rain',
      'Weather',
    );
    const otherNorm = workspace.graph.documents.find(
      document => document.kind === 'norm' && document.id !== norm.id,
    );
    assert.ok(otherNorm);
    workspace = insertDraftEntry(
      workspace,
      contract.id,
      'contract.norms',
      addressFromDocumentId(otherNorm.id),
      'Compose norm',
    );
    assert.equal(workspace.graph.undoStack.length, 7);
    assert.deepEqual(buildProblems(workspace), []);
    assert.ok(documentById(workspace.graph, contract.id).outgoing.includes(otherNorm.id));

    const result = prepareBuildRevision(workspace);
    assert.ok('revision' in result, 'the edited project still prepares');
    const running = startRevision(result.revision);
    assert.equal(running.state.scenario.environmentConditions.weather, 'rain');
    assert.equal(running.state.scenario.characters[0]?.schedule[0]?.activity, 'Mending nets');
    assert.equal(running.state.environment.locations[0]?.x, 12.5);
    assert.equal(
      running.state.characters.find(
        character => character.profile.profileId === profile.id.split(':').at(-1),
      )?.profile.physical.ageYears,
      44,
    );

    let undone = result.workspace;
    for (let step = 0; step < 7; step += 1) undone = undoBuildEdit(undone);
    assert.equal(canonicalJson(undone.graph.documents.map(document => document.draft)), before);
    assert.equal(documentById(undone.graph, contract.id).outgoing.includes(otherNorm.id), false);
  });

  it('report a broken field at the path the form owns and remove, insert, and move entries', () => {
    let workspace = pottsfield();
    const scenarioId = workspace.scenarioDocumentId;
    workspace = setDraftValue(
      workspace,
      scenarioId,
      'characters[0].tier',
      'legendary',
      'Break tier',
    );
    const problem = buildProblems(workspace).find(candidate => candidate.documentId === scenarioId);
    assert.ok(problem);
    const draftPath = draftPathFromDiagnostic('scenario', problem.path);
    assert.equal(draftPath, 'characters[0].tier');
    const spec = formSpecFor(documentById(workspace.graph, scenarioId), workspace.graph);
    assert.ok(
      specFields(spec, documentById(workspace.graph, scenarioId).draft).some(
        entry => entry.path === draftPath,
      ),
    );

    workspace = undoBuildEdit(workspace);
    const facts = getAtPath(documentById(workspace.graph, scenarioId).draft, 'worldFacts');
    const count = Array.isArray(facts) ? facts.length : 0;
    workspace = insertDraftEntry(
      workspace,
      scenarioId,
      'worldFacts',
      { amount: 3, id: 'tally' },
      'Add fact',
    );
    workspace = insertDraftEntry(
      workspace,
      scenarioId,
      'worldFacts',
      { amount: 1, id: 'first' },
      'Add fact',
      0,
    );
    let list = getAtPath(documentById(workspace.graph, scenarioId).draft, 'worldFacts') as {
      id: string;
    }[];
    assert.equal(list.length, count + 2);
    assert.equal(list[0]?.id, 'first');
    workspace = moveDraftEntry(
      workspace,
      scenarioId,
      'worldFacts',
      0,
      list.length - 1,
      'Move fact',
    );
    list = getAtPath(documentById(workspace.graph, scenarioId).draft, 'worldFacts') as {
      id: string;
    }[];
    assert.equal(list.at(-1)?.id, 'first');
    workspace = removeDraftEntry(
      workspace,
      scenarioId,
      `worldFacts[${list.length - 1}]`,
      'Remove fact',
    );
    list = getAtPath(documentById(workspace.graph, scenarioId).draft, 'worldFacts') as {
      id: string;
    }[];
    assert.equal(
      list.some(fact => fact.id === 'first'),
      false,
    );
    assert.equal(setDraftValue(workspace, scenarioId, 'title', 'Pottsfield', 'Same'), workspace);
    assert.ok('revision' in prepareBuildRevision(workspace));
  });
});
