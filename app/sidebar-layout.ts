export type SidebarEdge = 'left' | 'right';

export interface SidebarLayout {
  visible: boolean;
  width: number;
}

export const LEFT_SIDEBAR_DEFAULT_WIDTH = 250;
export const RIGHT_SIDEBAR_DEFAULT_WIDTH = 350;
export const SIDEBAR_COLLAPSE_THRESHOLD = 80;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_VIEWPORT_FRACTION = 0.25;
export const SIDEBAR_KEYBOARD_STEP = 10;

const SIDEBAR_MAX_STORED_WIDTH = 1200;

export function isStoredSidebarWidth(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= SIDEBAR_MIN_WIDTH &&
    value <= SIDEBAR_MAX_STORED_WIDTH
  );
}

export function sidebarMaximumWidth(viewportWidth: number): number {
  return Math.max(SIDEBAR_MIN_WIDTH, Math.floor(viewportWidth * SIDEBAR_MAX_VIEWPORT_FRACTION));
}

export function resizeSidebar(
  proposedWidth: number,
  viewportWidth: number,
  previousExpandedWidth: number,
): SidebarLayout {
  if (!Number.isFinite(proposedWidth) || proposedWidth < SIDEBAR_COLLAPSE_THRESHOLD) {
    return { visible: false, width: previousExpandedWidth };
  }
  const maximum = sidebarMaximumWidth(viewportWidth);
  return {
    visible: true,
    width: Math.round(Math.min(maximum, Math.max(SIDEBAR_MIN_WIDTH, proposedWidth))),
  };
}

export function toggleSidebar(layout: SidebarLayout): SidebarLayout {
  return { ...layout, visible: !layout.visible };
}

export function toggleSidebarPair(
  left: SidebarLayout,
  right: SidebarLayout,
): { left: SidebarLayout; right: SidebarLayout } {
  const visible = !(left.visible || right.visible);
  return {
    left: { ...left, visible },
    right: { ...right, visible },
  };
}

export function doubleClickSidebar(layout: SidebarLayout, defaultWidth: number): SidebarLayout {
  if (!layout.visible) return { visible: true, width: defaultWidth };
  if (layout.width === defaultWidth) return { visible: false, width: defaultWidth };
  return { visible: true, width: defaultWidth };
}

export function stepSidebar(
  layout: SidebarLayout,
  direction: 'expand' | 'shrink',
  viewportWidth: number,
): SidebarLayout {
  if (!layout.visible) {
    return direction === 'expand'
      ? resizeSidebar(SIDEBAR_COLLAPSE_THRESHOLD, viewportWidth, layout.width)
      : layout;
  }
  if (direction === 'shrink' && layout.width === SIDEBAR_MIN_WIDTH) {
    return resizeSidebar(SIDEBAR_COLLAPSE_THRESHOLD - 1, viewportWidth, layout.width);
  }
  const delta = direction === 'expand' ? SIDEBAR_KEYBOARD_STEP : -SIDEBAR_KEYBOARD_STEP;
  return resizeSidebar(layout.width + delta, viewportWidth, layout.width);
}

interface SidebarResizeBinding {
  commit: (layout: SidebarLayout) => void;
  defaultWidth: number;
  edge: SidebarEdge;
  handle: HTMLElement;
  preview: (layout: SidebarLayout) => void;
  read: () => SidebarLayout;
  viewportWidth: () => number;
}

export function bindSidebarResize(binding: SidebarResizeBinding): () => void {
  const { commit, defaultWidth, edge, handle, preview, read, viewportWidth } = binding;
  let activePointerId: number | null = null;
  let dragOrigin: SidebarLayout | null = null;
  let previewLayout: SidebarLayout | null = null;
  let startX = 0;
  let startWidth = 0;
  let previousCursor = '';
  let previousUserSelect = '';

  const finishDrag = (commitPreview: boolean): void => {
    if (activePointerId === null) return;
    if (handle.hasPointerCapture(activePointerId)) handle.releasePointerCapture(activePointerId);
    handle.classList.remove('dragging');
    handle.ownerDocument.body.style.cursor = previousCursor;
    handle.ownerDocument.body.style.userSelect = previousUserSelect;
    if (commitPreview && previewLayout !== null) commit(previewLayout);
    if (!commitPreview && dragOrigin !== null) preview(dragOrigin);
    activePointerId = null;
    dragOrigin = null;
    previewLayout = null;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || activePointerId !== null) return;
    event.preventDefault();
    dragOrigin = read();
    previewLayout = dragOrigin;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startWidth = dragOrigin.visible ? dragOrigin.width : 0;
    previousCursor = handle.ownerDocument.body.style.cursor;
    previousUserSelect = handle.ownerDocument.body.style.userSelect;
    handle.ownerDocument.body.style.cursor = 'col-resize';
    handle.ownerDocument.body.style.userSelect = 'none';
    handle.classList.add('dragging');
    handle.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId || dragOrigin === null) return;
    const horizontalDelta = event.clientX - startX;
    const widthDelta = edge === 'left' ? horizontalDelta : -horizontalDelta;
    previewLayout = resizeSidebar(startWidth + widthDelta, viewportWidth(), dragOrigin.width);
    preview(previewLayout);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId === activePointerId) finishDrag(true);
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === activePointerId) finishDrag(false);
  };

  const onDoubleClick = (event: MouseEvent): void => {
    event.preventDefault();
    commit(doubleClickSidebar(read(), defaultWidth));
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Home') {
      event.preventDefault();
      commit({ visible: true, width: defaultWidth });
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const expands =
      (edge === 'left' && event.key === 'ArrowRight') ||
      (edge === 'right' && event.key === 'ArrowLeft');
    commit(stepSidebar(read(), expands ? 'expand' : 'shrink', viewportWidth()));
  };

  handle.addEventListener('dblclick', onDoubleClick);
  handle.addEventListener('keydown', onKeyDown);
  handle.addEventListener('pointercancel', onPointerCancel);
  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);

  return () => {
    finishDrag(false);
    handle.removeEventListener('dblclick', onDoubleClick);
    handle.removeEventListener('keydown', onKeyDown);
    handle.removeEventListener('pointercancel', onPointerCancel);
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', onPointerUp);
  };
}
