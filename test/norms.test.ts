import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUILT_IN_RESOURCES } from '../content/catalog.generated.js';
import scenario from '../content/scenarios/pottsfield.json';
import {
  advanceSimulation,
  createResourceCatalog,
  createSimulation,
  createSimulationFromSnapshot,
  parseScenario,
  prepareScenario,
  serializeSnapshot,
  type NormObservationRecord,
  type ObservationRecord,
} from '../src/index.js';

const catalog = createResourceCatalog(BUILT_IN_RESOURCES);

function preparePottsfield(input: unknown = scenario) {
  return prepareScenario({ catalog, scenario: input });
}

function createPottsfieldSimulation(input: unknown = scenario) {
  return createSimulation(preparePottsfield(input));
}

function normRecord(observations: ObservationRecord[], observerId: string): NormObservationRecord {
  const record = observations.find(
    candidate => candidate.eventType === 'norm' && candidate.observerId === observerId,
  );
  assert.ok(record?.eventType === 'norm');
  return record;
}

describe('local norm appraisal', () => {
  it('derives opposite subjective turns for a resident and visitor from one objective event', () => {
    const next = advanceSimulation(createPottsfieldSimulation(), 1);
    const resident = normRecord(next.observations, 'resident');
    const visitor = normRecord(next.observations, 'visitor');
    const residentAgent = next.agents.find(agent => agent.id === 'resident');
    const visitorAgent = next.agents.find(agent => agent.id === 'visitor');
    assert.ok(residentAgent);
    assert.ok(visitorAgent);

    assert.equal(resident.eventId, visitor.eventId);
    assert.deepEqual(resident.baselineTurns, visitor.baselineTurns);
    assert.ok((resident.subjectiveTurns.fairness ?? 0) > 0);
    assert.ok((visitor.subjectiveTurns.fairness ?? 0) < 0);
    assert.ok((resident.subjectiveTurn ?? 0) > (visitor.subjectiveTurn ?? 0));
    assert.ok(residentAgent.values.fairness.charge > 0);
    assert.ok(visitorAgent.values.fairness.charge < 0);
    assert.notEqual(resident.legibilityBand, 'pass');
    assert.equal(visitor.legibilityBand, 'pass');
  });

  it('keeps norm membership separate from whether the norm is legible', () => {
    const legibilitySweep = parseScenario(scenario);
    const resident = legibilitySweep.characters.find(
      placement => placement.instanceId === 'resident',
    );
    const visitor = legibilitySweep.characters.find(
      placement => placement.instanceId === 'visitor',
    );
    assert.ok(resident);
    assert.ok(visitor);
    const residentPerspective = resident.normPerspectives[0];
    const visitorPerspective = visitor.normPerspectives[0];
    assert.ok(residentPerspective);
    assert.ok(visitorPerspective);
    residentPerspective.legibility = 0;
    visitorPerspective.legibility = 1;

    const next = advanceSimulation(createPottsfieldSimulation(legibilitySweep), 1);
    const residentRecord = normRecord(next.observations, 'resident');
    const visitorRecord = normRecord(next.observations, 'visitor');

    assert.equal(residentRecord.legibilityBand, 'pass');
    assert.ok((residentRecord.subjectiveTurn ?? 0) > 0);
    assert.notEqual(visitorRecord.legibilityBand, 'pass');
    assert.ok((visitorRecord.subjectiveTurn ?? 0) < 0);
  });

  it('does not read hostility or social distance into local norm compatibility', () => {
    const baseline = advanceSimulation(createPottsfieldSimulation(), 1);
    const socialSweep = parseScenario(scenario);
    socialSweep.dyads = socialSweep.dyads.map(dyad => ({
      ...dyad,
      estimatedEmpathy: dyad.observerId === 'resident' ? 0 : 1,
      features: {
        category: dyad.observerId === 'resident' ? 0 : 1,
        familiarity: dyad.observerId === 'resident' ? 0 : 1,
        kinship: dyad.observerId === 'resident' ? 0 : 1,
        reciprocity: dyad.observerId === 'resident' ? 0 : 1,
        similarity: dyad.observerId === 'resident' ? 0 : 1,
      },
      mode: dyad.observerId === 'resident' ? 'ruptured' : 'warm',
      stance: dyad.observerId === 'resident' ? -1 : 1,
      suspicion: dyad.observerId === 'resident' ? 1 : 0,
    }));
    const swept = advanceSimulation(createPottsfieldSimulation(socialSweep), 1);

    for (const observerId of ['resident', 'visitor']) {
      assert.deepEqual(
        normRecord(swept.observations, observerId),
        normRecord(baseline.observations, observerId),
      );
    }
  });

  it('does not appraise or turn values when the objective event is missed', () => {
    const missed = parseScenario(scenario);
    const event = missed.observationEvents[0];
    assert.ok(event?.eventType === 'norm');
    event.visualProminence = 0;
    const next = advanceSimulation(createPottsfieldSimulation(missed), 1);

    for (const observerId of ['resident', 'visitor']) {
      const record = normRecord(next.observations, observerId);
      const agent = next.agents.find(candidate => candidate.id === observerId);
      assert.ok(agent);
      assert.equal(record.outcome, 'missed');
      assert.equal(record.subjectiveTurn, null);
      assert.equal(agent.values.fairness.charge, 0);
    }
    assert.equal(next.trace.entries.filter(entry => entry.kind === 'norm-appraisal').length, 0);
  });

  it('resumes local norm observation state and replays exactly', () => {
    const initial = createPottsfieldSimulation();
    const snapshot = serializeSnapshot(initial);
    const resumed = createSimulationFromSnapshot({
      prepared: preparePottsfield(),
      snapshot,
    });
    const continuous = advanceSimulation(initial, 1);
    const replayed = advanceSimulation(resumed, 1);

    assert.deepEqual(serializeSnapshot(replayed), serializeSnapshot(continuous));
  });
});
