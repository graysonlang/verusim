import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import characters from '../library/characters.json';
import environments from '../library/environments.json';
import scenario from '../scenarios/disclosure-audience.json';
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
      position: positions[agent.id] ?? agent.position,
    })),
  };
}

describe('spatial appraisal', () => {
  it('makes the same physical distance more invasive across a guarded dyad', () => {
    const state = withPositions(createState(), {
      friend: { x: 650.6, y: 455 },
      hostile: { x: 650.6, y: 455 },
      owner: { x: 650, y: 455 },
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

  it('separates audibility from concealment in an open square', () => {
    const state = withPositions(createState(), {
      hostile: { x: 658, y: 455 },
      owner: { x: 650, y: 455 },
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
      hostile: { x: 658, y: 455 },
      owner: { x: 650, y: 455 },
    });
    const coveredState = withPositions(createState(), {
      hostile: { x: 296, y: 250 },
      owner: { x: 304, y: 250 },
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
      hostile: { x: 250, y: 250 },
      owner: { x: 304, y: 250 },
    });
    const result = evaluateEavesdropping(state, 'hostile', 'owner');
    assert.equal(result.hearing.available, false);
    assert.equal(result.reason, 'out-of-earshot');
    assert.equal(result.possible, false);
  });
});
