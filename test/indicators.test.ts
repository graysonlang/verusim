import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  areaIndicatorsForState,
  defaultIndicatorSettings,
  indicatorsForAgent,
  inspectionIndicatorSettings,
} from '../app/indicators.js';
import { characters, environments } from './fixtures.js';
import disclosureScenario from '../content/scenarios/disclosure-audience.json';
import marketScenario from '../content/scenarios/market-morning.json';
import {
  advanceSimulation,
  createSimulation,
  setAgentValueCharge,
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
    const agent = state.agents[0];
    assert.ok(agent);
    const settings = defaultIndicatorSettings();

    assert.deepEqual(
      indicatorsForAgent(state, agent, settings).map(indicator => indicator.kind),
      ['mood', 'thought', 'action'],
    );
    assert.deepEqual(
      areaIndicatorsForState(state, settings).map(indicator => indicator.valueId),
      ['safety', 'belonging'],
    );
  });

  it('does not invent speech and only surfaces recorded recent events', () => {
    const initial = createState();
    const agent = initial.agents[0];
    assert.ok(agent);
    const settings = defaultIndicatorSettings();
    assert.equal(
      indicatorsForAgent(initial, agent, settings).some(indicator => indicator.kind === 'speech'),
      false,
    );
    assert.equal(
      indicatorsForAgent(initial, agent, settings).some(indicator => indicator.kind === 'event'),
      false,
    );

    const changed = setAgentValueCharge(initial, agent.id, 'safety', -0.8);
    const changedAgent = changed.agents.find(candidate => candidate.id === agent.id);
    assert.ok(changedAgent);
    assert.equal(
      indicatorsForAgent(changed, changedAgent, settings).some(
        indicator => indicator.kind === 'event',
      ),
      true,
    );
  });

  it('shows actual disclosure as transient speech with a longer detailed history', () => {
    const disclosed = advanceSimulation(createState(disclosureScenario), 5);
    const owner = disclosed.agents.find(agent => agent.id === 'owner');
    assert.ok(owner);
    const standard = defaultIndicatorSettings();
    const speech = indicatorsForAgent(disclosed, owner, standard).find(
      indicator => indicator.kind === 'speech',
    );
    assert.equal(speech?.label, 'Shared the family debt');

    const later = advanceSimulation(disclosed, 30);
    const laterOwner = later.agents.find(agent => agent.id === 'owner');
    assert.ok(laterOwner);
    assert.equal(
      indicatorsForAgent(later, laterOwner, standard).some(
        indicator => indicator.kind === 'speech',
      ),
      false,
    );
    assert.equal(
      indicatorsForAgent(later, laterOwner, { ...standard, verbosity: 'detailed' }).some(
        indicator => indicator.kind === 'speech',
      ),
      true,
    );
  });

  it('honors verbosity and independent category controls', () => {
    const state = createState();
    const agent = state.agents[0];
    assert.ok(agent);
    const settings = defaultIndicatorSettings();
    settings.visible.mood = false;
    settings.visible.area = false;

    assert.deepEqual(
      indicatorsForAgent(state, agent, { ...settings, verbosity: 'minimal' }).map(
        indicator => indicator.kind,
      ),
      ['action'],
    );
    assert.deepEqual(areaIndicatorsForState(state, settings), []);
    assert.deepEqual(indicatorsForAgent(state, agent, { ...settings, verbosity: 'off' }), []);
  });

  it('keeps inspection signals complete independently from field settings', () => {
    const state = createState();
    const agent = state.agents[0];
    assert.ok(agent);
    const field = defaultIndicatorSettings();
    field.verbosity = 'off';
    for (const kind of Object.keys(field.visible) as Array<keyof typeof field.visible>) {
      field.visible[kind] = false;
    }

    assert.deepEqual(indicatorsForAgent(state, agent, field), []);
    assert.deepEqual(
      indicatorsForAgent(state, agent, inspectionIndicatorSettings()).map(
        indicator => indicator.kind,
      ),
      ['mood', 'thought', 'action'],
    );
  });
});
