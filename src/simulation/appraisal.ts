import {
  VALUE_IDS,
  type ActionAppraisal,
  type ActionAppraisalInput,
  type AppraisalContribution,
} from '../model/types.js';

export function appraiseAction(input: ActionAppraisalInput): ActionAppraisal {
  const contributions: AppraisalContribution[] = [];
  let turnFelt = 0;

  for (const impact of input.impacts) {
    for (const value of VALUE_IDS) {
      const turn = impact.turns[value] ?? 0;
      if (turn === 0) continue;
      const weight = input.valueWeights[value];
      const amount = impact.empathy * weight * turn;
      contributions.push({
        amount,
        empathy: impact.empathy,
        subjectId: impact.subjectId,
        turn,
        value,
        weight,
      });
      turnFelt += amount;
    }
  }

  return {
    contractViolationCost: input.contractViolationCost,
    contributions,
    narrativeExpression: input.narrativeExpression,
    repercussionCost: input.repercussionCost,
    turnFelt,
    utility:
      turnFelt - input.repercussionCost - input.contractViolationCost + input.narrativeExpression,
  };
}
