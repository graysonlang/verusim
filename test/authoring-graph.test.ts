import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import { BUILT_IN_SCENARIOS } from '../app/scenarios.js';
import {
  applyTransaction,
  createAuthoringGraph,
  documentById,
  redoTransaction,
  relocateDocument,
  scenarioDocumentId,
  undoTransaction,
  type AuthoringGraph,
} from '../src/index.js';

const NORM_KIND = ':norm:';
const CONTRACT_ID = 'verusim:social-contract:pottsfield-harvest-customs';
const MARKET_NORM_ID = 'verusim:norm:pottsfield-market-courtesy';
const HARVEST_NORM_ID = 'verusim:norm:pottsfield-harvest-observance';

function separateDocumentProject(): AuthoringGraph {
  const pottsfield = BUILT_IN_SCENARIOS.find(entry => entry.id === 'pottsfield');
  assert.ok(pottsfield);
  return createAuthoringGraph([
    ...BUILT_IN_RESOURCES,
    { source: 'content/scenarios/pottsfield.json', value: pottsfield.scenario },
  ]);
}

function documentsWithoutProvenance(graph: AuthoringGraph) {
  return graph.documents.map(({ provenance, ...rest }) => {
    void provenance;
    return rest;
  });
}

describe('authoring graph', () => {
  it('keys documents by semantic identity with provenance and reference indexes', () => {
    const graph = separateDocumentProject();
    const scenario = documentById(graph, scenarioDocumentId('pottsfield'));
    assert.equal(scenario.kind, 'scenario');
    assert.equal(scenario.provenance.source, 'content/scenarios/pottsfield.json');
    assert.equal(scenario.dirty, false);
    assert.deepEqual(scenario.diagnostics, []);
    assert.ok(scenario.outgoing.some(id => id.includes(':environment-layout:')));
    assert.ok(scenario.outgoing.some(id => id.includes(':character-profile:')));
    assert.ok(scenario.outgoing.includes(CONTRACT_ID));

    const contract = documentById(graph, CONTRACT_ID);
    assert.deepEqual(contract.outgoing, [HARVEST_NORM_ID]);
    assert.ok(contract.incoming.includes(scenario.id));
    const norm = documentById(graph, HARVEST_NORM_ID);
    assert.ok(norm.incoming.includes(CONTRACT_ID));
    assert.ok(graph.documents.every(document => document.diagnostics.length === 0));
  });

  it('rejects two documents that share one semantic identity', () => {
    const norm = BUILT_IN_RESOURCES.find(resource =>
      resource.source.endsWith('/market-courtesy.json'),
    );
    assert.ok(norm);
    assert.throws(
      () => createAuthoringGraph([norm, { ...norm, source: 'elsewhere/copy.json' }]),
      /elsewhere\/copy\.json: duplicate document identity/,
    );
  });

  it('survives provenance-only relocation without changing identity or references', () => {
    const graph = separateDocumentProject();
    const relocated = relocateDocument(graph, CONTRACT_ID, 'packs/customs/market.json');
    assert.equal(
      documentById(relocated, CONTRACT_ID).provenance.source,
      'packs/customs/market.json',
    );
    assert.deepEqual(documentsWithoutProvenance(relocated), documentsWithoutProvenance(graph));
    assert.throws(() => relocateDocument(graph, 'verusim:norm:missing', 'x.json'), /Unknown/);
  });

  it('round-trips a multi-document reference edit through undo and redo', () => {
    const graph = separateDocumentProject();
    const contractDraft = structuredClone(documentById(graph, CONTRACT_ID).draft) as {
      contract: { norms: unknown[] };
    };
    contractDraft.contract.norms = [
      { kind: 'norm', packageId: 'verusim', resourceId: 'pottsfield-market-courtesy' },
    ];
    const normDraft = structuredClone(documentById(graph, MARKET_NORM_ID).draft) as {
      norm: { label: string };
    };
    normDraft.norm.label = 'Market courtesy, renamed in the same transaction';

    const edited = applyTransaction(graph, {
      edits: [
        { documentId: CONTRACT_ID, draft: contractDraft },
        { documentId: MARKET_NORM_ID, draft: normDraft },
      ],
      label: 'repoint harvest customs at market courtesy',
    });
    assert.deepEqual(documentById(edited, CONTRACT_ID).outgoing, [MARKET_NORM_ID]);
    assert.ok(documentById(edited, MARKET_NORM_ID).incoming.includes(CONTRACT_ID));
    assert.ok(!documentById(edited, HARVEST_NORM_ID).incoming.includes(CONTRACT_ID));
    assert.equal(documentById(edited, CONTRACT_ID).dirty, true);
    assert.equal(documentById(edited, MARKET_NORM_ID).dirty, true);
    assert.ok(edited.documents.every(document => document.diagnostics.length === 0));
    assert.equal(edited.undoStack.length, 1);

    const undone = undoTransaction(edited);
    assert.equal(JSON.stringify(undone.documents), JSON.stringify(graph.documents));
    assert.equal(undone.redoStack.length, 1);
    const redone = redoTransaction(undone);
    assert.equal(JSON.stringify(redone.documents), JSON.stringify(edited.documents));
    assert.equal(undoTransaction(graph), graph);
    assert.equal(redoTransaction(graph), graph);
  });

  it('round-trips an environment-geometry edit byte-equivalently', () => {
    const graph = separateDocumentProject();
    const scenario = documentById(graph, scenarioDocumentId('pottsfield'));
    const environmentId = scenario.outgoing.find(id => id.includes(':environment-layout:'));
    assert.ok(environmentId);
    const draft = structuredClone(documentById(graph, environmentId).draft) as {
      layout: { areas: { width: number }[] };
    };
    const area = draft.layout.areas[0];
    assert.ok(area);
    area.width += 12;

    const edited = applyTransaction(graph, {
      edits: [{ documentId: environmentId, draft }],
      label: 'widen the first area',
    });
    assert.equal(documentById(edited, environmentId).dirty, true);
    assert.deepEqual(documentById(edited, environmentId).diagnostics, []);
    assert.notEqual(
      JSON.stringify(documentById(edited, environmentId).draft),
      JSON.stringify(documentById(graph, environmentId).draft),
    );
    const undone = undoTransaction(edited);
    assert.equal(documentById(undone, environmentId).dirty, false);
    assert.equal(JSON.stringify(undone.documents), JSON.stringify(graph.documents));
    assert.equal(
      JSON.stringify(redoTransaction(undone).documents),
      JSON.stringify(edited.documents),
    );
  });

  it('reports validation, identity, and unresolved-reference diagnostics at authored paths', () => {
    const graph = separateDocumentProject();
    const scenarioId = scenarioDocumentId('pottsfield');
    const badScenario = structuredClone(documentById(graph, scenarioId).draft) as Record<
      string,
      unknown
    >;
    badScenario.tickMinutes = 0;
    const badContract = structuredClone(documentById(graph, CONTRACT_ID).draft) as {
      contract: { norms: unknown[] };
    };
    badContract.contract.norms = [{ kind: 'norm', packageId: 'verusim', resourceId: 'absent' }];
    const edited = applyTransaction(graph, {
      edits: [
        { documentId: scenarioId, draft: badScenario },
        { documentId: CONTRACT_ID, draft: badContract },
      ],
      label: 'introduce two problems',
    });
    assert.ok(
      documentById(edited, scenarioId).diagnostics.some(d => d.path === 'scenario.tickMinutes'),
    );
    assert.ok(
      documentById(edited, CONTRACT_ID).diagnostics.some(d =>
        d.message.includes(`unresolved reference "verusim${NORM_KIND}absent"`),
      ),
    );
    const renamed = structuredClone(documentById(graph, MARKET_NORM_ID).draft) as {
      address: { resourceId: string };
    };
    renamed.address.resourceId = 'renamed';
    const withRename = applyTransaction(graph, {
      edits: [{ documentId: MARKET_NORM_ID, draft: renamed }],
      label: 'rename in place',
    });
    assert.ok(
      documentById(withRename, MARKET_NORM_ID).diagnostics.some(d =>
        d.message.includes('draft identity'),
      ),
    );
    assert.equal(
      JSON.stringify(undoTransaction(edited).documents),
      JSON.stringify(graph.documents),
    );
    assert.throws(
      () => applyTransaction(graph, { edits: [{ documentId: 'nope', draft: {} }], label: 'x' }),
      /Unknown authoring document/,
    );
  });
});
