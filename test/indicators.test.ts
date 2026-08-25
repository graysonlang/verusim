import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  areaIndicatorsForState,
  defaultIndicatorSettings,
  indicatorsForCharacter,
  inspectionIndicatorSettings,
} from '../app/indicators.js';
import { characters, environments } from './fixtures.js';
import disclosureScenario from '../content/scenarios/disclosure-audience.json';
import marketScenario from '../content/scenarios/market-morning.json';
import {
  advanceSimulation,
  createSimulation,
  setCharacterValueCharge,
  type SimulationState,
} from '../src/index.js';

function createState(scenario: unknown = marketScenario): SimulationState {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario,
  });
}

describe('workbench indicators', () => {
  it('projects grounded mood, thought, action, and area signals', () => {
    const state = createState();
    const agent = state.characters[0];
    assert.ok(agent);
    const settings = defaultIndicatorSettings();

    assert.deepEqual(
      indicatorsForCharacter(state, agent, settings).map(indicator => indicator.kind),
      ['mood', 'thought', 'action'],
    );
    assert.deepEqual(
      areaIndicatorsForState(state, settings).map(indicator => indicator.valueId),
      ['safety', 'belonging'],
    );
  });

  it('does not invent speech and only surfaces recorded recent events', () => {
    const initial = createState();
    const agent = initial.characters[0];
    assert.ok(agent);
    const settings = defaultIndicatorSettings();
    assert.equal(
      indicatorsForCharacter(initial, agent, settings).some(
        indicator => indicator.kind === 'speech',
      ),
      false,
    );
    assert.equal(
      indicatorsForCharacter(initial, agent, settings).some(
        indicator => indicator.kind === 'event',
      ),
      false,
    );

    const changed = setCharacterValueCharge(initial, agent.id, 'safety', -0.8);
    const changedAgent = changed.characters.find(candidate => candidate.id === agent.id);
    assert.ok(changedAgent);
    assert.equal(
      indicatorsForCharacter(changed, changedAgent, settings).some(
        indicator => indicator.kind === 'event',
      ),
      true,
    );
  });

  it('shows actual disclosure as transient speech with a longer detailed history', () => {
    const disclosed = advanceSimulation(createState(disclosureScenario), 5);
    const owner = disclosed.characters.find(agent => agent.id === 'owner');
    assert.ok(owner);
    const standard = defaultIndicatorSettings();
    const speech = indicatorsForCharacter(disclosed, owner, standard).find(
      indicator => indicator.kind === 'speech',
    );
    assert.equal(speech?.label, 'Shared the family debt');

    const later = advanceSimulation(disclosed, 30);
    const laterOwner = later.characters.find(agent => agent.id === 'owner');
    assert.ok(laterOwner);
    assert.equal(
      indicatorsForCharacter(later, laterOwner, standard).some(
        indicator => indicator.kind === 'speech',
      ),
      false,
    );
    assert.equal(
      indicatorsForCharacter(later, laterOwner, { ...standard, verbosity: 'detailed' }).some(
        indicator => indicator.kind === 'speech',
      ),
      true,
    );
  });

  it('honors verbosity and independent category controls', () => {
    const state = createState();
    const agent = state.characters[0];
    assert.ok(agent);
    const settings = defaultIndicatorSettings();
    settings.visible.mood = false;
    settings.visible.area = false;

    assert.deepEqual(
      indicatorsForCharacter(state, agent, { ...settings, verbosity: 'minimal' }).map(
        indicator => indicator.kind,
      ),
      ['action'],
    );
    assert.deepEqual(areaIndicatorsForState(state, settings), []);
    assert.deepEqual(indicatorsForCharacter(state, agent, { ...settings, verbosity: 'off' }), []);
  });

  it('keeps inspection signals complete independently from field settings', () => {
    const state = createState();
    const agent = state.characters[0];
    assert.ok(agent);
    const field = defaultIndicatorSettings();
    field.verbosity = 'off';
    for (const kind of Object.keys(field.visible) as Array<keyof typeof field.visible>) {
      field.visible[kind] = false;
    }

    assert.deepEqual(indicatorsForCharacter(state, agent, field), []);
    assert.deepEqual(
      indicatorsForCharacter(state, agent, inspectionIndicatorSettings()).map(
        indicator => indicator.kind,
      ),
      ['mood', 'thought', 'action'],
    );
  });
});
