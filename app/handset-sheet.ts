import {
  clampHandsetSheetHeight,
  nearestHandsetSheetExtent,
  type HandsetSheetExtent,
  type HandsetSheetHeights,
} from './responsive-layout.js';

const INTERACTIVE_HEADER_SELECTOR = 'a, button, input, select, textarea, [contenteditable="true"]';

export interface HandsetSheetDragBinding {
  active: () => boolean;
  commit: (extent: HandsetSheetExtent) => void;
  currentHeight: () => number;
  extents: () => HandsetSheetHeights;
  handle: HTMLElement;
  preview: (height: number | null) => void;
}

function isInteractiveHeaderTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_HEADER_SELECTOR) !== null;
}

export function bindHandsetSheetDrag(binding: HandsetSheetDragBinding): () => void {
  let activePointerId: number | null = null;
  let previewHeight = 0;
  let startHeight = 0;
  let startY = 0;
  let previousCursor = '';
  let previousUserSelect = '';

  const restoreDocumentInteraction = (): void => {
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
    binding.handle.classList.remove('dragging');
  };

  const removeDragListeners = (): void => {
    binding.handle.removeEventListener('pointermove', onPointerMove);
    binding.handle.removeEventListener('pointerup', onPointerUp);
    binding.handle.removeEventListener('pointercancel', onPointerCancel);
    binding.handle.removeEventListener('lostpointercapture', onLostPointerCapture);
  };

  const finishDrag = (commit: boolean): void => {
    if (activePointerId === null) return;
    const pointerId = activePointerId;
    activePointerId = null;
    removeDragListeners();
    if (binding.handle.hasPointerCapture(pointerId))
      binding.handle.releasePointerCapture(pointerId);
    binding.preview(null);
    restoreDocumentInteraction();
    if (commit) binding.commit(nearestHandsetSheetExtent(previewHeight, binding.extents()));
  };

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return;
    if (!binding.active()) {
      finishDrag(false);
      return;
    }
    previewHeight = clampHandsetSheetHeight(
      startHeight + startY - event.clientY,
      binding.extents(),
    );
    binding.preview(previewHeight);
    event.preventDefault();
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerId === activePointerId) finishDrag(true);
  }

  function onPointerCancel(event: PointerEvent): void {
    if (event.pointerId === activePointerId) finishDrag(false);
  }

  function onLostPointerCapture(event: PointerEvent): void {
    if (event.pointerId === activePointerId) finishDrag(false);
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (
      !binding.active() ||
      event.button !== 0 ||
      !event.isPrimary ||
      isInteractiveHeaderTarget(event.target)
    ) {
      return;
    }
    event.preventDefault();
    activePointerId = event.pointerId;
    startHeight = binding.currentHeight();
    previewHeight = startHeight;
    startY = event.clientY;
    previousCursor = document.body.style.cursor;
    previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    binding.handle.classList.add('dragging');
    binding.handle.addEventListener('pointermove', onPointerMove);
    binding.handle.addEventListener('pointerup', onPointerUp);
    binding.handle.addEventListener('pointercancel', onPointerCancel);
    binding.handle.addEventListener('lostpointercapture', onLostPointerCapture);
    binding.handle.setPointerCapture(event.pointerId);
  };

  binding.handle.addEventListener('pointerdown', onPointerDown);
  return () => {
    binding.handle.removeEventListener('pointerdown', onPointerDown);
    finishDrag(false);
  };
}
