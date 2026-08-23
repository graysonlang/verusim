import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  workbenchActionForShortcut,
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
  it('maps shifted letter keys to snapshot actions', () => {
    assert.equal(workbenchActionForShortcut(shortcut('KeyS', { shiftKey: true })), 'save-snapshot');
    assert.equal(
      workbenchActionForShortcut(shortcut('KeyR', { shiftKey: true })),
      'reset-scenario',
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
