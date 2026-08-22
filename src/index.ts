// `__APP_VERSION__` and `__COMMIT_SHA__` are substituted at build time by
// esbuild's `define` (see scripts/build.mjs). They are not runtime globals.
/* global __APP_VERSION__, __COMMIT_SHA__ */

export { VALUE_IDS } from './model/types.js';
export type * from './model/types.js';
export { parseCharacterLibrary, parseEnvironmentLibrary, parseScenario } from './scenario/parse.js';
export { serializeScenario } from './scenario/serialize.js';
export { appraiseAction } from './simulation/appraisal.js';
export {
  advanceSimulation,
  createSimulation,
  setAgentResource,
  setAgentValueCharge,
} from './simulation/runtime.js';
export { describeAgent, formatSimulationTime } from './simulation/observe.js';

export const buildInfo = Object.freeze({
  version: __APP_VERSION__,
  commit: __COMMIT_SHA__,
});
