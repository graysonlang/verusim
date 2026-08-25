import { button, element } from '../dom.js';
import type { EditorCamera } from '../workspace.js';
import { getAtPath } from './paths.js';

/**
 * Spatial editor for environment layouts. It draws one layer of a layout draft
 * - areas, locations, and connector endpoints - and lets the author pan, zoom,
 * select a location, drag it, and nudge it with the keyboard. Every geometry
 * change is reported as one path edit; the camera is reported when a gesture
 * settles so the workspace owns it without re-rendering on every pointer move.
 */
export interface CanvasHandlers {
  onCamera: (camera: EditorCamera) => void;
  onMoveLocation: (index: number, x: number, y: number, label: string) => void;
  onSelectPath: (path: string | null) => void;
}

export interface CanvasRenderOptions {
  camera: EditorCamera | null;
  /** The environment-layout draft (the resource file, with `layout` inside). */
  draft: unknown;
  selectedPath: string | null;
}

export interface LayoutCanvas {
  element: HTMLElement;
  render: (options: CanvasRenderOptions) => void;
}

interface Rect {
  height: number;
  id: string;
  kind?: string;
  layerId: string;
  name?: string;
  width: number;
  x: number;
  y: number;
}

interface LayoutShape {
  areas: Rect[];
  connectors: {
    from: { layerId: string; x: number; y: number };
    id: string;
    to: { layerId: string; x: number; y: number };
  }[];
  height: number;
  layers: { id: string; name: string }[];
  locations: Rect[];
  width: number;
}

const PIXELS_PER_METER = 10;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;
const NUDGE_METERS = 0.5;
const NUDGE_LARGE_METERS = 5;

const AREA_FILLS: Record<string, string> = {
  building: 'rgb(160 122 74 / 55%)',
  field: 'rgb(178 158 74 / 40%)',
  forest: 'rgb(42 96 58 / 55%)',
  grass: 'rgb(84 132 76 / 40%)',
  market: 'rgb(172 140 92 / 45%)',
  path: 'rgb(150 140 120 / 55%)',
  water: 'rgb(60 110 150 / 55%)',
};

function rects(value: unknown): Rect[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (item === null || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const numbers = [record.x, record.y, record.width, record.height];
    if (!numbers.every(entry => typeof entry === 'number' && Number.isFinite(entry))) return [];
    return [
      {
        height: record.height as number,
        id: typeof record.id === 'string' ? record.id : '',
        kind: typeof record.kind === 'string' ? record.kind : undefined,
        layerId: typeof record.layerId === 'string' ? record.layerId : '',
        name: typeof record.name === 'string' ? record.name : undefined,
        width: record.width as number,
        x: record.x as number,
        y: record.y as number,
      },
    ];
  });
}

function shapeOf(draft: unknown): LayoutShape {
  const layout = getAtPath(draft, 'layout');
  const layers = getAtPath(layout, 'layers');
  const connectors = getAtPath(layout, 'connectors');
  const width = getAtPath(layout, 'width');
  const height = getAtPath(layout, 'height');
  return {
    areas: rects(getAtPath(layout, 'areas')),
    connectors: Array.isArray(connectors)
      ? connectors.flatMap(item => {
          const from = getAtPath(item, 'from');
          const to = getAtPath(item, 'to');
          if (from === null || typeof from !== 'object' || to === null || typeof to !== 'object') {
            return [];
          }
          return [
            {
              from: from as { layerId: string; x: number; y: number },
              id: String(getAtPath(item, 'id') ?? ''),
              to: to as { layerId: string; x: number; y: number },
            },
          ];
        })
      : [],
    height: typeof height === 'number' ? height : 100,
    layers: Array.isArray(layers)
      ? layers.flatMap(layer => {
          const id = getAtPath(layer, 'id');
          const name = getAtPath(layer, 'name');
          return typeof id === 'string' ? [{ id, name: typeof name === 'string' ? name : id }] : [];
        })
      : [],
    locations: rects(getAtPath(layout, 'locations')),
    width: typeof width === 'number' ? width : 100,
  };
}

function locationIndexFromPath(path: string | null): number | null {
  const match = path === null ? null : /^layout\.locations\[(\d+)\]/.exec(path);
  return match === null ? null : Number(match[1]);
}

export function fitCamera(
  shape: LayoutShape,
  layerId: string | null,
  viewport: { height: number; width: number },
): EditorCamera {
  const zoom = Math.max(
    ZOOM_MIN,
    Math.min(
      ZOOM_MAX,
      Math.min(
        viewport.width / (shape.width * PIXELS_PER_METER),
        viewport.height / (shape.height * PIXELS_PER_METER),
      ) * 0.9,
    ),
  );
  return {
    layerId: layerId ?? shape.layers[0]?.id ?? null,
    x: shape.width / 2,
    y: shape.height / 2,
    zoom,
  };
}

export function createLayoutCanvas(handlers: CanvasHandlers): LayoutCanvas {
  const container = element('div', 'layout-canvas');
  const toolbar = element('div', 'layout-canvas-toolbar');
  const layerSelect = element('select');
  const zoomOut = button('-', 'button subtle');
  const zoomIn = button('+', 'button subtle');
  const fit = button('Fit', 'button subtle');
  const readout = element('span', 'layout-canvas-readout');
  const canvas = element('canvas', 'layout-canvas-surface');
  container.dataset.testid = 'build-canvas';
  layerSelect.setAttribute('aria-label', 'Active layer');
  layerSelect.dataset.testid = 'build-canvas-layer';
  zoomOut.setAttribute('aria-label', 'Zoom out');
  zoomIn.setAttribute('aria-label', 'Zoom in');
  fit.setAttribute('aria-label', 'Fit layout');
  fit.dataset.testid = 'build-canvas-fit';
  readout.dataset.testid = 'build-canvas-readout';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute(
    'aria-label',
    'Layout canvas: drag locations, arrow keys nudge the selected location',
  );
  canvas.dataset.testid = 'build-canvas-surface';
  toolbar.append(layerSelect, zoomOut, zoomIn, fit, readout);
  container.append(toolbar, canvas);

  let shape: LayoutShape = shapeOf(undefined);
  let camera: EditorCamera = { layerId: null, x: 50, y: 50, zoom: 1 };
  let selectedIndex: number | null = null;
  let drag:
    | {
        index: number;
        originX: number;
        originY: number;
        startX: number;
        startY: number;
        moved: boolean;
      }
    | { pan: true; startX: number; startY: number; cameraX: number; cameraY: number }
    | null = null;
  let dragPreview: { index: number; x: number; y: number } | null = null;
  let size = { height: 0, width: 0 };
  /** A fit requested while the surface had no size yet; applied on the first real resize. */
  let pendingFit = false;

  const scale = (): number => PIXELS_PER_METER * camera.zoom;
  const toScreen = (x: number, y: number): { x: number; y: number } => ({
    x: size.width / 2 + (x - camera.x) * scale(),
    y: size.height / 2 + (y - camera.y) * scale(),
  });
  const toWorld = (x: number, y: number): { x: number; y: number } => ({
    x: camera.x + (x - size.width / 2) / scale(),
    y: camera.y + (y - size.height / 2) / scale(),
  });

  function locationAt(worldX: number, worldY: number): number | null {
    for (let index = shape.locations.length - 1; index >= 0; index -= 1) {
      const location = shape.locations[index];
      if (location === undefined || location.layerId !== camera.layerId) continue;
      if (
        worldX >= location.x &&
        worldX <= location.x + location.width &&
        worldY >= location.y &&
        worldY <= location.y + location.height
      ) {
        return index;
      }
    }
    return null;
  }

  function draw(): void {
    const context = canvas.getContext('2d');
    if (context === null || size.width === 0 || size.height === 0) return;
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = '#101610';
    context.fillRect(0, 0, size.width, size.height);
    const origin = toScreen(0, 0);
    const extent = toScreen(shape.width, shape.height);
    context.fillStyle = '#18221b';
    context.fillRect(origin.x, origin.y, extent.x - origin.x, extent.y - origin.y);
    context.strokeStyle = 'rgb(224 232 210 / 25%)';
    context.lineWidth = 1;
    context.strokeRect(origin.x, origin.y, extent.x - origin.x, extent.y - origin.y);
    const step = camera.zoom >= 2 ? 5 : camera.zoom >= 0.5 ? 10 : 50;
    context.strokeStyle = 'rgb(224 232 210 / 6%)';
    for (let x = 0; x <= shape.width; x += step) {
      const sx = toScreen(x, 0).x;
      context.beginPath();
      context.moveTo(sx, origin.y);
      context.lineTo(sx, extent.y);
      context.stroke();
    }
    for (let y = 0; y <= shape.height; y += step) {
      const sy = toScreen(0, y).y;
      context.beginPath();
      context.moveTo(origin.x, sy);
      context.lineTo(extent.x, sy);
      context.stroke();
    }
    for (const area of shape.areas) {
      if (area.layerId !== camera.layerId) continue;
      const topLeft = toScreen(area.x, area.y);
      context.fillStyle = AREA_FILLS[area.kind ?? ''] ?? 'rgb(120 120 120 / 35%)';
      context.fillRect(topLeft.x, topLeft.y, area.width * scale(), area.height * scale());
    }
    shape.locations.forEach((location, index) => {
      if (location.layerId !== camera.layerId) return;
      const preview = dragPreview?.index === index ? dragPreview : null;
      const x = preview?.x ?? location.x;
      const y = preview?.y ?? location.y;
      const topLeft = toScreen(x, y);
      const selected = index === selectedIndex;
      context.fillStyle = selected ? 'rgb(240 201 102 / 30%)' : 'rgb(224 232 210 / 12%)';
      context.fillRect(topLeft.x, topLeft.y, location.width * scale(), location.height * scale());
      context.strokeStyle = selected ? '#f0c966' : 'rgb(224 232 210 / 60%)';
      context.lineWidth = selected ? 2 : 1;
      context.strokeRect(topLeft.x, topLeft.y, location.width * scale(), location.height * scale());
      context.fillStyle = selected ? '#f0c966' : '#e0e8d2';
      context.font = '12px system-ui, sans-serif';
      context.textBaseline = 'top';
      context.fillText(location.name ?? location.id, topLeft.x + 4, topLeft.y + 4);
    });
    for (const connector of shape.connectors) {
      for (const end of [connector.from, connector.to]) {
        if (end.layerId !== camera.layerId) continue;
        const point = toScreen(end.x, end.y);
        context.fillStyle = '#9bd1ff';
        context.beginPath();
        context.moveTo(point.x, point.y - 6);
        context.lineTo(point.x + 6, point.y);
        context.lineTo(point.x, point.y + 6);
        context.lineTo(point.x - 6, point.y);
        context.closePath();
        context.fill();
      }
    }
    const selected = selectedIndex === null ? null : shape.locations[selectedIndex];
    readout.textContent = `${camera.layerId ?? 'no layer'} / zoom ${Math.round(camera.zoom * 100)}% / center ${camera.x.toFixed(1)}, ${camera.y.toFixed(1)} m${selected === undefined || selected === null ? '' : ` / ${selected.name ?? selected.id} at ${(dragPreview?.x ?? selected.x).toFixed(1)}, ${(dragPreview?.y ?? selected.y).toFixed(1)} m`}`;
  }

  function resize(): void {
    const bounds = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    size = {
      height: Math.max(0, Math.round(bounds.height)),
      width: Math.max(0, Math.round(bounds.width)),
    };
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    if (pendingFit && size.width > 0 && size.height > 0) {
      pendingFit = false;
      camera = fitCamera(shape, camera.layerId, size);
      handlers.onCamera(camera);
    }
    draw();
  }
  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);

  const snap = (value: number): number => Math.round(value * 2) / 2;

  canvas.addEventListener('pointerdown', event => {
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    const world = toWorld(event.offsetX, event.offsetY);
    const index = locationAt(world.x, world.y);
    if (index === null) {
      drag = {
        cameraX: camera.x,
        cameraY: camera.y,
        pan: true,
        startX: event.offsetX,
        startY: event.offsetY,
      };
      return;
    }
    const location = shape.locations[index];
    if (location === undefined) return;
    if (selectedIndex !== index) handlers.onSelectPath(`layout.locations[${index}]`);
    selectedIndex = index;
    drag = {
      index,
      moved: false,
      originX: location.x,
      originY: location.y,
      startX: world.x,
      startY: world.y,
    };
    draw();
  });
  canvas.addEventListener('pointermove', event => {
    if (drag === null) return;
    if ('pan' in drag) {
      camera = {
        ...camera,
        x: drag.cameraX - (event.offsetX - drag.startX) / scale(),
        y: drag.cameraY - (event.offsetY - drag.startY) / scale(),
      };
      draw();
      return;
    }
    const world = toWorld(event.offsetX, event.offsetY);
    drag.moved = true;
    dragPreview = {
      index: drag.index,
      x: snap(drag.originX + (world.x - drag.startX)),
      y: snap(drag.originY + (world.y - drag.startY)),
    };
    draw();
  });
  const finishDrag = (): void => {
    if (drag === null) return;
    if ('pan' in drag) {
      handlers.onCamera(camera);
    } else if (drag.moved && dragPreview !== null) {
      const location = shape.locations[drag.index];
      handlers.onMoveLocation(
        drag.index,
        dragPreview.x,
        dragPreview.y,
        `Move ${location?.name ?? location?.id ?? 'location'}`,
      );
    }
    drag = null;
    dragPreview = null;
    draw();
  };
  canvas.addEventListener('pointerup', finishDrag);
  canvas.addEventListener('pointercancel', finishDrag);
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const world = toWorld(event.offsetX, event.offsetY);
    const zoom = Math.max(
      ZOOM_MIN,
      Math.min(ZOOM_MAX, camera.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)),
    );
    const next = { ...camera, zoom };
    camera = next;
    const after = toWorld(event.offsetX, event.offsetY);
    camera = { ...camera, x: camera.x + (world.x - after.x), y: camera.y + (world.y - after.y) };
    draw();
    handlers.onCamera(camera);
  });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      selectedIndex = null;
      handlers.onSelectPath(null);
      draw();
      return;
    }
    const delta: Record<string, [number, number]> = {
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
    };
    const move = delta[event.key];
    if (move === undefined || selectedIndex === null) return;
    const location = shape.locations[selectedIndex];
    if (location === undefined) return;
    event.preventDefault();
    const amount = event.shiftKey ? NUDGE_LARGE_METERS : NUDGE_METERS;
    handlers.onMoveLocation(
      selectedIndex,
      snap(location.x + move[0] * amount),
      snap(location.y + move[1] * amount),
      `Nudge ${location.name ?? location.id}`,
    );
  });
  layerSelect.addEventListener('change', () => {
    camera = { ...camera, layerId: layerSelect.value };
    draw();
    handlers.onCamera(camera);
  });
  const zoomBy = (factor: number): void => {
    camera = { ...camera, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camera.zoom * factor)) };
    draw();
    handlers.onCamera(camera);
  };
  zoomIn.addEventListener('click', () => zoomBy(1.25));
  zoomOut.addEventListener('click', () => zoomBy(1 / 1.25));
  fit.addEventListener('click', () => {
    camera = fitCamera(shape, camera.layerId, size);
    draw();
    handlers.onCamera(camera);
  });

  return {
    element: container,
    render(options) {
      shape = shapeOf(options.draft);
      const layerIds = shape.layers.map(layer => layer.id);
      if (options.camera === null) {
        if (size.width === 0 || size.height === 0) resize();
        const sized = size.width > 0 && size.height > 0;
        camera = fitCamera(shape, null, sized ? size : { height: 400, width: 600 });
        pendingFit = !sized;
      } else {
        camera = { ...options.camera };
      }
      if (camera.layerId === null || !layerIds.includes(camera.layerId)) {
        camera = { ...camera, layerId: layerIds[0] ?? null };
      }
      const wanted = shape.layers.map(layer => `${layer.id}:${layer.name}`).join('|');
      if (layerSelect.dataset.layers !== wanted) {
        layerSelect.replaceChildren(
          ...shape.layers.map(layer => {
            const option = element('option');
            option.value = layer.id;
            option.textContent = layer.name;
            return option;
          }),
        );
        layerSelect.dataset.layers = wanted;
      }
      if (camera.layerId !== null) layerSelect.value = camera.layerId;
      selectedIndex = locationIndexFromPath(options.selectedPath);
      if (selectedIndex !== null && selectedIndex >= shape.locations.length) selectedIndex = null;
      draw();
    },
  };
}
