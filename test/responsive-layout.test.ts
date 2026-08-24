import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_NARROW_PANEL_STATE,
  clampHandsetSheetHeight,
  closeNarrowPanel,
  cycleHandsetSheetExtent,
  effectivePanelVisibility,
  handsetSheetAction,
  handsetSheetHeights,
  narrowPanelAfterRosterSelection,
  nearestHandsetSheetExtent,
  toggleNarrowPanel,
  toggleNarrowPanelPair,
  workbenchLayoutMode,
} from '../app/responsive-layout.js';

describe('responsive workbench layout', () => {
  it('classifies shell widths at the compact and wide boundaries', () => {
    assert.equal(workbenchLayoutMode(699), 'handset');
    assert.equal(workbenchLayoutMode(700), 'compact');
    assert.equal(workbenchLayoutMode(1079), 'compact');
    assert.equal(workbenchLayoutMode(1080), 'wide');
  });

  it('uses wide preferences only in wide mode', () => {
    const wide = { inspector: true, roster: false };
    assert.deepEqual(effectivePanelVisibility('wide', wide, DEFAULT_NARROW_PANEL_STATE), {
      inspector: true,
      resizable: true,
      roster: false,
    });
    const narrow = toggleNarrowPanel(DEFAULT_NARROW_PANEL_STATE, 'roster');
    assert.deepEqual(effectivePanelVisibility('compact', wide, narrow), {
      inspector: false,
      resizable: false,
      roster: true,
    });
    assert.deepEqual(wide, { inspector: true, roster: false });
  });

  it('keeps narrow panels mutually exclusive and remembers the last panel', () => {
    const roster = toggleNarrowPanel(DEFAULT_NARROW_PANEL_STATE, 'roster');
    const inspector = toggleNarrowPanel(roster, 'inspector');
    assert.deepEqual(inspector, {
      activePanel: 'inspector',
      extent: 'half',
      lastPanel: 'inspector',
    });
    const closed = toggleNarrowPanel(inspector, 'inspector');
    assert.equal(closed.activePanel, null);
    assert.equal(toggleNarrowPanelPair(closed).activePanel, 'inspector');
    assert.equal(toggleNarrowPanelPair(inspector).activePanel, null);
  });

  it('peeks after handset roster selection and reopens before closing', () => {
    const roster = toggleNarrowPanel(DEFAULT_NARROW_PANEL_STATE, 'roster');
    const peek = narrowPanelAfterRosterSelection('handset', roster);
    assert.equal(peek.extent, 'peek');
    assert.equal(toggleNarrowPanel(peek, 'roster').extent, 'half');
    assert.equal(narrowPanelAfterRosterSelection('compact', roster), roster);
  });

  it('cycles handset extent and closes without changing the remembered panel', () => {
    const half = toggleNarrowPanel(DEFAULT_NARROW_PANEL_STATE, 'roster');
    const full = cycleHandsetSheetExtent(half);
    assert.equal(full.extent, 'full');
    assert.equal(cycleHandsetSheetExtent(full).extent, 'half');
    assert.deepEqual(closeNarrowPanel(full), {
      activePanel: null,
      extent: 'full',
      lastPanel: 'roster',
    });
  });

  it('describes the next sheet action instead of its current extent', () => {
    assert.equal(handsetSheetAction('peek'), 'expand');
    assert.equal(handsetSheetAction('half'), 'expand');
    assert.equal(handsetSheetAction('full'), 'contract');
  });

  it('derives, clamps, and snaps handset sheet heights', () => {
    const extents = handsetSheetHeights(844, 744);
    assert.equal(extents.full, 744);
    assert.equal(extents.peek, 58);
    assert.ok(Math.abs(extents.half - 455.76) < 1e-9);
    assert.equal(clampHandsetSheetHeight(20, extents), 58);
    assert.equal(clampHandsetSheetHeight(900, extents), 744);
    assert.equal(nearestHandsetSheetExtent(80, extents), 'peek');
    assert.equal(nearestHandsetSheetExtent(400, extents), 'half');
    assert.equal(nearestHandsetSheetExtent(700, extents), 'full');
  });

  it('keeps sheet extents ordered in short or malformed viewports', () => {
    assert.deepEqual(handsetSheetHeights(80, 40), { full: 58, half: 58, peek: 58 });
    assert.deepEqual(handsetSheetHeights(Number.NaN, Number.NaN), {
      full: 58,
      half: 58,
      peek: 58,
    });
  });
});
