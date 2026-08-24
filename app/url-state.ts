import type { TimeRateId } from '../src/model/types.js';
import { isTimeRateId } from './preferences.js';
import { PLAYBACK_RATES, playbackRateForId } from './playback.js';

export const SCENARIO_QUERY_PARAMETER = 'scenario';
export const RATE_QUERY_PARAMETER = 'rate';
const LEGACY_TIME_RATE_QUERY_PARAMETER = 'timeRate';

export interface WorkbenchQueryState {
  rateId: TimeRateId | null;
  scenarioId: string | null;
}

export interface ActiveWorkbenchUrlState {
  rateId: TimeRateId;
  scenarioId: string | null;
}

export function parseWorkbenchQuery(
  search: string,
  builtInScenarioIds: readonly string[],
): WorkbenchQueryState {
  const parameters = new URLSearchParams(search);
  const scenarioId = parameters.get(SCENARIO_QUERY_PARAMETER);
  const rateValue = parameters.get(RATE_QUERY_PARAMETER);
  const rate =
    rateValue === null || rateValue.trim() === ''
      ? undefined
      : PLAYBACK_RATES.find(candidate => candidate.rate === Number(rateValue));
  const legacyTimeRateId = parameters.get(LEGACY_TIME_RATE_QUERY_PARAMETER);
  return {
    rateId:
      rate?.id ??
      (legacyTimeRateId !== null && isTimeRateId(legacyTimeRateId) ? legacyTimeRateId : null),
    scenarioId: scenarioId !== null && builtInScenarioIds.includes(scenarioId) ? scenarioId : null,
  };
}

export function workbenchUrlForState(currentUrl: string, state: ActiveWorkbenchUrlState): string {
  const url = new URL(currentUrl);
  if (state.scenarioId === null) url.searchParams.delete(SCENARIO_QUERY_PARAMETER);
  else url.searchParams.set(SCENARIO_QUERY_PARAMETER, state.scenarioId);
  url.searchParams.set(RATE_QUERY_PARAMETER, String(playbackRateForId(state.rateId).rate));
  url.searchParams.delete(LEGACY_TIME_RATE_QUERY_PARAMETER);
  return `${url.pathname}${url.search}${url.hash}`;
}
