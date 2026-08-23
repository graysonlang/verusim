export type ZoomActionId = 'actual-size' | 'fit-environment' | 'zoom-in' | 'zoom-out';

export interface ZoomShortcutInput {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function zoomActionForShortcut(input: ZoomShortcutInput): ZoomActionId | null {
  if (input.altKey) return null;

  if (input.shiftKey && !input.ctrlKey && !input.metaKey) {
    if (input.code === 'Digit0') return 'actual-size';
    if (input.code === 'Digit1' || input.code === 'Digit9') return 'fit-environment';
  }

  if (input.code === 'Minus') return 'zoom-out';
  if (input.code === 'Equal') return 'zoom-in';
  return null;
}
