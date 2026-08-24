import type { TimeRateId } from '../src/model/types.js';
import { isTimeRateId } from './preferences.js';

export const SCENARIO_QUERY_PARAMETER = 'scenario';
export const TIME_RATE_QUERY_PARAMETER = 'timeRate';

export interface WorkbenchQueryState {
  scenarioId: string | null;
  timeRateId: TimeRateId | null;
}

export interface ActiveWorkbenchUrlState {
  scenarioId: string | null;
  timeRateId: TimeRateId;
}

export function parseWorkbenchQuery(
  search: string,
  builtInScenarioIds: readonly string[],
): WorkbenchQueryState {
  const parameters = new URLSearchParams(search);
  const scenarioId = parameters.get(SCENARIO_QUERY_PARAMETER);
  const timeRateId = parameters.get(TIME_RATE_QUERY_PARAMETER);
  return {
    scenarioId: scenarioId !== null && builtInScenarioIds.includes(scenarioId) ? scenarioId : null,
    timeRateId: timeRateId !== null && isTimeRateId(timeRateId) ? timeRateId : null,
  };
}

export function workbenchUrlForState(currentUrl: string, state: ActiveWorkbenchUrlState): string {
  const url = new URL(currentUrl);
  if (state.scenarioId === null) url.searchParams.delete(SCENARIO_QUERY_PARAMETER);
  else url.searchParams.set(SCENARIO_QUERY_PARAMETER, state.scenarioId);
  url.searchParams.set(TIME_RATE_QUERY_PARAMETER, state.timeRateId);
  return `${url.pathname}${url.search}${url.hash}`;
}
