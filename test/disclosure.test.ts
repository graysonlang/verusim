import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import characters from '../library/characters.json';
import environments from '../library/environments.json';
import disclosureScenario from '../scenarios/disclosure-audience.json';
import {
  advanceSimulation,
  createSimulation,
  createSimulationFromSnapshot,
  evaluateDisclosureOpportunity,
  evaluateEmpathy,
  serializeSnapshot,
  type DisclosureOpportunity,
  type SimulationState,
} from '../src/index.js';

function createDisclosureSimulation(scenario: unknown = disclosureScenario): SimulationState {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario,
  });
}

function firstOpportunity(state: SimulationState): DisclosureOpportunity {
  const opportunity = state.scenario.disclosureOpportunities[0];
  assert.ok(opportunity);
  return opportunity;
}

describe('disclosure and exposure', () => {
  it('lets the worst observer collapse disclosure without averaging the audience', () => {
    const privateState = createDisclosureSimulation();
    const privateDecision = evaluateDisclosureOpportunity(
      privateState,
      firstOpportunity(privateState),
    );
    const mixedScenario = structuredClone(disclosureScenario);
    const mixedOpportunity = mixedScenario.disclosureOpportunities[0];
    assert.ok(mixedOpportunity);
    mixedOpportunity.audienceIds = ['friend', 'hostile'];
    const mixedState = createDisclosureSimulation(mixedScenario);
    const mixedDecision = evaluateDisclosureOpportunity(mixedState, firstOpportunity(mixedState));

    assert.equal(privateDecision.outcome, 'disclose');
    assert.equal(mixedDecision.outcome, 'conceal');
    assert.equal(mixedDecision.worstAudienceId, 'hostile');
    assert.equal(
      mixedDecision.worstCost,
      Math.max(...mixedDecision.audiences.map(audience => audience.subjectiveCost)),
    );
    assert.ok(mixedDecision.worstCost > privateDecision.worstCost);
  });

  it('keeps disclosure safety distinct from the empathy envelope', () => {
    const state = createDisclosureSimulation();
    const ownerEmpathy = evaluateEmpathy(state, 'owner', 'friend').empathy;
    const decision = evaluateDisclosureOpportunity(state, firstOpportunity(state));
    const friend = decision.audiences[0];
    assert.ok(friend);
    assert.ok(ownerEmpathy > friend.disclosureSafety);
    assert.notEqual(ownerEmpathy, friend.disclosureSafety);
  });

  it('writes successful disclosure to the exposure ledger and causal trace', () => {
    const result = advanceSimulation(createDisclosureSimulation());
    const item = result.disclosureItems.find(candidate => candidate.id === 'family-debt');
    assert.ok(item);
    assert.deepEqual(item.knownByIds, ['friend']);
    assert.equal(result.disclosureDecisions.at(-1)?.outcome, 'disclose');
    assert.equal(result.resolvedDisclosureOpportunityIds.at(-1), 'private-question');
    assert.ok(result.trace.entries.some(entry => entry.kind === 'disclosure-appraisal'));
    assert.ok(result.trace.entries.some(entry => entry.kind === 'disclosure-decision'));
  });

  it('replays private disclosure followed by mixed-audience concealment', () => {
    const result = advanceSimulation(createDisclosureSimulation(), 2);
    assert.deepEqual(
      result.disclosureDecisions.map(decision => decision.outcome),
      ['disclose', 'conceal'],
    );
    assert.equal(result.disclosureDecisions.at(-1)?.worstAudienceId, 'hostile');
    assert.deepEqual(result.disclosureItems[0]?.knownByIds, ['friend']);
  });

  it('makes network isolation zero the exposure component', () => {
    const isolatedScenario = structuredClone(disclosureScenario);
    const opportunity = isolatedScenario.disclosureOpportunities[0];
    assert.ok(opportunity);
    opportunity.audienceIds = ['hostile'];
    opportunity.networkConductivity = 0;
    const state = createDisclosureSimulation(isolatedScenario);
    const decision = evaluateDisclosureOpportunity(state, firstOpportunity(state));
    assert.equal(decision.audiences[0]?.exposureRisk, 0);
  });

  it('preserves dyads and exposure exactly across snapshot resume', () => {
    const advanced = advanceSimulation(createDisclosureSimulation());
    const resumed = createSimulationFromSnapshot({
      characterLibrary: characters,
      environmentLibrary: environments,
      snapshot: serializeSnapshot(advanced),
    });
    assert.deepEqual(resumed, advanced);
  });

  it('replays the same disclosure decision and trace exactly', () => {
    const first = advanceSimulation(createDisclosureSimulation());
    const second = advanceSimulation(createDisclosureSimulation());
    assert.deepEqual(first, second);
  });
});
