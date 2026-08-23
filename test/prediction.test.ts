import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { environments, mindModelCharacters } from './fixtures.js';
import scenario from '../content/scenarios/endicott-margueritte.json';
import {
  advanceSimulation,
  createSimulation,
  createSimulationFromSnapshot,
  parseScenario,
  serializeSnapshot,
} from '../src/index.js';

function createMindModelSimulation(input: unknown = scenario) {
  return createSimulation({
    characterLibrary: mindModelCharacters,
    environmentLibrary: environments,
    scenario: input,
  });
}

function dyadFor(state: ReturnType<typeof createMindModelSimulation>, observerId: string) {
  const dyad = state.dyads.find(candidate => candidate.observerId === observerId);
  assert.ok(dyad);
  return dyad;
}

describe('observation and prediction', () => {
  it('does not materialize a mind model when the observer misses the event', () => {
    const parsed = parseScenario(scenario);
    const missedEvent = parsed.observationEvents[0];
    assert.ok(missedEvent);
    const isolated = {
      ...parsed,
      dyads: [],
      observationEvents: [
        { ...missedEvent, atMinute: 601, id: 'imperceptible-signal', visualProminence: 0 },
      ],
    };
    const next = advanceSimulation(createMindModelSimulation(isolated), 1);

    assert.equal(next.observations[0]?.outcome, 'missed');
    assert.deepEqual(next.dyads, []);
    assert.equal(next.trace.entries.filter(entry => entry.kind === 'prediction').length, 0);
  });

  it('projects and materializes a one-level dyad only after a perceived encounter', () => {
    const parsed = parseScenario(scenario);
    const firstEvent = parsed.observationEvents[0];
    assert.ok(firstEvent);
    const isolated = {
      ...parsed,
      dyads: [],
      observationEvents: [{ ...firstEvent, atMinute: 601, id: 'first-encounter' }],
    };
    const next = advanceSimulation(createMindModelSimulation(isolated), 1);
    const dyad = dyadFor(next, 'endicott');

    assert.equal(next.observations[0]?.outcome, 'suspected');
    assert.equal(dyad.estimatedEmpathy, (0.31 + 0.96) / 2);
    assert.equal(dyad.subjectId, 'margueritte');
  });

  it('turns sustained nondiagnostic contradiction into suspicion without revising the model', () => {
    const initial = createMindModelSimulation();
    const next = advanceSimulation(initial, 4);

    assert.deepEqual(
      next.observations.map(observation => observation.outcome),
      ['suspected', 'suspected', 'suspected', 'suspected'],
    );
    for (const observerId of ['endicott', 'margueritte']) {
      const before = dyadFor(initial, observerId);
      const after = dyadFor(next, observerId);
      assert.equal(after.estimatedEmpathy, before.estimatedEmpathy);
      assert.ok(after.suspicion > before.suspicion);
      assert.ok(after.predictionError > before.predictionError);
    }
  });

  it('corrects both directed models when the forced exchange crosses the evidence gate', () => {
    const beforeExchange = advanceSimulation(createMindModelSimulation(), 4);
    const resolved = advanceSimulation(beforeExchange, 6);
    const correctionRecords = resolved.observations.slice(-2);

    assert.deepEqual(
      correctionRecords.map(observation => observation.outcome),
      ['corrected', 'corrected'],
    );
    for (const observerId of ['endicott', 'margueritte']) {
      const before = dyadFor(beforeExchange, observerId);
      const after = dyadFor(resolved, observerId);
      assert.ok(after.estimatedEmpathy > before.estimatedEmpathy);
      assert.ok(after.suspicion < before.suspicion);
      assert.ok(after.predictionError < before.predictionError);
    }
    assert.ok(
      resolved.trace.entries.some(
        entry =>
          entry.kind === 'prediction' &&
          entry.terms.some(term => term.id === 'outcome' && term.value === 'corrected'),
      ),
    );
  });

  it('keeps a weaker forcing exchange below the correction gate', () => {
    const parsed = parseScenario(scenario);
    const weakened = {
      ...parsed,
      observationEvents: parsed.observationEvents.map(event =>
        event.id.endsWith('forced-exchange') ? { ...event, diagnosticity: 0.6 } : event,
      ),
    };
    const resolved = advanceSimulation(createMindModelSimulation(weakened), 10);

    assert.deepEqual(
      resolved.observations.slice(-2).map(observation => observation.outcome),
      ['suspected', 'suspected'],
    );
    assert.equal(dyadFor(resolved, 'endicott').estimatedEmpathy, 0.18);
    assert.equal(dyadFor(resolved, 'margueritte').estimatedEmpathy, 0.2);
  });

  it('resumes prediction state and replays the same corrections exactly', () => {
    const paused = advanceSimulation(createMindModelSimulation(), 4);
    const snapshot = serializeSnapshot(paused);
    const resumed = createSimulationFromSnapshot({
      characterLibrary: mindModelCharacters,
      environmentLibrary: environments,
      snapshot,
    });
    const continuous = advanceSimulation(paused, 6);
    const replayed = advanceSimulation(resumed, 6);

    assert.deepEqual(serializeSnapshot(replayed), serializeSnapshot(continuous));
  });
});
