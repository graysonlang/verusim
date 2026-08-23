import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import type {
  EnvironmentArea,
  Point,
  SimulationAgent,
  SimulationState,
} from '../src/model/types.js';
import {
  areaIndicatorsForState,
  indicatorsForAgent,
  type AgentIndicator,
  type IndicatorKind,
  type IndicatorSettings,
} from './indicators.js';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface WorldViewOptions {
  canvas: HTMLCanvasElement;
  indicatorSettings: Accessor<IndicatorSettings>;
  onHover: (hover: WorldHover | null) => void;
  onSelect: (agentId: string) => void;
  selectedAgentId: Accessor<string | null>;
  state: Accessor<SimulationState>;
}

export interface WorldHover {
  agentId: string;
  x: number;
  y: number;
}

export interface WorldView {
  actualSize: () => void;
  camera: Accessor<Camera>;
  fit: () => void;
  focusAgent: (agentId: string) => void;
  setZoom: (zoom: number) => void;
  zoomBy: (factor: number) => void;
}

const AREA_COLORS: Record<EnvironmentArea['kind'], string> = {
  building: '#8b6b48',
  field: '#b89a56',
  forest: '#244b38',
  grass: '#52744a',
  market: '#b7aa8a',
  path: '#aa936b',
  water: '#3e7582',
};

const INDICATOR_COLORS: Record<Exclude<IndicatorKind, 'area'>, string> = {
  action: '#d98b5f',
  event: '#b995cf',
  mood: '#e6ca72',
  speech: '#eee6d2',
  thought: '#80aaa5',
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function cameraForGesture(
  startCamera: Camera,
  viewport: { height: number; width: number },
  startCentroid: Point,
  currentCentroid: Point,
  scale: number,
): Camera {
  const zoom = clamp(startCamera.zoom * scale, 0.12, 5);
  const worldAnchor = {
    x: startCamera.x + (startCentroid.x - viewport.width / 2) / startCamera.zoom,
    y: startCamera.y + (startCentroid.y - viewport.height / 2) / startCamera.zoom,
  };
  return {
    x: worldAnchor.x - (currentCentroid.x - viewport.width / 2) / zoom,
    y: worldAnchor.y - (currentCentroid.y - viewport.height / 2) / zoom,
    zoom,
  };
}

function screenPoint(canvas: HTMLCanvasElement, event: PointerEvent | WheelEvent): Point {
  const bounds = canvas.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function worldPoint(canvas: HTMLCanvasElement, camera: Camera, screen: Point): Point {
  return {
    x: camera.x + (screen.x - canvas.clientWidth / 2) / camera.zoom,
    y: camera.y + (screen.y - canvas.clientHeight / 2) / camera.zoom,
  };
}

function agentScreenPoint(
  canvas: HTMLCanvasElement,
  camera: Camera,
  agent: SimulationAgent,
): Point {
  return {
    x: canvas.clientWidth / 2 + (agent.position.x - camera.x) * camera.zoom,
    y: canvas.clientHeight / 2 + (agent.position.y - camera.y) * camera.zoom,
  };
}

function drawInfiniteGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: Camera,
): void {
  const worldSpacing = camera.zoom >= 1.2 ? 25 : camera.zoom >= 0.55 ? 50 : 100;
  const spacing = worldSpacing * camera.zoom;
  const originX = width / 2 - camera.x * camera.zoom;
  const originY = height / 2 - camera.y * camera.zoom;
  context.beginPath();
  for (let x = ((originX % spacing) + spacing) % spacing; x < width; x += spacing) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let y = ((originY % spacing) + spacing) % spacing; y < height; y += spacing) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.strokeStyle = 'rgb(240 229 201 / 5%)';
  context.lineWidth = 1;
  context.stroke();
}

function drawAreaTexture(context: CanvasRenderingContext2D, area: EnvironmentArea): void {
  if (area.kind === 'field') {
    context.beginPath();
    for (let x = area.x + 14; x < area.x + area.width; x += 22) {
      context.moveTo(x, area.y + 6);
      context.lineTo(x, area.y + area.height - 6);
    }
    context.strokeStyle = 'rgb(81 61 29 / 23%)';
    context.lineWidth = 2;
    context.stroke();
  } else if (area.kind === 'water') {
    context.beginPath();
    for (let y = area.y + 18; y < area.y + area.height; y += 28) {
      context.moveTo(area.x + 12, y);
      context.bezierCurveTo(
        area.x + area.width * 0.3,
        y - 8,
        area.x + area.width * 0.7,
        y + 8,
        area.x + area.width - 12,
        y,
      );
    }
    context.strokeStyle = 'rgb(202 238 230 / 15%)';
    context.lineWidth = 3;
    context.stroke();
  } else if (area.kind === 'forest') {
    context.fillStyle = 'rgb(11 43 30 / 58%)';
    for (let y = area.y + 18; y < area.y + area.height; y += 34) {
      for (let x = area.x + 18; x < area.x + area.width; x += 38) {
        const offset = ((x + y) / 2) % 13;
        context.beginPath();
        context.arc(x + offset, y, 9, 0, Math.PI * 2);
        context.fill();
      }
    }
  } else if (area.kind === 'building') {
    context.fillStyle = 'rgb(52 32 22 / 28%)';
    context.fillRect(area.x + 7, area.y + 7, area.width, area.height);
    context.fillStyle = '#9d7650';
    context.fillRect(area.x, area.y, area.width, area.height);
    context.strokeStyle = '#5c422f';
    context.lineWidth = 3;
    context.strokeRect(area.x, area.y, area.width, area.height);
    context.beginPath();
    context.moveTo(area.x + area.width / 2, area.y + 6);
    context.lineTo(area.x + area.width / 2, area.y + area.height - 6);
    context.strokeStyle = 'rgb(69 46 31 / 42%)';
    context.stroke();
  }
}

function drawAreaIndicators(
  context: CanvasRenderingContext2D,
  state: SimulationState,
  camera: Camera,
  settings: IndicatorSettings,
): void {
  const indicators = areaIndicatorsForState(state, settings);
  if (indicators.length === 0) return;
  const hasNegative = indicators.some(indicator => indicator.tone === 'negative');
  const hasPositive = indicators.some(indicator => indicator.tone === 'positive');
  context.save();
  context.fillStyle = hasNegative
    ? hasPositive
      ? 'rgb(128 103 143 / 8%)'
      : 'rgb(180 92 72 / 7%)'
    : 'rgb(89 154 133 / 7%)';
  context.fillRect(0, 0, state.environment.width, state.environment.height);
  context.setLineDash([10 / camera.zoom, 8 / camera.zoom]);
  context.strokeStyle = hasNegative
    ? hasPositive
      ? 'rgb(194 157 211 / 58%)'
      : 'rgb(224 139 109 / 55%)'
    : 'rgb(126 193 168 / 55%)';
  context.lineWidth = 2 / camera.zoom;
  context.strokeRect(
    7 / camera.zoom,
    7 / camera.zoom,
    state.environment.width - 14 / camera.zoom,
    state.environment.height - 14 / camera.zoom,
  );
  context.setLineDash([]);
  if (settings.verbosity !== 'minimal' && camera.zoom >= 0.32) {
    const copy = indicators
      .map(indicator => (settings.verbosity === 'detailed' ? indicator.detail : indicator.label))
      .join(' / ');
    context.font = `600 ${10 / camera.zoom}px ui-sans-serif, system-ui, sans-serif`;
    context.textAlign = 'center';
    context.fillStyle = 'rgb(247 226 210 / 75%)';
    context.fillText(`~ Area effect: ${copy}`, state.environment.width / 2, 25 / camera.zoom);
  }
  context.restore();
}

function roundedShape(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function indicatorShape(
  context: CanvasRenderingContext2D,
  indicator: AgentIndicator,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (indicator.kind === 'mood') {
    roundedShape(context, x, y, width, height, height / 2);
  } else if (indicator.kind === 'thought') {
    roundedShape(context, x, y, width, height, height / 2);
  } else if (indicator.kind === 'speech') {
    roundedShape(context, x, y, width, height, 5);
  } else if (indicator.kind === 'action') {
    context.beginPath();
    context.moveTo(x + 5, y);
    context.lineTo(x + width - 7, y);
    context.lineTo(x + width, y + height / 2);
    context.lineTo(x + width - 7, y + height);
    context.lineTo(x + 5, y + height);
    context.lineTo(x, y + height / 2);
    context.closePath();
  } else {
    const inset = Math.min(5, width / 4);
    context.beginPath();
    context.moveTo(x + inset, y);
    context.lineTo(x + width - inset, y);
    context.lineTo(x + width, y + height / 2);
    context.lineTo(x + width - inset, y + height);
    context.lineTo(x + inset, y + height);
    context.lineTo(x, y + height / 2);
    context.closePath();
  }
}

function drawIndicator(
  context: CanvasRenderingContext2D,
  indicator: AgentIndicator,
  x: number,
  y: number,
  showLabel: boolean,
): number {
  const height = 21;
  const label =
    indicator.label.length > 24 ? `${indicator.label.slice(0, 23)}...` : indicator.label;
  context.font = '600 9px ui-sans-serif, system-ui, sans-serif';
  const width = showLabel
    ? Math.min(170, Math.max(32, context.measureText(`${indicator.glyph} ${label}`).width + 16))
    : 25;
  context.save();
  context.shadowColor = 'rgb(0 0 0 / 42%)';
  context.shadowBlur = 6;
  context.shadowOffsetY = 2;
  indicatorShape(context, indicator, x, y, width, height);
  context.fillStyle =
    indicator.kind === 'mood' && indicator.tone === 'negative'
      ? '#d98268'
      : indicator.kind === 'mood' && indicator.tone === 'positive'
        ? '#efd06f'
        : INDICATOR_COLORS[indicator.kind];
  context.fill();
  context.shadowColor = 'transparent';
  context.lineWidth = 1;
  context.strokeStyle = 'rgb(24 29 25 / 72%)';
  context.stroke();
  if (indicator.kind === 'speech') {
    context.beginPath();
    context.moveTo(x + 7, y + height - 1);
    context.lineTo(x + 11, y + height + 5);
    context.lineTo(x + 15, y + height - 1);
    context.fill();
    context.stroke();
  } else if (indicator.kind === 'thought') {
    context.beginPath();
    context.arc(x + 8, y + height + 3, 2.5, 0, Math.PI * 2);
    context.arc(x + 4, y + height + 7, 1.5, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = '#20251f';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(
    showLabel ? `${indicator.glyph} ${label}` : indicator.glyph,
    x + width / 2,
    y + 10.5,
  );
  context.restore();
  return width;
}

function drawAgentIndicators(
  context: CanvasRenderingContext2D,
  state: SimulationState,
  camera: Camera,
  selectedAgentId: string | null,
  settings: IndicatorSettings,
  width: number,
  height: number,
): void {
  if (settings.verbosity === 'off') return;
  for (const agent of state.agents) {
    const selected = agent.id === selectedAgentId;
    if (camera.zoom < 0.3 && !selected) continue;
    const projected = indicatorsForAgent(state, agent, settings);
    const indicators = selected
      ? projected
      : projected
          .toSorted((left, right) => right.priority - left.priority)
          .slice(0, settings.verbosity === 'detailed' ? 5 : 3);
    if (indicators.length === 0) continue;
    const point = {
      x: width / 2 + (agent.position.x - camera.x) * camera.zoom,
      y: height / 2 + (agent.position.y - camera.y) * camera.zoom,
    };
    const showLabels = selected && settings.verbosity !== 'minimal';
    if (showLabels) {
      const rowHeight = 27;
      const top = point.y - 43 - rowHeight * indicators.length;
      for (const [index, indicator] of indicators.entries()) {
        context.font = '600 9px ui-sans-serif, system-ui, sans-serif';
        const width = Math.min(
          170,
          Math.max(32, context.measureText(`${indicator.glyph} ${indicator.label}`).width + 16),
        );
        drawIndicator(context, indicator, point.x - width / 2, top + index * rowHeight, true);
      }
    } else {
      const gap = 4;
      const totalWidth = indicators.length * 25 + (indicators.length - 1) * gap;
      let x = point.x - totalWidth / 2;
      for (const indicator of indicators) {
        x += drawIndicator(context, indicator, x, point.y - 48, false) + gap;
      }
    }
  }
}

function drawWorld(
  context: CanvasRenderingContext2D,
  state: SimulationState,
  camera: Camera,
  selectedAgentId: string | null,
  indicatorSettings: IndicatorSettings,
  width: number,
  height: number,
): void {
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#17231d';
  context.fillRect(0, 0, width, height);
  drawInfiniteGrid(context, width, height, camera);

  context.save();
  context.translate(width / 2 - camera.x * camera.zoom, height / 2 - camera.y * camera.zoom);
  context.scale(camera.zoom, camera.zoom);

  context.fillStyle = '#405f3d';
  context.fillRect(0, 0, state.environment.width, state.environment.height);
  context.strokeStyle = 'rgb(228 218 182 / 18%)';
  context.lineWidth = 2 / camera.zoom;
  context.strokeRect(0, 0, state.environment.width, state.environment.height);

  for (const area of state.environment.areas) {
    context.fillStyle = AREA_COLORS[area.kind];
    context.fillRect(area.x, area.y, area.width, area.height);
    drawAreaTexture(context, area);
    if (area.label !== undefined && camera.zoom >= 0.42) {
      context.fillStyle = 'rgb(245 237 213 / 62%)';
      context.font = `${11 / camera.zoom}px ui-sans-serif, system-ui, sans-serif`;
      context.textAlign = 'center';
      context.fillText(area.label, area.x + area.width / 2, area.y + area.height / 2);
    }
  }

  drawAreaIndicators(context, state, camera, indicatorSettings);

  if (camera.zoom >= 0.55) {
    for (const location of state.environment.locations) {
      context.fillStyle = 'rgb(255 250 226 / 72%)';
      context.font = `600 ${10 / camera.zoom}px ui-sans-serif, system-ui, sans-serif`;
      context.textAlign = 'center';
      context.fillText(
        location.name,
        location.x + location.width / 2,
        location.y - 8 / camera.zoom,
      );
    }
  }

  for (const agent of state.agents) {
    if (agent.currentLocationId === null) {
      context.beginPath();
      context.moveTo(agent.position.x, agent.position.y);
      context.lineTo(agent.destination.x, agent.destination.y);
      context.setLineDash([5 / camera.zoom, 7 / camera.zoom]);
      context.strokeStyle = 'rgb(255 244 208 / 30%)';
      context.lineWidth = 1 / camera.zoom;
      context.stroke();
      context.setLineDash([]);
    }
  }

  for (const agent of state.agents) {
    const selected = agent.id === selectedAgentId;
    const radius = (selected ? 10 : 8) / camera.zoom;
    if (selected) {
      context.beginPath();
      context.arc(agent.position.x, agent.position.y, 15 / camera.zoom, 0, Math.PI * 2);
      context.strokeStyle = '#f5cc68';
      context.lineWidth = 2 / camera.zoom;
      context.stroke();
    }
    context.beginPath();
    context.arc(agent.position.x, agent.position.y, radius, 0, Math.PI * 2);
    context.fillStyle = selected ? '#f5cc68' : '#f4ede0';
    context.fill();
    context.strokeStyle = '#29362d';
    context.lineWidth = 2 / camera.zoom;
    context.stroke();

    context.fillStyle = selected ? '#fff3c4' : 'rgb(255 250 234 / 78%)';
    context.font = `${selected ? 600 : 500} ${11 / camera.zoom}px ui-sans-serif, system-ui, sans-serif`;
    context.textAlign = 'center';
    context.fillText(agent.profile.name, agent.position.x, agent.position.y - 15 / camera.zoom);
  }
  context.restore();
  drawAgentIndicators(context, state, camera, selectedAgentId, indicatorSettings, width, height);
}

export function createWorldView(options: WorldViewOptions): WorldView {
  const { canvas } = options;
  const [camera, setCamera] = createSignal<Camera>({ x: 700, y: 450, zoom: 0.7 });
  const [viewportRevision, setViewportRevision] = createSignal(0);
  const activePointers = new Map<number, Point>();
  let dragDistance = 0;
  let pointerStart = { x: 0, y: 0 };
  let cameraStart = camera();
  let gestureCameraStart = camera();
  let gestureCentroidStart = { x: 0, y: 0 };
  let gestureDistanceStart = 1;

  function fit(): void {
    options.onHover(null);
    const state = options.state();
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    const zoom = clamp(
      Math.min((width - 100) / state.environment.width, (height - 100) / state.environment.height),
      0.15,
      3,
    );
    setCamera({ x: state.environment.width / 2, y: state.environment.height / 2, zoom });
  }

  function actualSize(): void {
    options.onHover(null);
    setCamera(current => ({ ...current, zoom: 1 }));
  }

  function focusAgent(agentId: string): void {
    const agent = options.state().agents.find(candidate => candidate.id === agentId);
    if (agent === undefined) return;
    options.onHover(null);
    setCamera(current => ({
      ...current,
      x: agent.position.x,
      y: agent.position.y,
      zoom: Math.max(1.15, current.zoom),
    }));
  }

  function zoomAt(factor: number, screen?: Point): void {
    options.onHover(null);
    const current = camera();
    const anchor = screen ?? { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
    const worldAnchor = worldPoint(canvas, current, anchor);
    const zoom = clamp(current.zoom * factor, 0.12, 5);
    setCamera({
      x: worldAnchor.x - (anchor.x - canvas.clientWidth / 2) / zoom,
      y: worldAnchor.y - (anchor.y - canvas.clientHeight / 2) / zoom,
      zoom,
    });
  }

  function setZoomLevel(zoom: number): void {
    const current = camera();
    zoomAt(clamp(zoom, 0.12, 5) / current.zoom);
  }

  function nearestAgent(screen: Point): SimulationAgent | null {
    const current = camera();
    let nearest: { agent: SimulationAgent; distance: number } | null = null;
    for (const agent of options.state().agents) {
      const point = agentScreenPoint(canvas, current, agent);
      const candidateDistance = Math.hypot(screen.x - point.x, screen.y - point.y);
      if (candidateDistance <= 18 && (nearest === null || candidateDistance < nearest.distance)) {
        nearest = { agent, distance: candidateDistance };
      }
    }
    return nearest?.agent ?? null;
  }

  function showHover(screen: Point): void {
    const agent = nearestAgent(screen);
    options.onHover(agent === null ? null : { agentId: agent.id, x: screen.x, y: screen.y });
  }

  function selectNearest(screen: Point): void {
    const agent = nearestAgent(screen);
    if (agent !== null) options.onSelect(agent.id);
  }

  function firstTwoPointers(): readonly [Point, Point] | null {
    const points = Array.from(activePointers.values());
    const first = points[0];
    const second = points[1];
    return first === undefined || second === undefined ? null : [first, second];
  }

  function startSinglePointer(point: Point, allowSelection: boolean): void {
    pointerStart = point;
    cameraStart = camera();
    dragDistance = allowSelection ? 0 : 4;
  }

  function startMultiPointerGesture(): void {
    const pointers = firstTwoPointers();
    if (pointers === null) return;
    const [first, second] = pointers;
    gestureCameraStart = camera();
    gestureCentroidStart = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
    gestureDistanceStart = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
    dragDistance = Math.max(dragDistance, 4);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    options.onHover(null);
    const point = screenPoint(canvas, event);
    activePointers.set(event.pointerId, point);
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-panning');
    if (activePointers.size === 1) startSinglePointer(point, true);
    else startMultiPointerGesture();
  }

  function onPointerMove(event: PointerEvent): void {
    const point = screenPoint(canvas, event);
    if (!activePointers.has(event.pointerId)) {
      if (event.pointerType === 'mouse') showHover(point);
      return;
    }
    activePointers.set(event.pointerId, point);
    if (activePointers.size >= 2) {
      const pointers = firstTwoPointers();
      if (pointers === null) return;
      const [first, second] = pointers;
      const centroid = {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      };
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      setCamera(
        cameraForGesture(
          gestureCameraStart,
          { height: canvas.clientHeight, width: canvas.clientWidth },
          gestureCentroidStart,
          centroid,
          distance / gestureDistanceStart,
        ),
      );
      return;
    }
    const dx = point.x - pointerStart.x;
    const dy = point.y - pointerStart.y;
    dragDistance = Math.max(dragDistance, Math.hypot(dx, dy));
    setCamera({
      ...cameraStart,
      x: cameraStart.x - dx / cameraStart.zoom,
      y: cameraStart.y - dy / cameraStart.zoom,
    });
  }

  function onPointerUp(event: PointerEvent): void {
    if (!activePointers.has(event.pointerId)) return;
    const point = screenPoint(canvas, event);
    activePointers.set(event.pointerId, point);
    const selectOnRelease =
      activePointers.size === 1 && dragDistance < 4 && event.type !== 'pointercancel';
    activePointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

    if (activePointers.size >= 2) {
      startMultiPointerGesture();
      return;
    }
    if (activePointers.size === 1) {
      const remaining = activePointers.values().next().value;
      if (remaining !== undefined) startSinglePointer(remaining, false);
      return;
    }

    canvas.classList.remove('is-panning');
    if (selectOnRelease) selectNearest(point);
    if (event.pointerType === 'mouse' && event.type !== 'pointercancel') showHover(point);
    else options.onHover(null);
  }

  function onPointerLeave(): void {
    if (activePointers.size === 0) options.onHover(null);
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    zoomAt(Math.exp(-event.deltaY * 0.0014), screenPoint(canvas, event));
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const observer = new ResizeObserver(() => setViewportRevision(revision => revision + 1));
  observer.observe(canvas);

  createEffect(() => {
    const state = options.state();
    const selectedAgentId = options.selectedAgentId();
    const indicatorSettings = options.indicatorSettings();
    const currentCamera = camera();
    viewportRevision();
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const context = canvas.getContext('2d');
    if (context === null) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawWorld(context, state, currentCamera, selectedAgentId, indicatorSettings, width, height);
  });

  onCleanup(() => {
    observer.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
  });

  return { actualSize, camera, fit, focusAgent, setZoom: setZoomLevel, zoomBy: zoomAt };
}
