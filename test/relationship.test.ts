import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { characters, environments } from './fixtures.js';
import scenario from '../content/scenarios/relationship-momentum.json';
import {
  advanceSimulation,
  createSimulation,
  createSimulationFromSnapshot,
  parseScenario,
  serializeSnapshot,
  turnDyad,
  type DyadState,
} from '../src/index.js';

function createRelationshipSimulation(input: unknown = scenario) {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario: input,
  });
}

function dyadFor(
  state: ReturnType<typeof createRelationshipSimulation>,
  observerId: string,
  subjectId: string,
): DyadState {
  const dyad = state.dyads.find(
    candidate => candidate.observerId === observerId && candidate.subjectId === subjectId,
  );
  assert.ok(dyad);
  return dyad;
}

describe('relationship momentum and consolidation', () => {
  it('keeps abrasiveness and high estimated empathy independent', () => {
    const state = createRelationshipSimulation();
    const dyad = dyadFor(state, 'responder', 'abrasive');

    assert.ok(dyad.stance < 0);
    assert.ok(dyad.estimatedEmpathy > 0.8);
    assert.equal(dyad.mode, 'contesting');
  });

  it('lets graduated asks move stance where one aggregate ask is refused', () => {
    const graduated = advanceSimulation(createRelationshipSimulation(), 3);
    assert.deepEqual(
      graduated.relationshipDecisions.map(decision => decision.outcome),
      ['accepted', 'accepted', 'accepted'],
    );

    const authored = parseScenario(scenario);
    const aggregateRequest = authored.relationshipRequests[0];
    assert.ok(aggregateRequest);
    const aggregate = advanceSimulation(
      createRelationshipSimulation({
        ...authored,
        relationshipRequests: [
          {
            ...aggregateRequest,
            id: 'aggregate-request',
            magnitude: 1,
          },
        ],
      }),
      3,
    );

    assert.equal(aggregate.relationshipDecisions[0]?.outcome, 'refused');
    assert.ok(
      dyadFor(graduated, 'responder', 'requester').stance >
        dyadFor(aggregate, 'responder', 'requester').stance,
    );
  });

  it('collapses stance faster on rupture than it accrues on an equal positive turn', () => {
    const base = dyadFor(createRelationshipSimulation(), 'responder', 'requester');
    const positive = turnDyad(base, 0.5);
    const negative = turnDyad(base, -0.5);

    assert.ok(Math.abs(negative.stance - base.stance) > positive.stance - base.stance);
    assert.ok(negative.integratedHistory < base.integratedHistory);
    assert.ok(positive.integratedHistory > base.integratedHistory);
  });

  it('re-prices every prior disclosure when estimated regard falls', () => {
    const initial = createRelationshipSimulation();
    const before = dyadFor(initial, 'requester', 'abrasive');
    const resolved = advanceSimulation(initial, 4);
    const after = dyadFor(resolved, 'requester', 'abrasive');

    assert.equal(resolved.observations.at(-1)?.outcome, 'corrected');
    assert.ok(after.estimatedEmpathy < before.estimatedEmpathy);
    assert.ok(after.exposureDebt > before.exposureDebt);
    assert.ok(
      resolved.trace.entries.some(
        entry =>
          entry.kind === 'relationship' &&
          entry.terms.some(term => term.id === 'new-exposure-debt'),
      ),
    );
  });

  it('uses hysteresis when leaving warm and ruptured dyad modes', () => {
    const base = dyadFor(createRelationshipSimulation(), 'responder', 'requester');
    const warm = { ...base, mode: 'warm' as const, stance: 0.56 };
    const cooled = turnDyad(warm, -0.2);
    const ruptured = { ...base, mode: 'ruptured' as const, stance: -0.76 };
    const partialRepair = turnDyad(ruptured, 0.4);

    assert.equal(cooled.mode, 'warm');
    assert.equal(partialRepair.mode, 'ruptured');
  });

  it('collapses relationship episodes during sleep while semantic stance persists', () => {
    const afterRequests = advanceSimulation(createRelationshipSimulation(), 6);
    const stance = dyadFor(afterRequests, 'responder', 'requester').stance;
    const responderBefore = afterRequests.agents.find(agent => agent.id === 'responder');
    assert.ok(responderBefore?.memories.some(memory => memory.type === 'relationship'));

    const consolidated = advanceSimulation(afterRequests, 720);
    const responderAfter = consolidated.agents.find(agent => agent.id === 'responder');
    assert.ok(responderAfter);
    assert.equal(
      responderAfter.memories.filter(memory => memory.type === 'relationship').length,
      0,
    );
    assert.equal(dyadFor(consolidated, 'responder', 'requester').stance, stance);
    assert.ok(
      consolidated.trace.entries.some(
        entry => entry.kind === 'relationship' && entry.id.includes('memory-consolidation'),
      ),
    );
  });

  it('resumes and replays relational state exactly from a snapshot', () => {
    const paused = advanceSimulation(createRelationshipSimulation(), 4);
    const resumed = createSimulationFromSnapshot({
      characterLibrary: characters,
      environmentLibrary: environments,
      snapshot: serializeSnapshot(paused),
    });
    const continuous = advanceSimulation(paused, 62);
    const replayed = advanceSimulation(resumed, 62);

    assert.deepEqual(serializeSnapshot(replayed), serializeSnapshot(continuous));
  });
});
