import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { characters, environments } from './fixtures.js';
import bakerScenario from '../content/scenarios/baker-deadline.json';
import {
  advanceSimulation,
  createSimulation,
  createSimulationFromSnapshot,
  serializeSnapshot,
  setWorldFactAmount,
  type ScenarioFile,
  type SimulationState,
} from '../src/index.js';

function createBakerSimulation(scenario: unknown = bakerScenario): SimulationState {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario,
  });
}

describe('agenda planning', () => {
  it('constructs a prerequisite plan and rushes only route that clears the deadline', () => {
    const initial = createBakerSimulation();
    const selected = initial.agendaDecisions.at(-1);
    assert.equal(initial.intentions[0]?.taskId, 'fetch-flour');
    assert.equal(
      selected?.candidates.find(candidate => candidate.id === selected.selectedPlanId)?.goalId,
      'sell-market-bread',
    );
    assert.deepEqual(
      selected?.candidates.find(candidate => candidate.id === selected.selectedPlanId)?.taskIds,
      ['fetch-flour', 'bake-bread-rush', 'sell-market-bread'],
    );

    const completed = advanceSimulation(initial, 45);
    assert.equal(
      completed.agendaGoals.find(goal => goal.id === 'sell-market-bread')?.status,
      'completed',
    );
    assert.equal(completed.worldFacts.find(fact => fact.id === 'bread-sold')?.amount, 1);
    assert.deepEqual(
      completed.trace.entries.filter(entry => entry.kind === 'task').map(entry => entry.summary),
      [
        'Mara Vale completed fetch flour from the mill',
        'Mara Vale completed rush the bread',
        'Mara Vale completed sell bread at the market',
      ],
    );
  });

  it('chooses careful work when flour leaves enough slack', () => {
    const available = structuredClone(bakerScenario);
    const flour = available.worldFacts.find(fact => fact.id === 'flour-on-hand');
    assert.ok(flour);
    flour.amount = 1;
    const state = createBakerSimulation(available);
    assert.equal(state.intentions[0]?.taskId, 'bake-bread-standard');
  });

  it('prioritizes non-urgent preparation when the market deadline moves later', () => {
    const later = structuredClone(bakerScenario);
    const marketGoal = later.agendaGoals.find(goal => goal.id === 'sell-market-bread');
    const marketTask = later.taskOperators.find(task => task.id === 'sell-market-bread');
    assert.ok(marketGoal);
    assert.ok(marketTask);
    marketGoal.deadlineSecond = 760 * 60;
    marketTask.availableUntilSecond = 760 * 60;
    const state = createBakerSimulation(later);
    assert.equal(state.intentions[0]?.taskId, 'prepare-common-room');
  });

  it('can reuse one operator when a goal requires repeated work', () => {
    const repeated = structuredClone(bakerScenario);
    const roomGoal = repeated.agendaGoals.find(goal => goal.id === 'prepare-common-room');
    const roomTask = repeated.taskOperators.find(task => task.id === 'prepare-common-room');
    assert.ok(roomGoal);
    assert.ok(roomTask);
    roomGoal.desired[0] = { factId: 'common-room-ready', minimum: 2 };
    repeated.agendaGoals = [roomGoal];
    repeated.taskOperators = [roomTask];
    const initial = createBakerSimulation(repeated);
    const selected = initial.agendaDecisions.at(-1);
    assert.deepEqual(
      selected?.candidates.find(candidate => candidate.id === selected.selectedPlanId)?.taskIds,
      ['prepare-common-room', 'prepare-common-room'],
    );
    const completed = advanceSimulation(initial, 40);
    assert.equal(completed.agendaGoals[0]?.status, 'completed');
    assert.equal(completed.worldFacts.find(fact => fact.id === 'common-room-ready')?.amount, 2);
  });

  it('allows an agenda task to restore resources while it is being performed', () => {
    const recovering = structuredClone(bakerScenario) as unknown as ScenarioFile;
    const roomGoal = recovering.agendaGoals.find(goal => goal.id === 'prepare-common-room');
    const roomTask = recovering.taskOperators.find(task => task.id === 'prepare-common-room');
    const mara = recovering.characters.find(character => character.instanceId === 'mara');
    assert.ok(roomGoal);
    assert.ok(roomTask);
    assert.ok(mara);
    recovering.agendaGoals = [roomGoal];
    recovering.taskOperators = [roomTask];
    roomTask.recoveryMode = 'rest';
    roomTask.resourceCosts = {};
    mara.initialResources = {
      executiveBudget: 0.1,
      physicalStamina: 0.1,
      regulationReserve: 0.1,
      socialBattery: 0.1,
    };

    const completed = advanceSimulation(createBakerSimulation(recovering), 25);
    const completedMara = completed.characters.find(agent => agent.id === 'mara');
    assert.ok(completedMara);
    assert.equal(completed.agendaGoals[0]?.status, 'completed');
    for (const amount of Object.values(completedMara.resources)) assert.ok(amount > 0.1);
  });

  it('replans when a committed task loses its prerequisite', () => {
    const available = structuredClone(bakerScenario);
    const flour = available.worldFacts.find(fact => fact.id === 'flour-on-hand');
    assert.ok(flour);
    flour.amount = 1;
    const initial = createBakerSimulation(available);
    assert.equal(initial.intentions[0]?.taskId, 'bake-bread-standard');
    const replanned = setWorldFactAmount(initial, 'flour-on-hand', 0);
    assert.equal(replanned.intentions[0]?.taskId, 'fetch-flour');
    assert.ok(
      replanned.trace.entries.some(
        entry =>
          entry.kind === 'intention' &&
          entry.summary === 'Canceled intention: Bake bread carefully',
      ),
    );
  });

  it('fails an infeasible deadline at the exact authored second', () => {
    const impossible = structuredClone(bakerScenario);
    const marketGoal = impossible.agendaGoals.find(goal => goal.id === 'sell-market-bread');
    const marketTask = impossible.taskOperators.find(task => task.id === 'sell-market-bread');
    assert.ok(marketGoal);
    assert.ok(marketTask);
    marketGoal.deadlineSecond = 627 * 60;
    marketTask.availableUntilSecond = 627 * 60;
    const completed = advanceSimulation(createBakerSimulation(impossible), 27);
    const failed = completed.agendaGoals.find(goal => goal.id === 'sell-market-bread');
    assert.equal(completed.second, 37620);
    assert.equal(failed?.status, 'failed');
    assert.equal(failed?.resolvedSecond, 37620);
    assert.ok(
      completed.trace.entries.some(entry => entry.kind === 'goal' && entry.id.endsWith(':failed')),
    );
  });

  it('preserves an in-progress plan exactly across snapshot resume', () => {
    const advanced = advanceSimulation(createBakerSimulation(), 35);
    const resumed = createSimulationFromSnapshot({
      characterLibrary: characters,
      environmentLibrary: environments,
      snapshot: serializeSnapshot(advanced),
    });
    assert.deepEqual(resumed, advanced);
    assert.deepEqual(advanceSimulation(resumed, 45), advanceSimulation(advanced, 45));
  });

  it('rejects snapshot intentions that do not belong to their plan', () => {
    const advanced = advanceSimulation(createBakerSimulation(), 35);
    const snapshot = serializeSnapshot(advanced);
    const intention = snapshot.intentions[0];
    assert.ok(intention);
    intention.taskId = 'fetch-flour';
    assert.throws(
      () =>
        createSimulationFromSnapshot({
          characterLibrary: characters,
          environmentLibrary: environments,
          snapshot,
        }),
      /snapshot\.intentions\[0\]/,
    );
  });

  it('replays the same agenda, intentions, and world effects exactly', () => {
    assert.deepEqual(
      advanceSimulation(createBakerSimulation(), 80),
      advanceSimulation(createBakerSimulation(), 80),
    );
  });
});
