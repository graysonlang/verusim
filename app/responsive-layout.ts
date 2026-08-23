export const COMPACT_LAYOUT_MIN_WIDTH = 700;
export const WIDE_LAYOUT_MIN_WIDTH = 1080;

export type WorkbenchLayoutMode = 'compact' | 'handset' | 'wide';
export type NarrowPanelId = 'inspector' | 'roster';
export type HandsetSheetExtent = 'full' | 'half' | 'peek';

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
