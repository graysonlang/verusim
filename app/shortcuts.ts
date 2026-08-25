export type ZoomActionId =
  | 'actual-size'
  | 'fit-environment'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-selection';
export type WorkbenchShortcutActionId =
  | ZoomActionId
  | 'projection-exterior'
  | 'projection-higher'
  | 'projection-lower'
  | 'reset-scenario'
  | 'save-snapshot'
  | 'settings'
  | 'toggle-left-sidebar'
  | 'toggle-mode'
  | 'toggle-right-sidebar'
  | 'toggle-sidebars';

export interface ShortcutInput {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export type WorkbenchEscapeActionId =
  | 'clear-selection'
  | 'close-narrow-panel'
  | 'fit-environment'
  | 'projection-exterior';

export type CanvasBackgroundActionId = 'clear-selection' | 'projection-exterior' | null;

export function canvasBackgroundAction(input: {
  hasSelection: boolean;
  isExterior: boolean;
}): CanvasBackgroundActionId {
  if (input.hasSelection) return 'clear-selection';
  return input.isExterior ? null : 'projection-exterior';
}

export function workbenchEscapeAction(input: {
  hasOpenNarrowPanel: boolean;
  hasSelection: boolean;
  isExterior: boolean;
}): WorkbenchEscapeActionId {
  if (input.hasOpenNarrowPanel) return 'close-narrow-panel';
  return canvasBackgroundAction(input) ?? 'fit-environment';
}

export function zoomActionForShortcut(input: ShortcutInput): ZoomActionId | null {
  if (input.altKey) return null;

  if (input.shiftKey && !input.ctrlKey && !input.metaKey) {
    if (input.code === 'Digit0') return 'actual-size';
    if (input.code === 'Digit1' || input.code === 'Digit9') return 'fit-environment';
    if (input.code === 'Digit2') return 'zoom-selection';
  }

  if (input.code === 'Minus') return 'zoom-out';
  if (input.code === 'Equal') return 'zoom-in';
  return null;
}

export function workbenchActionForShortcut(input: ShortcutInput): WorkbenchShortcutActionId | null {
  if (
    input.code === 'Comma' &&
    !input.altKey &&
    !input.shiftKey &&
    ((input.metaKey && !input.ctrlKey) || (input.ctrlKey && !input.metaKey))
  ) {
    return 'settings';
  }
  const zoomAction = zoomActionForShortcut(input);
  if (zoomAction !== null) return zoomAction;

  if (!input.altKey && !input.ctrlKey && !input.metaKey) {
    if (input.shiftKey) {
      if (input.code === 'Backslash') return 'toggle-sidebars';
      if (input.code === 'BracketLeft') return 'toggle-left-sidebar';
      if (input.code === 'BracketRight') return 'toggle-right-sidebar';
    } else {
      if (input.code === 'Backslash') return 'projection-exterior';
      if (input.code === 'BracketLeft') return 'projection-lower';
      if (input.code === 'BracketRight') return 'projection-higher';
    }
  }

  if (input.shiftKey && !input.altKey && !input.ctrlKey && !input.metaKey) {
    if (input.code === 'KeyB') return 'toggle-mode';
    if (input.code === 'KeyR') return 'reset-scenario';
    if (input.code === 'KeyS') return 'save-snapshot';
  }
  return null;
}
