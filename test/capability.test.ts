import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { characters, environments } from './fixtures.js';
import scenario from '../scenarios/market-morning.json';
import {
  createSimulation,
  resolveAgentCapabilityCheck,
  resolveCapabilityCheck,
  type CapabilityCheck,
} from '../src/index.js';

function check(baseCapability: number, difficulty: number): CapabilityCheck {
  return {
    applicable: true,
    availableCapacity: 1,
    availableCapacitySources: ['fixture.availableCapacity'],
    baseCapability,
    capabilityId: 'acuity',
    capabilitySource: 'fixture.capability',
    difficulty,
    difficultySource: 'fixture.difficulty',
    known: true,
    modifiers: [],
  };
}

function agentCheck() {
  return {
    applicable: true,
    capabilityId: 'acuity' as const,
    difficulty: 0.5,
    difficultySource: 'fixture.cueSubtlety',
    known: true,
    modifiers: [],
  };
}

describe('capability resolution', () => {
  it('maps deterministic margins onto the five Handy dial positions', () => {
    assert.equal(resolveCapabilityCheck(check(1, 0)).band, 'strong-yes');
    assert.equal(resolveCapabilityCheck(check(0.8, 0.4)).band, 'weak-yes');
    assert.equal(resolveCapabilityCheck(check(0.5, 0.5)).band, 'so-so');
    assert.equal(resolveCapabilityCheck(check(0.2, 0.6)).band, 'weak-no');
    assert.equal(resolveCapabilityCheck(check(0, 1)).band, 'strong-no');
  });

  it('keeps inapplicable and unknown checks off the numeric dial', () => {
    const inapplicable = resolveCapabilityCheck({ ...check(1, 0), applicable: false });
    const unknown = resolveCapabilityCheck({ ...check(1, 0), known: false });
    assert.equal(inapplicable.band, 'strike');
    assert.equal(inapplicable.margin, null);
    assert.equal(unknown.band, 'pass');
    assert.equal(unknown.margin, null);
  });

  it('combines stable acuity with current attention and fatigue resources', () => {
    const state = createSimulation({
      characterLibrary: characters,
      environmentLibrary: environments,
      scenario,
    });
    const mara = state.agents.find(agent => agent.id === 'mara');
    const nessa = state.agents.find(agent => agent.id === 'nessa');
    assert.ok(mara);
    assert.ok(nessa);

    const maraResult = resolveAgentCapabilityCheck(mara, agentCheck());
    const nessaResult = resolveAgentCapabilityCheck(nessa, agentCheck());
    const fatiguedResult = resolveAgentCapabilityCheck(
      {
        ...nessa,
        resources: { ...nessa.resources, executiveBudget: 0.16, physicalStamina: 0.25 },
      },
      agentCheck(),
    );

    assert.ok(nessaResult.margin !== null && maraResult.margin !== null);
    assert.ok(fatiguedResult.margin !== null);
    assert.ok(nessaResult.margin > maraResult.margin);
    assert.ok(maraResult.margin > fatiguedResult.margin);
    assert.equal(nessaResult.band, 'weak-yes');
    assert.equal(fatiguedResult.band, 'weak-no');
  });

  it('preserves explicit modifier and source terms for later causal traces', () => {
    const result = resolveCapabilityCheck({
      ...check(0.5, 0.65),
      modifiers: [
        {
          id: 'market-familiarity',
          source: 'skills.market-bargaining',
          value: 0.25,
        },
      ],
    });
    assert.equal(result.band, 'so-so');
    assert.deepEqual(
      result.terms.map(term => term.id),
      [
        'base-capability',
        'available-capacity',
        'effective-capability',
        'difficulty',
        'modifier:market-familiarity',
        'margin',
      ],
    );
    assert.ok(result.terms.every(term => term.sources.length > 0));
  });
});
