import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePreferences } from '../app/preferences.js';
import {
  PROBLEMS_PANE_COLLAPSE_THRESHOLD,
  PROBLEMS_PANE_DEFAULT_HEIGHT,
  PROBLEMS_PANE_MIN_HEIGHT,
  doubleClickProblemsPane,
  problemsPaneMaximumHeight,
  resizeProblemsPane,
  stepProblemsPane,
  toggleProblemsPane,
} from '../app/problems-pane.js';

describe('problems pane layout', () => {
  it('snaps closed below the threshold and open to the minimum above it', () => {
    assert.deepEqual(resizeProblemsPane(PROBLEMS_PANE_COLLAPSE_THRESHOLD - 1, 600, 200), {
      expanded: false,
      height: 200,
    });
    assert.deepEqual(resizeProblemsPane(PROBLEMS_PANE_COLLAPSE_THRESHOLD, 600, 200), {
      expanded: true,
      height: PROBLEMS_PANE_MIN_HEIGHT,
    });
    assert.deepEqual(resizeProblemsPane(150.4, 600, 200), { expanded: true, height: 150 });
    assert.deepEqual(resizeProblemsPane(5000, 600, 200), {
      expanded: true,
      height: problemsPaneMaximumHeight(600),
    });
    assert.equal(problemsPaneMaximumHeight(600), 360);
    assert.equal(problemsPaneMaximumHeight(50), PROBLEMS_PANE_MIN_HEIGHT);
  });

  it('double-click returns to the default height or collapses when already there', () => {
    const collapsed = { expanded: false, height: 220 };
    assert.deepEqual(doubleClickProblemsPane(collapsed), {
      expanded: true,
      height: PROBLEMS_PANE_DEFAULT_HEIGHT,
    });
    assert.deepEqual(doubleClickProblemsPane({ expanded: true, height: 220 }), {
      expanded: true,
      height: PROBLEMS_PANE_DEFAULT_HEIGHT,
    });
    assert.deepEqual(
      doubleClickProblemsPane({ expanded: true, height: PROBLEMS_PANE_DEFAULT_HEIGHT }),
      { expanded: false, height: PROBLEMS_PANE_DEFAULT_HEIGHT },
    );
    assert.deepEqual(toggleProblemsPane(collapsed), { expanded: true, height: 220 });
  });

  it('steps by keyboard through the collapse boundary in both directions', () => {
    const atMinimum = { expanded: true, height: PROBLEMS_PANE_MIN_HEIGHT };
    assert.deepEqual(stepProblemsPane(atMinimum, 'shrink', 600), {
      expanded: false,
      height: PROBLEMS_PANE_MIN_HEIGHT,
    });
    assert.deepEqual(stepProblemsPane({ expanded: false, height: 180 }, 'expand', 600), {
      expanded: true,
      height: PROBLEMS_PANE_MIN_HEIGHT,
    });
    assert.deepEqual(stepProblemsPane({ expanded: false, height: 180 }, 'shrink', 600), {
      expanded: false,
      height: 180,
    });
    assert.deepEqual(stepProblemsPane({ expanded: true, height: 180 }, 'expand', 600), {
      expanded: true,
      height: 190,
    });
  });

  it('persists through preferences with validated defaults', () => {
    const defaults = parsePreferences({});
    assert.equal(defaults.problemsPaneExpanded, false);
    assert.equal(defaults.problemsPaneHeight, PROBLEMS_PANE_DEFAULT_HEIGHT);
    const stored = parsePreferences({ problemsPaneExpanded: true, problemsPaneHeight: 210 });
    assert.equal(stored.problemsPaneExpanded, true);
    assert.equal(stored.problemsPaneHeight, 210);
    assert.equal(
      parsePreferences({ problemsPaneHeight: 3 }).problemsPaneHeight,
      PROBLEMS_PANE_DEFAULT_HEIGHT,
    );
  });
});
