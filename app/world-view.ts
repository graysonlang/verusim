import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js';
import type {
  EnvironmentArea,
  Point,
  SimulationAgent,
  SimulationState,
} from '../src/model/types.js';

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface WorldViewOptions {
  canvas: HTMLCanvasElement;
  onSelect: (agentId: string) => void;
  selectedAgentId: Accessor<string | null>;
  state: Accessor<SimulationState>;
}

export interface WorldView {
  camera: Accessor<Camera>;
  fit: () => void;
  focusAgent: (agentId: string) => void;
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
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

function drawWorld(
  context: CanvasRenderingContext2D,
  state: SimulationState,
  camera: Camera,
  selectedAgentId: string | null,
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
}

export function createWorldView(options: WorldViewOptions): WorldView {
  const { canvas } = options;
  const [camera, setCamera] = createSignal<Camera>({ x: 700, y: 450, zoom: 0.7 });
  const [viewportRevision, setViewportRevision] = createSignal(0);
  let dragging = false;
  let dragDistance = 0;
  let pointerStart = { x: 0, y: 0 };
  let cameraStart = camera();

  function fit(): void {
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

  function focusAgent(agentId: string): void {
    const agent = options.state().agents.find(candidate => candidate.id === agentId);
    if (agent === undefined) return;
    setCamera(current => ({
      ...current,
      x: agent.position.x,
      y: agent.position.y,
      zoom: Math.max(1.15, current.zoom),
    }));
  }

  function zoomAt(factor: number, screen?: Point): void {
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

  function selectNearest(screen: Point): void {
    const current = camera();
    let nearest: { agent: SimulationAgent; distance: number } | null = null;
    for (const agent of options.state().agents) {
      const point = agentScreenPoint(canvas, current, agent);
      const candidateDistance = Math.hypot(screen.x - point.x, screen.y - point.y);
      if (candidateDistance <= 18 && (nearest === null || candidateDistance < nearest.distance)) {
        nearest = { agent, distance: candidateDistance };
      }
    }
    if (nearest !== null) options.onSelect(nearest.agent.id);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    dragging = true;
    dragDistance = 0;
    pointerStart = screenPoint(canvas, event);
    cameraStart = camera();
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-panning');
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) return;
    const point = screenPoint(canvas, event);
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
    if (!dragging) return;
    dragging = false;
    canvas.releasePointerCapture(event.pointerId);
    canvas.classList.remove('is-panning');
    if (dragDistance < 4) selectNearest(screenPoint(canvas, event));
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    zoomAt(Math.exp(-event.deltaY * 0.0014), screenPoint(canvas, event));
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const observer = new ResizeObserver(() => setViewportRevision(revision => revision + 1));
  observer.observe(canvas);

  createEffect(() => {
    const state = options.state();
    const selectedAgentId = options.selectedAgentId();
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
    drawWorld(context, state, currentCamera, selectedAgentId, width, height);
  });

  onCleanup(() => {
    observer.disconnect();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
  });

  return { camera, fit, focusAgent, zoomBy: zoomAt };
}
