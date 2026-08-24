import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classLabel,
  locationName,
  physicalProfileSummary,
  signedModifier,
  signedPercent,
} from '../app/badges.js';
import { DEFAULT_BUILT_IN_SCENARIO } from '../app/scenarios.js';
import { createSimulation } from '../src/index.js';

describe('badge formatters', () => {
  it('capitalizes class labels', () => {
    assert.equal(classLabel('average'), 'Average');
    assert.equal(classLabel('tall'), 'Tall');
  });

  it('formats signed modifiers with a neutral zero', () => {
    assert.equal(signedModifier(0), 'neutral');
    assert.equal(signedModifier(0.25), '+0.25');
    assert.equal(signedModifier(-0.1), '-0.10');
  });

  it('formats signed percentages relative to a neutral multiplier', () => {
    assert.equal(signedPercent(1), 'neutral');
    assert.equal(signedPercent(1.1), '+10%');
    assert.equal(signedPercent(0.85), '-15%');
  });

  it('summarizes a physical profile in full and compact forms', () => {
    const state = createSimulation(DEFAULT_BUILT_IN_SCENARIO.prepared);
    const agent = state.agents[0];
    assert.notEqual(agent, undefined);
    if (agent === undefined) return;
    const full = physicalProfileSummary(agent);
    const compact = physicalProfileSummary(agent, true);
    assert.ok(full.startsWith(`${agent.profile.physical.ageYears} / `));
    assert.ok(full.includes('comeliness'));
    assert.ok(compact.startsWith(`${agent.profile.physical.ageYears} / `));
    assert.ok(compact.length < full.length);
  });

  it('resolves location names from the environment and marks transit', () => {
    const state = createSimulation(DEFAULT_BUILT_IN_SCENARIO.prepared);
    const agent = state.agents[0];
    assert.notEqual(agent, undefined);
    if (agent === undefined) return;
    const placed = { ...agent, currentLocationId: state.environment.locations[0]?.id ?? null };
    const transit = { ...agent, currentLocationId: null };
    assert.equal(locationName(state, placed), state.environment.locations[0]?.name);
    assert.equal(locationName(state, transit), 'In transit');
  });
});
