import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseWorkbenchQuery, workbenchUrlForState } from '../app/url-state.js';

const SCENARIO_IDS = ['market-morning', 'alders-edge-town'] as const;

describe('workbench URL state', () => {
  it('accepts valid scenario and numeric rate overrides independently', () => {
    assert.deepEqual(parseWorkbenchQuery('?scenario=alders-edge-town&rate=1', SCENARIO_IDS), {
      rateId: 'real-time',
      scenarioId: 'alders-edge-town',
    });
    assert.deepEqual(parseWorkbenchQuery('?scenario=missing&rate=60', SCENARIO_IDS), {
      rateId: '1-minute-per-second',
      scenarioId: null,
    });
    assert.deepEqual(parseWorkbenchQuery('?scenario=market-morning&rate=59', SCENARIO_IDS), {
      rateId: null,
      scenarioId: 'market-morning',
    });
  });

  it('reads the former identifier once for URL compatibility', () => {
    assert.deepEqual(parseWorkbenchQuery('?timeRate=real-time', SCENARIO_IDS), {
      rateId: 'real-time',
      scenarioId: null,
    });
  });

  it('mirrors active selections without discarding unrelated URL state', () => {
    assert.equal(
      workbenchUrlForState('https://example.test/workbench?debug=1#activity', {
        rateId: '5x',
        scenarioId: 'alders-edge-town',
      }),
      '/workbench?debug=1&scenario=alders-edge-town&rate=5#activity',
    );
  });

  it('removes only the scenario parameter for a file-backed simulation', () => {
    assert.equal(
      workbenchUrlForState(
        'https://example.test/workbench?scenario=market-morning&timeRate=5x&debug=1#activity',
        {
          rateId: 'real-time',
          scenarioId: null,
        },
      ),
      '/workbench?debug=1&rate=1#activity',
    );
  });
});
