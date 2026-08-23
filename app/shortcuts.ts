export type ZoomActionId =
  | 'actual-size'
  | 'fit-environment'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-selection';
export type WorkbenchShortcutActionId =
  | ZoomActionId
  | 'reset-scenario'
  | 'save-snapshot'
  | 'settings';

export interface ShortcutInput {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
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

  if (input.shiftKey && !input.altKey && !input.ctrlKey && !input.metaKey) {
    if (input.code === 'KeyR') return 'reset-scenario';
    if (input.code === 'KeyS') return 'save-snapshot';
  }
  return null;
}
