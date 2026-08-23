import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import characters from '../library/characters.json';
import environments from '../library/environments.json';
import highwaymanCharacters from '../library/highwayman-characters.json';
import highwaymanEnvironments from '../library/highwayman-environments.json';
import roadScenario from '../scenarios/highwayman-road.json';
import squareScenario from '../scenarios/highwayman-square.json';
import {
  advanceSimulation,
  createSimulation,
  effectiveValueWeights,
  evaluateEmpathy,
  evaluateOpportunity,
  type BehaviorOpportunity,
  type ScenarioFile,
  type SimulationState,
} from '../src/index.js';

const characterLibrary = {
  characters: [...characters.characters, ...highwaymanCharacters.characters],
  schemaVersion: 5,
};
const environmentLibrary = {
  environments: [...environments.environments, ...highwaymanEnvironments.environments],
  schemaVersion: 1,
};

function createHighwaymanSimulation(scenario: unknown): SimulationState {
  return createSimulation({ characterLibrary, environmentLibrary, scenario });
}

function selectedCandidate(state: SimulationState): string {
  const decision = state.decisions.at(-1);
  assert.ok(decision);
  return decision.selectedCandidateId;
}

function opportunity(state: SimulationState): BehaviorOpportunity {
  const result = state.scenario.behaviorOpportunities[0];
  assert.ok(result);
  return result;
}

function evaluationFor(state: SimulationState, candidateId: string) {
  const result = evaluateOpportunity(state, opportunity(state)).candidates.find(
    candidate => candidate.candidateId === candidateId,
  );
  assert.ok(result);
  return result;
}

describe('highwayman factorial', () => {
  it('changes the low-floor actor by context without changing empathy or cascade', () => {
    const road = createHighwaymanSimulation(roadScenario);
    const square = createHighwaymanSimulation(squareScenario);
    const roadEmpathy = evaluateEmpathy(road, 'actor', 'merchant').empathy;
    const squareEmpathy = evaluateEmpathy(square, 'actor', 'merchant').empathy;
    const roadResult = advanceSimulation(road, 5);
    const squareResult = advanceSimulation(square, 5);

    assert.equal(roadEmpathy, squareEmpathy);
    assert.equal(selectedCandidate(roadResult), 'rob');
    assert.equal(selectedCandidate(squareResult), 'greet');
    assert.equal(roadResult.agents.find(agent => agent.id === 'actor')?.cascade, 'none');
    assert.equal(squareResult.agents.find(agent => agent.id === 'actor')?.cascade, 'none');
    assert.equal(
      squareResult.trace.entries.some(entry => entry.kind === 'aftermath'),
      false,
    );
    assert.equal(squareResult.trace.entries.filter(entry => entry.kind === 'appraisal').length, 2);
  });

  it('keeps a fed normal-floor actor from robbing on the empty road', () => {
    const normal = structuredClone(roadScenario);
    const actor = normal.characters.find(placement => placement.instanceId === 'actor');
    assert.ok(actor);
    actor.characterId = 'orin-hale';
    const result = advanceSimulation(createHighwaymanSimulation(normal), 5);
    assert.equal(selectedCandidate(result), 'greet');
  });

  it('lets deprivation move a normal-floor actor to robbery with a remorse aftermath', () => {
    const starving = structuredClone(roadScenario) as unknown as ScenarioFile;
    const actor = starving.characters.find(placement => placement.instanceId === 'actor');
    assert.ok(actor);
    actor.characterId = 'orin-hale';
    actor.initialValues = {
      safety: { charge: -1, deficitIntegral: 1, variance: 0.1 },
    };

    const lowFloorResult = advanceSimulation(createHighwaymanSimulation(roadScenario), 5);
    const starvingResult = advanceSimulation(createHighwaymanSimulation(starving), 5);
    assert.equal(selectedCandidate(lowFloorResult), 'rob');
    assert.equal(selectedCandidate(starvingResult), 'rob');
    assert.equal(
      lowFloorResult.trace.entries.some(entry => entry.kind === 'aftermath'),
      false,
    );
    assert.equal(
      starvingResult.trace.entries.some(entry => entry.kind === 'aftermath'),
      true,
    );

    const initialStarving = createHighwaymanSimulation(starving);
    const starvingActor = initialStarving.agents.find(agent => agent.id === 'actor');
    const fedActor = createHighwaymanSimulation(roadScenario).agents.find(
      agent => agent.id === 'actor',
    );
    assert.ok(starvingActor);
    assert.ok(fedActor);
    assert.ok(effectiveValueWeights(starvingActor).safety > effectiveValueWeights(fedActor).safety);
  });

  it('routes witness identity through multiplicative repercussion context', () => {
    function robberyWithWitness(witnessId: string) {
      const variant = structuredClone(squareScenario);
      const firstOpportunity = variant.behaviorOpportunities[0];
      assert.ok(firstOpportunity);
      firstOpportunity.context.witnessIds = [witnessId];
      const state = createHighwaymanSimulation(variant);
      return evaluationFor(state, 'rob');
    }

    const actorKin = robberyWithWitness('actor-kin');
    const stranger = robberyWithWitness('warden');
    const merchantKin = robberyWithWitness('merchant-kin');
    assert.ok(actorKin.repercussion.probability < stranger.repercussion.probability);
    assert.ok(stranger.repercussion.probability < merchantKin.repercussion.probability);
    assert.equal(actorKin.appraisal.turnFelt, stranger.appraisal.turnFelt);
    assert.equal(stranger.appraisal.turnFelt, merchantKin.appraisal.turnFelt);

    const noEnforcement = structuredClone(squareScenario);
    const firstOpportunity = noEnforcement.behaviorOpportunities[0];
    assert.ok(firstOpportunity);
    firstOpportunity.context.enforcementPresence = 0;
    assert.equal(
      evaluationFor(createHighwaymanSimulation(noEnforcement), 'rob').repercussion.probability,
      0,
    );
  });

  it('keeps contract adherence separate from the empathy envelope', () => {
    const highContractLibrary = structuredClone(characterLibrary);
    const actorProfile = highContractLibrary.characters.find(
      character => character.id === 'corvin-rusk',
    );
    assert.ok(actorProfile);
    actorProfile.contractAdherence = 1;
    const baseline = evaluationFor(createHighwaymanSimulation(roadScenario), 'rob');
    const highContractState = createSimulation({
      characterLibrary: highContractLibrary,
      environmentLibrary,
      scenario: roadScenario,
    });
    const highContract = evaluationFor(highContractState, 'rob');
    assert.equal(baseline.empathy[1]?.empathy, highContract.empathy[1]?.empathy);
    assert.ok(
      baseline.appraisal.contractViolationCost < highContract.appraisal.contractViolationCost,
    );
    assert.ok(baseline.appraisal.utility > highContract.appraisal.utility);
  });

  it('coarsens familiarity as perceived threat rises', () => {
    const familiar = structuredClone(roadScenario);
    const relation = familiar.dyads[0];
    assert.ok(relation);
    relation.features.familiarity = 1;
    const state = createHighwaymanSimulation(familiar);
    const lowThreat = evaluateEmpathy(state, 'actor', 'merchant', 0);
    const highThreat = evaluateEmpathy(state, 'actor', 'merchant', 1);
    assert.ok(lowThreat.empathy > highThreat.empathy);
    assert.ok(lowThreat.distance < highThreat.distance);
  });

  it('replays the same behavioral decision and trace exactly', () => {
    const first = advanceSimulation(createHighwaymanSimulation(roadScenario), 5);
    const second = advanceSimulation(createHighwaymanSimulation(roadScenario), 5);
    assert.deepEqual(first, second);
    const appraisal = first.trace.entries.find(entry => entry.kind === 'appraisal');
    const selection = first.trace.entries.find(entry => entry.kind === 'decision')?.selection;
    assert.deepEqual(
      appraisal?.terms.slice(0, 5).map(term => term.id),
      [
        'turn-felt',
        'repercussion-cost',
        'contract-violation-cost',
        'narrative-expression',
        'utility',
      ],
    );
    assert.ok(appraisal?.terms.every(term => term.sources.length > 0));
    assert.equal(selection?.rule, 'highest-utility-then-authored-order');
    assert.equal(selection?.selectedId, first.decisions[0]?.selectedCandidateId);
  });
});
