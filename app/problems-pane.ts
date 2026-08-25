/**
 * The shared problems pane under the Build editor: a collapsible, resizable
 * strip with the same model as the sidebars. Collapsed keeps its header row
 * (title and count) visible; expanded shows the list at a remembered height.
 * Dragging snaps closed below a threshold and open above it, double-clicking
 * the edge returns to the default height or collapses when already there, and
 * the keyboard steps the height or returns Home to the default.
 */
export interface ProblemsPaneLayout {
  expanded: boolean;
  height: number;
}

export const PROBLEMS_PANE_DEFAULT_HEIGHT = 140;
export const PROBLEMS_PANE_MIN_HEIGHT = 72;
export const PROBLEMS_PANE_COLLAPSE_THRESHOLD = 40;
export const PROBLEMS_PANE_MAX_FRACTION = 0.6;
export const PROBLEMS_PANE_KEYBOARD_STEP = 10;

const PROBLEMS_PANE_MAX_STORED_HEIGHT = 1200;

export function isStoredProblemsPaneHeight(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= PROBLEMS_PANE_MIN_HEIGHT &&
    value <= PROBLEMS_PANE_MAX_STORED_HEIGHT
  );
}

export function problemsPaneMaximumHeight(containerHeight: number): number {
  return Math.max(
    PROBLEMS_PANE_MIN_HEIGHT,
    Math.floor(containerHeight * PROBLEMS_PANE_MAX_FRACTION),
  );
}

/** Snap closed below the threshold, snap open to the minimum above it, clamp otherwise. */
export function resizeProblemsPane(
  proposedHeight: number,
  containerHeight: number,
  previousExpandedHeight: number,
): ProblemsPaneLayout {
  if (!Number.isFinite(proposedHeight) || proposedHeight < PROBLEMS_PANE_COLLAPSE_THRESHOLD) {
    return { expanded: false, height: previousExpandedHeight };
  }
  const maximum = problemsPaneMaximumHeight(containerHeight);
  return {
    expanded: true,
    height: Math.round(Math.min(maximum, Math.max(PROBLEMS_PANE_MIN_HEIGHT, proposedHeight))),
  };
}

export function toggleProblemsPane(layout: ProblemsPaneLayout): ProblemsPaneLayout {
  return { ...layout, expanded: !layout.expanded };
}

/** Collapsed opens at the default; at the default collapses; any other height returns to the default. */
export function doubleClickProblemsPane(
  layout: ProblemsPaneLayout,
  defaultHeight: number = PROBLEMS_PANE_DEFAULT_HEIGHT,
): ProblemsPaneLayout {
  if (!layout.expanded) return { expanded: true, height: defaultHeight };
  if (layout.height === defaultHeight) return { expanded: false, height: defaultHeight };
  return { expanded: true, height: defaultHeight };
}

export function stepProblemsPane(
  layout: ProblemsPaneLayout,
  direction: 'expand' | 'shrink',
  containerHeight: number,
): ProblemsPaneLayout {
  if (!layout.expanded) {
    return direction === 'expand'
      ? resizeProblemsPane(PROBLEMS_PANE_COLLAPSE_THRESHOLD, containerHeight, layout.height)
      : layout;
  }
  if (direction === 'shrink' && layout.height === PROBLEMS_PANE_MIN_HEIGHT) {
    return resizeProblemsPane(PROBLEMS_PANE_COLLAPSE_THRESHOLD - 1, containerHeight, layout.height);
  }
  const delta = direction === 'expand' ? PROBLEMS_PANE_KEYBOARD_STEP : -PROBLEMS_PANE_KEYBOARD_STEP;
  return resizeProblemsPane(layout.height + delta, containerHeight, layout.height);
}

interface ProblemsPaneResizeBinding {
  commit: (layout: ProblemsPaneLayout) => void;
  containerHeight: () => number;
  defaultHeight: number;
  handle: HTMLElement;
  preview: (layout: ProblemsPaneLayout) => void;
  read: () => ProblemsPaneLayout;
}

/** Vertical drag on the pane's top edge; the handle sits above the header, so dragging up grows the pane. */
export function bindProblemsPaneResize(binding: ProblemsPaneResizeBinding): () => void {
  const { commit, containerHeight, defaultHeight, handle, preview, read } = binding;
  let activePointerId: number | null = null;
  let dragOrigin: ProblemsPaneLayout | null = null;
  let previewLayout: ProblemsPaneLayout | null = null;
  let startY = 0;
  let startHeight = 0;
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
    startY = event.clientY;
    startHeight = dragOrigin.expanded ? dragOrigin.height : 0;
    previousCursor = handle.ownerDocument.body.style.cursor;
    previousUserSelect = handle.ownerDocument.body.style.userSelect;
    handle.ownerDocument.body.style.cursor = 'row-resize';
    handle.ownerDocument.body.style.userSelect = 'none';
    handle.classList.add('dragging');
    handle.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId || dragOrigin === null) return;
    previewLayout = resizeProblemsPane(
      startHeight + (startY - event.clientY),
      containerHeight(),
      dragOrigin.height,
    );
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
    commit(doubleClickProblemsPane(read(), defaultHeight));
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Home') {
      event.preventDefault();
      commit({ expanded: true, height: defaultHeight });
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    commit(
      stepProblemsPane(read(), event.key === 'ArrowUp' ? 'expand' : 'shrink', containerHeight()),
    );
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
