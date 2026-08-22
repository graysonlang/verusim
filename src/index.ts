// `__APP_VERSION__` and `__COMMIT_SHA__` are substituted at build time by
// esbuild's `define` (see scripts/build.mjs). They are not runtime globals.
/* global __APP_VERSION__, __COMMIT_SHA__ */

export { SOCIAL_FEATURE_IDS, VALUE_IDS } from './model/types.js';
export type * from './model/types.js';
export { parseCharacterLibrary, parseEnvironmentLibrary, parseScenario } from './scenario/parse.js';
export { serializeScenario, serializeSnapshot } from './scenario/serialize.js';
export { parseSnapshot } from './scenario/snapshot.js';
export { appraiseAction } from './simulation/appraisal.js';
export { evaluateOpportunity, resolveOpportunity } from './simulation/decision.js';
export {
  evaluateDisclosureOpportunity,
  resolveDisclosureOpportunity,
} from './simulation/disclosure.js';
export { evaluateEmpathy } from './simulation/empathy.js';
export {
  advanceSimulation,
  createSimulation,
  createSimulationFromSnapshot,
  setAgentResource,
  setAgentValueCharge,
} from './simulation/runtime.js';
export { describeAgent, formatSimulationTime } from './simulation/observe.js';
export { effectiveValueWeights } from './simulation/salience.js';

export const buildInfo = Object.freeze({
  version: __APP_VERSION__,
  commit: __COMMIT_SHA__,
});
