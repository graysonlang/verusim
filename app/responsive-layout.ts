export const COMPACT_LAYOUT_MIN_WIDTH = 700;
export const WIDE_LAYOUT_MIN_WIDTH = 1080;

export type WorkbenchLayoutMode = 'compact' | 'handset' | 'wide';
export type NarrowPanelId = 'inspector' | 'roster';
export type HandsetSheetExtent = 'full' | 'half' | 'peek';
export type HandsetSheetAction = 'contract' | 'expand';

export interface HandsetSheetHeights {
  full: number;
  half: number;
  peek: number;
}

export interface NarrowPanelState {
  activePanel: NarrowPanelId | null;
  extent: HandsetSheetExtent;
  lastPanel: NarrowPanelId;
}

export interface EffectivePanelVisibility {
  inspector: boolean;
  resizable: boolean;
  roster: boolean;
}

export const DEFAULT_NARROW_PANEL_STATE: NarrowPanelState = Object.freeze({
  activePanel: null,
  extent: 'half',
  lastPanel: 'roster',
});

export const HANDSET_SHEET_PEEK_HEIGHT = 58;
export const HANDSET_SHEET_HALF_RATIO = 0.54;
export const HANDSET_SHEET_HALF_MAX_HEIGHT = 480;

const HANDSET_SHEET_ICON_PATHS = {
  contract: ['M13.25 2.75 9.5 6.5m0 0v-3m0 3h3', 'M2.75 13.25 6.5 9.5m0 0v3m0-3h-3'],
  expand: ['M9.5 6.5l3.75-3.75m0 0h-3m3 0v3', 'M6.5 9.5l-3.75 3.75m0 0h3m-3 0v-3'],
} as const satisfies Record<HandsetSheetAction, readonly [string, string]>;

export function workbenchLayoutMode(width: number): WorkbenchLayoutMode {
  if (Number.isFinite(width) && width >= WIDE_LAYOUT_MIN_WIDTH) return 'wide';
  if (Number.isFinite(width) && width >= COMPACT_LAYOUT_MIN_WIDTH) return 'compact';
  return 'handset';
}

export function effectivePanelVisibility(
  mode: WorkbenchLayoutMode,
  wide: { inspector: boolean; roster: boolean },
  narrow: NarrowPanelState,
): EffectivePanelVisibility {
  if (mode === 'wide') return { ...wide, resizable: true };
  return {
    inspector: narrow.activePanel === 'inspector',
    resizable: false,
    roster: narrow.activePanel === 'roster',
  };
}

export function toggleNarrowPanel(state: NarrowPanelState, panel: NarrowPanelId): NarrowPanelState {
  if (state.activePanel === panel) {
    if (state.extent === 'peek') return { ...state, extent: 'half' };
    return { ...state, activePanel: null, lastPanel: panel };
  }
  return { activePanel: panel, extent: 'half', lastPanel: panel };
}

export function toggleNarrowPanelPair(state: NarrowPanelState): NarrowPanelState {
  return state.activePanel === null
    ? { ...state, activePanel: state.lastPanel, extent: 'half' }
    : { ...state, activePanel: null };
}

export function closeNarrowPanel(state: NarrowPanelState): NarrowPanelState {
  return state.activePanel === null ? state : { ...state, activePanel: null };
}

export function narrowPanelAfterRosterSelection(
  mode: WorkbenchLayoutMode,
  state: NarrowPanelState,
): NarrowPanelState {
  return mode === 'handset' && state.activePanel === 'roster'
    ? { ...state, extent: 'peek' }
    : state;
}

export function cycleHandsetSheetExtent(state: NarrowPanelState): NarrowPanelState {
  if (state.activePanel === null) return state;
  if (state.extent === 'peek') return { ...state, extent: 'half' };
  return { ...state, extent: state.extent === 'half' ? 'full' : 'half' };
}

export function handsetSheetAction(extent: HandsetSheetExtent): HandsetSheetAction {
  return extent === 'full' ? 'contract' : 'expand';
}

export function handsetSheetIconPaths(action: HandsetSheetAction): readonly [string, string] {
  return HANDSET_SHEET_ICON_PATHS[action];
}

export function handsetSheetHeights(shellHeight: number, fullHeight: number): HandsetSheetHeights {
  const full = Math.max(
    HANDSET_SHEET_PEEK_HEIGHT,
    Number.isFinite(fullHeight) ? fullHeight : HANDSET_SHEET_PEEK_HEIGHT,
  );
  const availableShellHeight = Number.isFinite(shellHeight) ? shellHeight : full;
  const half = Math.max(
    HANDSET_SHEET_PEEK_HEIGHT,
    Math.min(full, HANDSET_SHEET_HALF_MAX_HEIGHT, availableShellHeight * HANDSET_SHEET_HALF_RATIO),
  );
  return { full, half, peek: HANDSET_SHEET_PEEK_HEIGHT };
}

export function clampHandsetSheetHeight(height: number, extents: HandsetSheetHeights): number {
  const candidate = Number.isFinite(height) ? height : extents.half;
  return Math.min(extents.full, Math.max(extents.peek, candidate));
}

export function nearestHandsetSheetExtent(
  height: number,
  extents: HandsetSheetHeights,
): HandsetSheetExtent {
  const clamped = clampHandsetSheetHeight(height, extents);
  const candidates: HandsetSheetExtent[] = ['peek', 'half', 'full'];
  return candidates.reduce((nearest, candidate) =>
    Math.abs(extents[candidate] - clamped) < Math.abs(extents[nearest] - clamped)
      ? candidate
      : nearest,
  );
}
