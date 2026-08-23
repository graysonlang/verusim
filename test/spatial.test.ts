import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { characters, environments } from './fixtures.js';
import scenario from '../content/scenarios/disclosure-audience.json';
import {
  createSimulation,
  evaluateEavesdropping,
  evaluateProximity,
  evaluateSpatialPerception,
  type Point,
  type SimulationState,
} from '../src/index.js';

function createState(): SimulationState {
  return createSimulation({
    characterLibrary: characters,
    environmentLibrary: environments,
    scenario,
  });
}

function withPositions(state: SimulationState, positions: Record<string, Point>): SimulationState {
  return {
    ...state,
    agents: state.agents.map(agent => ({
      ...agent,
      position:
        positions[agent.id] === undefined
          ? agent.position
          : { ...agent.position, ...positions[agent.id] },
    })),
  };
}

describe('spatial appraisal', () => {
  it('makes the same physical distance more invasive across a guarded dyad', () => {
    const state = withPositions(createState(), {
      friend: { x: 108.6, y: 76 },
      hostile: { x: 108.6, y: 76 },
      owner: { x: 108, y: 76 },
    });
    const friend = evaluateProximity(state, 'owner', 'friend');
    const hostile = evaluateProximity(state, 'owner', 'hostile');

    assert.equal(friend.distanceMeters, hostile.distanceMeters);
    assert.ok(friend.relationshipCloseness > hostile.relationshipCloseness);
    assert.ok(friend.comfortableDistanceMeters < hostile.comfortableDistanceMeters);
    assert.ok(friend.discomfort < hostile.discomfort);
    assert.ok((hostile.valueTurns.autonomy ?? 0) < 0);
    assert.ok(hostile.terms.every(term => term.sources.length > 0));
  });

  it('expands personal-space needs as social battery depletes', () => {
    const positioned = withPositions(createState(), {
      hostile: { x: 109, y: 76 },
      owner: { x: 108, y: 76 },
    });
    const rested = {
      ...positioned,
      agents: positioned.agents.map(agent =>
        agent.id === 'owner'
          ? { ...agent, resources: { ...agent.resources, socialBattery: 1 } }
          : agent,
      ),
    };
    const depleted = {
      ...positioned,
      agents: positioned.agents.map(agent =>
        agent.id === 'owner'
          ? { ...agent, resources: { ...agent.resources, socialBattery: 0.05 } }
          : agent,
      ),
    };
    const restedProximity = evaluateProximity(rested, 'owner', 'hostile');
    const depletedProximity = evaluateProximity(depleted, 'owner', 'hostile');
    const restedPerception = evaluateSpatialPerception(rested, 'owner', 'hostile');
    const depletedPerception = evaluateSpatialPerception(depleted, 'owner', 'hostile');

    assert.equal(restedProximity.distanceMeters, depletedProximity.distanceMeters);
    assert.ok(
      restedProximity.comfortableDistanceMeters < depletedProximity.comfortableDistanceMeters,
    );
    assert.ok(restedProximity.discomfort < depletedProximity.discomfort);
    assert.equal(restedPerception.sight.strength, depletedPerception.sight.strength);
    assert.equal(restedPerception.hearing.strength, depletedPerception.hearing.strength);
    assert.ok(depletedProximity.terms.some(term => term.id === 'social-battery'));
  });

  it('separates audibility from concealment in an open square', () => {
    const state = withPositions(createState(), {
      hostile: { x: 116, y: 76 },
      owner: { x: 108, y: 76 },
    });
    const perception = evaluateSpatialPerception(state, 'hostile', 'owner');
    const eavesdropping = evaluateEavesdropping(state, 'hostile', 'owner');

    assert.equal(perception.hearing.available, true);
    assert.equal(eavesdropping.detectedBySpeaker, true);
    assert.equal(eavesdropping.reason, 'exposed');
    assert.equal(eavesdropping.possible, false);
  });

  it('lets nearby cover enable covert listening without improving hearing', () => {
    const openState = withPositions(createState(), {
      hostile: { x: 116, y: 76 },
      owner: { x: 108, y: 76 },
    });
    const coveredState = withPositions(createState(), {
      hostile: { x: 49, y: 42 },
      owner: { x: 57, y: 42 },
    });
    const open = evaluateEavesdropping(openState, 'hostile', 'owner');
    const covered = evaluateEavesdropping(coveredState, 'hostile', 'owner');

    assert.equal(open.proximity.distanceMeters, covered.proximity.distanceMeters);
    assert.equal(covered.hearing.available, true);
    assert.ok(covered.hearing.strength < open.hearing.strength);
    assert.ok(covered.concealment > open.concealment);
    assert.equal(covered.detectedBySpeaker, false);
    assert.equal(covered.reason, 'concealed');
    assert.equal(covered.possible, true);
  });

  it('rejects covert listening outside the audible range regardless of cover', () => {
    const state = withPositions(createState(), {
      hostile: { x: 3, y: 42 },
      owner: { x: 57, y: 42 },
    });
    const result = evaluateEavesdropping(state, 'hostile', 'owner');
    assert.equal(result.hearing.available, false);
    assert.equal(result.reason, 'out-of-earshot');
    assert.equal(result.possible, false);
  });
});
