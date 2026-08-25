import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { characters, copingCharacters, copingEnvironments, environments } from './fixtures.js';
import cascadeScenario from '../content/scenarios/cascade-room.json';
import innkeeperScenario from '../content/scenarios/innkeeper-coping.json';
import {
  advanceSimulation,
  createSimulation,
  createSimulationFromSnapshot,
  parseScenario,
  reactiveValueTurns,
  serializeSnapshot,
  type ScenarioFile,
} from '../src/index.js';

function createCascadeSimulation(input: unknown = cascadeScenario) {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario: input,
  });
}

function createInnkeeperSimulation(
  environmentId = 'coping-inn',
  input: unknown = innkeeperScenario,
) {
  const authored = parseScenario(input);
  authored.environment.resourceId = environmentId;
  return createSimulation({
    characterLibrary: copingCharacters,
    environmentLibrary: copingEnvironments,
    scenario: authored,
  });
}

function cascadeVariant(
  copingPotential: number,
  options: { believedLeverage: boolean; exitAvailable: boolean; socialTargetId: string | null },
): ScenarioFile {
  const authored = parseScenario(cascadeScenario);
  const event = authored.appraisalEvents[0];
  assert.ok(event);
  return {
    ...authored,
    appraisalEvents: [{ ...event, copingPotential, ...options }],
  };
}

describe('accumulation and coping', () => {
  it('routes the same provocation to different cascade rungs as coping potential changes', () => {
    const mobilized = advanceSimulation(
      createCascadeSimulation(
        cascadeVariant(0.9, {
          believedLeverage: true,
          exitAvailable: true,
          socialTargetId: 'abuser',
        }),
      ),
      1,
    );
    const fawning = advanceSimulation(createCascadeSimulation(), 1);
    const flopped = advanceSimulation(
      createCascadeSimulation(
        cascadeVariant(0.05, {
          believedLeverage: false,
          exitAvailable: false,
          socialTargetId: null,
        }),
      ),
      1,
    );

    assert.equal(mobilized.characters.find(agent => agent.id === 'witness')?.cascade, 'fight');
    assert.equal(fawning.characters.find(agent => agent.id === 'witness')?.cascade, 'fawn');
    assert.equal(flopped.characters.find(agent => agent.id === 'witness')?.cascade, 'flop');
  });

  it('descends immediately, recovers slowly, and holds a borderline state through dwell', () => {
    const descended = advanceSimulation(createCascadeSimulation(), 1);
    const witness = descended.characters.find(agent => agent.id === 'witness');
    assert.ok(witness);
    assert.equal(witness.cascade, 'fawn');

    const held = advanceSimulation(descended, 5);
    assert.equal(held.characters.find(agent => agent.id === 'witness')?.cascade, 'fawn');
    assert.ok((held.characters.find(agent => agent.id === 'witness')?.cascadeLoad ?? 0) > 0);

    const recovered = advanceSimulation(held, 300);
    const recoveredWitness = recovered.characters.find(agent => agent.id === 'witness');
    assert.ok(recoveredWitness);
    assert.notEqual(recoveredWitness.cascade, 'flop');
    assert.ok(recoveredWitness.cascadeLoad < witness.cascadeLoad);
  });

  it('scales positive and negative turns through the same reactivity coefficient', () => {
    const witness = createCascadeSimulation().characters.find(agent => agent.id === 'witness');
    assert.ok(witness);
    const turns = reactiveValueTurns(witness, { belonging: 0.4, safety: -0.4 });

    assert.equal(turns.belonging, 0.4 * witness.profile.constitution.reactivity);
    assert.equal(turns.safety, -0.4 * witness.profile.constitution.reactivity);
    assert.equal(Math.abs(turns.belonging ?? 0), Math.abs(turns.safety ?? 0));
  });

  it('keeps therapist cooperation and abuser-targeted fawning simultaneous', () => {
    const resolved = advanceSimulation(createCascadeSimulation(), 1);
    const witness = resolved.characters.find(agent => agent.id === 'witness');
    assert.ok(witness);

    assert.equal(resolved.relationshipDecisions[0]?.outcome, 'accepted');
    assert.equal(resolved.relationshipDecisions[0]?.requesterId, 'therapist');
    assert.equal(witness.cascade, 'fawn');
    assert.equal(witness.cascadeTargetId, 'abuser');
  });

  it('keeps the outlet operation while the environment changes the concrete act', () => {
    const states = ['coping-inn', 'coping-yard', 'coping-storehouse'].map(environmentId =>
      advanceSimulation(createInnkeeperSimulation(environmentId), 1),
    );
    const outlets = states.map(state => state.characters[0]?.currentOutlet);

    assert.ok(outlets.every(outlet => outlet?.operation === 'control'));
    assert.deepEqual(
      outlets.map(outlet => outlet?.affordanceId),
      ['count-bottles', 'pace-boundary', 'straighten-sacks'],
    );
  });

  it('fires the innkeeper outlet from seeded deficit rather than a one-event threshold', () => {
    const resolved = advanceSimulation(createInnkeeperSimulation(), 1);
    const mara = resolved.characters[0];
    assert.ok(mara);

    assert.equal(resolved.appraisalRecords.length, 0);
    assert.ok(mara.values.safety.deficitIntegral > 0.7);
    assert.equal(mara.currentOutlet?.operation, 'control');
    assert.ok(resolved.trace.entries.some(entry => entry.kind === 'outlet'));
  });

  it('makes variable-ratio outlets resist habituation at the same use count', () => {
    const fixed = advanceSimulation(createInnkeeperSimulation('coping-inn'), 40).characters[0];
    const variable = advanceSimulation(createInnkeeperSimulation('coping-storehouse'), 40)
      .characters[0];
    assert.ok(fixed && variable);
    const fixedUse = fixed.outletHistory[0];
    const variableUse = variable.outletHistory[0];
    assert.ok(fixedUse && variableUse);

    assert.equal(fixedUse.uses, variableUse.uses);
    assert.ok(variableUse.habituation < fixedUse.habituation);
  });

  it('keeps masking outlets from silently repairing their accumulated deficit', () => {
    const displaced = advanceSimulation(createInnkeeperSimulation('coping-inn'), 1).characters[0];
    const repairing = advanceSimulation(createInnkeeperSimulation('coping-yard'), 1).characters[0];
    assert.ok(displaced && repairing);

    assert.ok(repairing.values.safety.deficitIntegral < displaced.values.safety.deficitIntegral);
  });

  it('drains activity and masking resources without relabeling them as value turns', () => {
    const drained = advanceSimulation(createInnkeeperSimulation(), 60).characters[0];
    const neutralScenario = parseScenario(innkeeperScenario);
    const placement = neutralScenario.characters[0];
    const block = placement?.schedule[0];
    assert.ok(placement && block);
    block.resourceDrainsPerHour = {};
    block.maskingDemand = null;
    const neutral = advanceSimulation(createInnkeeperSimulation('coping-inn', neutralScenario), 60)
      .characters[0];
    assert.ok(drained && neutral);

    assert.ok(drained.resources.executiveBudget < neutral.resources.executiveBudget);
    assert.ok(drained.resources.physicalStamina < neutral.resources.physicalStamina);
    assert.ok(drained.resources.regulationReserve < neutral.resources.regulationReserve);
  });

  it('resumes cascade and outlet state exactly from a snapshot', () => {
    const paused = advanceSimulation(createCascadeSimulation(), 3);
    const resumed = createSimulationFromSnapshot({
      characterLibrary: characters,
      environmentLibrary: environments,
      snapshot: serializeSnapshot(paused),
    });
    const continuous = advanceSimulation(paused, 30);
    const replayed = advanceSimulation(resumed, 30);

    assert.deepEqual(serializeSnapshot(replayed), serializeSnapshot(continuous));
  });
});
