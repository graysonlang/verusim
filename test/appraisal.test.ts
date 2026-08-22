import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appraiseAction, type ValueMap } from '../src/index.js';

const weights: ValueMap<number> = {
  autonomy: 0.5,
  belonging: 1,
  competence: 0.5,
  fairness: 1.5,
  respect: 0.75,
  safety: 2,
};

describe('appraiseAction', () => {
  it('keeps every term in the top-level Verus equation inspectable', () => {
    const result = appraiseAction({
      contractViolationCost: 0.2,
      impacts: [
        { empathy: 0.5, subjectId: 'merchant', turns: { fairness: -0.4, safety: -0.8 } },
        { empathy: 1, subjectId: 'actor', turns: { safety: 0.3 } },
      ],
      narrativeExpression: 0.15,
      repercussionCost: 0.4,
      valueWeights: weights,
    });

    assert.equal(result.contributions.length, 3);
    assert.ok(Math.abs(result.turnFelt - -0.5) < 1e-12);
    assert.ok(Math.abs(result.utility - -0.95) < 1e-12);
    assert.deepEqual(
      result.contributions.map(contribution => [contribution.subjectId, contribution.value]),
      [
        ['merchant', 'safety'],
        ['merchant', 'fairness'],
        ['actor', 'safety'],
      ],
    );
  });

  it('preserves ordinal action ranking when only repercussions change', () => {
    const common = {
      contractViolationCost: 0,
      impacts: [{ empathy: 1, subjectId: 'actor', turns: { safety: 0.4 } }],
      narrativeExpression: 0,
      valueWeights: weights,
    };
    const emptyRoad = appraiseAction({ ...common, repercussionCost: 0.05 });
    const townSquare = appraiseAction({ ...common, repercussionCost: 0.7 });
    assert.ok(emptyRoad.utility > townSquare.utility);
    assert.equal(emptyRoad.turnFelt, townSquare.turnFelt);
  });
});
