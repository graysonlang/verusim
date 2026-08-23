import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  workbenchActionForShortcut,
  workbenchEscapeAction,
  zoomActionForShortcut,
  type ShortcutInput,
} from '../app/shortcuts.js';

function shortcut(code: string, overrides: Partial<ShortcutInput> = {}): ShortcutInput {
  return {
    altKey: false,
    code,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  };
}

describe('canvas zoom shortcuts', () => {
  it('zooms with the minus and equal keys across primary modifier variants', () => {
    for (const overrides of [{}, { shiftKey: true }, { metaKey: true }, { ctrlKey: true }]) {
      assert.equal(zoomActionForShortcut(shortcut('Minus', overrides)), 'zoom-out');
      assert.equal(zoomActionForShortcut(shortcut('Equal', overrides)), 'zoom-in');
    }
  });

  it('maps shifted number keys to fixed canvas views', () => {
    assert.equal(zoomActionForShortcut(shortcut('Digit0', { shiftKey: true })), 'actual-size');
    assert.equal(zoomActionForShortcut(shortcut('Digit1', { shiftKey: true })), 'fit-environment');
    assert.equal(zoomActionForShortcut(shortcut('Digit2', { shiftKey: true })), 'zoom-selection');
    assert.equal(zoomActionForShortcut(shortcut('Digit9', { shiftKey: true })), 'fit-environment');
  });

  it('leaves unrelated and alternate-modified keys available to the browser', () => {
    assert.equal(zoomActionForShortcut(shortcut('Digit0')), null);
    assert.equal(zoomActionForShortcut(shortcut('Equal', { altKey: true })), null);
    assert.equal(
      zoomActionForShortcut(shortcut('Digit1', { metaKey: true, shiftKey: true })),
      null,
    );
  });
});

describe('workbench shortcuts', () => {
  it('decays Escape from selection through exterior to fit', () => {
    assert.equal(
      workbenchEscapeAction({ hasOpenNarrowPanel: true, hasSelection: true, isExterior: false }),
      'close-narrow-panel',
    );
    assert.equal(
      workbenchEscapeAction({ hasOpenNarrowPanel: false, hasSelection: true, isExterior: false }),
      'clear-selection',
    );
    assert.equal(
      workbenchEscapeAction({
        hasOpenNarrowPanel: false,
        hasSelection: false,
        isExterior: false,
      }),
      'projection-exterior',
    );
    assert.equal(
      workbenchEscapeAction({ hasOpenNarrowPanel: false, hasSelection: false, isExterior: true }),
      'fit-environment',
    );
  });

  it('opens settings with the primary comma shortcut', () => {
    assert.equal(workbenchActionForShortcut(shortcut('Comma', { metaKey: true })), 'settings');
    assert.equal(workbenchActionForShortcut(shortcut('Comma', { ctrlKey: true })), 'settings');
    assert.equal(
      workbenchActionForShortcut(shortcut('Comma', { metaKey: true, shiftKey: true })),
      null,
    );
  });

  it('maps shifted letter keys to snapshot actions', () => {
    assert.equal(workbenchActionForShortcut(shortcut('KeyS', { shiftKey: true })), 'save-snapshot');
    assert.equal(
      workbenchActionForShortcut(shortcut('KeyR', { shiftKey: true })),
      'reset-scenario',
    );
  });

  it('maps projection and sidebar punctuation keys without alternate modifiers', () => {
    assert.equal(workbenchActionForShortcut(shortcut('BracketLeft')), 'projection-lower');
    assert.equal(workbenchActionForShortcut(shortcut('BracketRight')), 'projection-higher');
    assert.equal(workbenchActionForShortcut(shortcut('Backslash')), 'projection-exterior');
    assert.equal(
      workbenchActionForShortcut(shortcut('BracketLeft', { shiftKey: true })),
      'toggle-left-sidebar',
    );
    assert.equal(
      workbenchActionForShortcut(shortcut('BracketRight', { shiftKey: true })),
      'toggle-right-sidebar',
    );
    assert.equal(
      workbenchActionForShortcut(shortcut('Backslash', { shiftKey: true })),
      'toggle-sidebars',
    );
  });

  it('leaves modified punctuation shortcuts available to the host', () => {
    assert.equal(workbenchActionForShortcut(shortcut('BracketLeft', { metaKey: true })), null);
    assert.equal(
      workbenchActionForShortcut(shortcut('BracketRight', { ctrlKey: true, shiftKey: true })),
      null,
    );
    assert.equal(
      workbenchActionForShortcut(shortcut('Backslash', { altKey: true, shiftKey: true })),
      null,
    );
  });

  it('does not claim unshifted or command-modified letter keys', () => {
    assert.equal(workbenchActionForShortcut(shortcut('KeyS')), null);
    assert.equal(
      workbenchActionForShortcut(shortcut('KeyR', { metaKey: true, shiftKey: true })),
      null,
    );
  });
});
