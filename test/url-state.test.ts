import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseWorkbenchQuery, workbenchUrlForState } from '../app/url-state.js';

const SCENARIO_IDS = ['market-morning', 'alders-edge-town'] as const;

describe('workbench URL state', () => {
  it('accepts valid scenario and time-rate overrides independently', () => {
    assert.deepEqual(
      parseWorkbenchQuery('?scenario=alders-edge-town&timeRate=real-time', SCENARIO_IDS),
      {
        scenarioId: 'alders-edge-town',
        timeRateId: 'real-time',
      },
    );
    assert.deepEqual(parseWorkbenchQuery('?scenario=missing&timeRate=10x', SCENARIO_IDS), {
      scenarioId: null,
      timeRateId: '10x',
    });
    assert.deepEqual(
      parseWorkbenchQuery('?scenario=market-morning&timeRate=warp-speed', SCENARIO_IDS),
      {
        scenarioId: 'market-morning',
        timeRateId: null,
      },
    );
  });

  it('mirrors active selections without discarding unrelated URL state', () => {
    assert.equal(
      workbenchUrlForState('https://example.test/workbench?debug=1#activity', {
        scenarioId: 'alders-edge-town',
        timeRateId: '5x',
      }),
      '/workbench?debug=1&scenario=alders-edge-town&timeRate=5x#activity',
    );
  });

  it('removes only the scenario parameter for a file-backed simulation', () => {
    assert.equal(
      workbenchUrlForState(
        'https://example.test/workbench?scenario=market-morning&timeRate=5x&debug=1#activity',
        {
          scenarioId: null,
          timeRateId: 'real-time',
        },
      ),
      '/workbench?timeRate=real-time&debug=1#activity',
    );
  });
});
