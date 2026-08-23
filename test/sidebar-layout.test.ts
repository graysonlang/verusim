import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LEFT_SIDEBAR_DEFAULT_WIDTH,
  RIGHT_SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  doubleClickSidebar,
  resizeSidebar,
  stepSidebar,
  toggleSidebar,
  toggleSidebarPair,
} from '../app/sidebar-layout.js';

describe('sidebar layout', () => {
  it('snaps across the close detent and clamps expanded widths', () => {
    assert.deepEqual(resizeSidebar(79, 1600, 250), { visible: false, width: 250 });
    assert.deepEqual(resizeSidebar(80, 1600, 250), {
      visible: true,
      width: SIDEBAR_MIN_WIDTH,
    });
    assert.deepEqual(resizeSidebar(500, 1600, 250), { visible: true, width: 400 });
  });

  it('preserves the expanded width through a visibility toggle', () => {
    const closed = toggleSidebar({ visible: true, width: 312 });
    assert.deepEqual(closed, { visible: false, width: 312 });
    assert.deepEqual(toggleSidebar(closed), { visible: true, width: 312 });
  });

  it('decays mixed sidebar visibility to hidden before showing both', () => {
    const left = { visible: true, width: 250 };
    const right = { visible: false, width: 380 };
    const hidden = toggleSidebarPair(left, right);
    assert.deepEqual(hidden, {
      left: { visible: false, width: 250 },
      right: { visible: false, width: 380 },
    });
    assert.deepEqual(toggleSidebarPair(hidden.left, hidden.right), {
      left: { visible: true, width: 250 },
      right: { visible: true, width: 380 },
    });
  });

  it('cycles double-click from custom to default to closed to default', () => {
    const reset = doubleClickSidebar({ visible: true, width: 312 }, LEFT_SIDEBAR_DEFAULT_WIDTH);
    assert.deepEqual(reset, { visible: true, width: LEFT_SIDEBAR_DEFAULT_WIDTH });
    const closed = doubleClickSidebar(reset, LEFT_SIDEBAR_DEFAULT_WIDTH);
    assert.deepEqual(closed, { visible: false, width: LEFT_SIDEBAR_DEFAULT_WIDTH });
    assert.deepEqual(doubleClickSidebar(closed, LEFT_SIDEBAR_DEFAULT_WIDTH), reset);
    assert.deepEqual(
      doubleClickSidebar({ visible: false, width: 420 }, RIGHT_SIDEBAR_DEFAULT_WIDTH),
      { visible: true, width: RIGHT_SIDEBAR_DEFAULT_WIDTH },
    );
  });

  it('lets keyboard resizing cross the detent in either direction', () => {
    const closed = stepSidebar({ visible: true, width: SIDEBAR_MIN_WIDTH }, 'shrink', 1600);
    assert.deepEqual(closed, { visible: false, width: SIDEBAR_MIN_WIDTH });
    assert.deepEqual(stepSidebar(closed, 'expand', 1600), {
      visible: true,
      width: SIDEBAR_MIN_WIDTH,
    });
  });
});
