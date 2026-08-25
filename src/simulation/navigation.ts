import type {
  EnvironmentDefinition,
  LayerPosition,
  LocationDefinition,
  TimedRoute,
} from '../model/types.js';

interface RouteNode {
  position: LayerPosition;
}

interface RouteEdge {
  connectorId: string | null;
  cost: number;
  from: number;
  to: number;
}

export interface NavigationRoute {
  distanceMeters: number;
  steps: readonly NavigationStep[];
}

export interface NavigationStep {
  connectorId: string | null;
  distanceMeters: number;
  position: LayerPosition;
}

function planarDistance(left: LayerPosition, right: LayerPosition): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

export function sameLayerPosition(left: LayerPosition, right: LayerPosition): boolean {
  return left.layerId === right.layerId && planarDistance(left, right) < 0.01;
}

export function locationCenter(location: LocationDefinition): LayerPosition {
  return {
    layerId: location.layerId,
    x: location.x + location.width / 2,
    y: location.y + location.height / 2,
  };
}

function routeGraph(
  environment: EnvironmentDefinition,
  start: LayerPosition,
  destination: LayerPosition,
): { edges: RouteEdge[]; nodes: RouteNode[] } {
  const nodes: RouteNode[] = [{ position: start }, { position: destination }];
  for (const connector of environment.connectors) {
    nodes.push({ position: connector.from }, { position: connector.to });
  }
  const edges: RouteEdge[] = [];
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    const left = nodes[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const right = nodes[rightIndex];
      if (right === undefined || left.position.layerId !== right.position.layerId) continue;
      const cost = planarDistance(left.position, right.position);
      edges.push(
        { connectorId: null, cost, from: leftIndex, to: rightIndex },
        { connectorId: null, cost, from: rightIndex, to: leftIndex },
      );
    }
  }
  environment.connectors.forEach((connector, connectorIndex) => {
    const from = 2 + connectorIndex * 2;
    const to = from + 1;
    edges.push(
      {
        connectorId: connector.id,
        cost: connector.traversalDistanceMeters,
        from,
        to,
      },
      {
        connectorId: connector.id,
        cost: connector.traversalDistanceMeters,
        from: to,
        to: from,
      },
    );
  });
  return { edges, nodes };
}

export function findNavigationRoute(
  environment: EnvironmentDefinition,
  start: LayerPosition,
  destination: LayerPosition,
): NavigationRoute | null {
  if (sameLayerPosition(start, destination)) return { distanceMeters: 0, steps: [] };
  const { edges, nodes } = routeGraph(environment, start, destination);
  const distances = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => null as RouteEdge | null);
  const visited = nodes.map(() => false);
  distances[0] = 0;
  for (let visitCount = 0; visitCount < nodes.length; visitCount += 1) {
    let current = -1;
    for (let index = 0; index < nodes.length; index += 1) {
      if (visited[index]) continue;
      if (
        current === -1 ||
        (distances[index] ?? Number.POSITIVE_INFINITY) <
          (distances[current] ?? Number.POSITIVE_INFINITY)
      ) {
        current = index;
      }
    }
    if (current === -1 || !Number.isFinite(distances[current])) break;
    if (current === 1) break;
    visited[current] = true;
    for (const edge of edges) {
      if (edge.from !== current) continue;
      const candidate = (distances[current] ?? 0) + edge.cost;
      if (candidate >= (distances[edge.to] ?? Number.POSITIVE_INFINITY)) continue;
      distances[edge.to] = candidate;
      previous[edge.to] = edge;
    }
  }
  const distanceMeters = distances[1] ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(distanceMeters)) return null;
  const reversed: NavigationStep[] = [];
  let current = 1;
  while (current !== 0) {
    const edge = previous[current];
    const node = nodes[current];
    if (edge === null || edge === undefined || node === undefined) return null;
    reversed.push({
      connectorId: edge.connectorId,
      distanceMeters: edge.cost,
      position: node.position,
    });
    current = edge.from;
  }
  return { distanceMeters, steps: reversed.reverse() };
}

export function navigationDistance(
  environment: EnvironmentDefinition,
  start: LayerPosition,
  destination: LayerPosition,
): number {
  return findNavigationRoute(environment, start, destination)?.distanceMeters ?? Infinity;
}

export function advanceLayerPosition(
  environment: EnvironmentDefinition,
  start: LayerPosition,
  destination: LayerPosition,
  travelMeters: number,
): LayerPosition {
  if (travelMeters <= 0) return start;
  const route = findNavigationRoute(environment, start, destination);
  if (route === null) return start;
  let current = start;
  let remaining = travelMeters;
  for (const step of route.steps) {
    if (remaining <= 0) break;
    if (step.connectorId !== null) {
      current = step.position;
      remaining = Math.max(0, remaining - step.distanceMeters);
      continue;
    }
    const distance = planarDistance(current, step.position);
    if (distance <= remaining || distance === 0) {
      current = step.position;
      remaining -= distance;
      continue;
    }
    return {
      layerId: current.layerId,
      x: current.x + ((step.position.x - current.x) / distance) * remaining,
      y: current.y + ((step.position.y - current.y) / distance) * remaining,
    };
  }
  return current;
}

/** Commit a connector-aware route from an origin at a departure second, or null when unreachable. */
export function createTimedRoute(
  environment: EnvironmentDefinition,
  origin: LayerPosition,
  destination: LayerPosition,
  destinationLocationId: string,
  departureSecond: number,
  metersPerSecond: number,
): TimedRoute | null {
  const route = findNavigationRoute(environment, origin, destination);
  if (route === null) return null;
  return {
    departureSecond,
    destinationLocationId,
    lengthMeters: route.distanceMeters,
    metersPerSecond,
    origin: { ...origin },
    steps: route.steps.map(step => ({
      connectorId: step.connectorId,
      distanceMeters: step.distanceMeters,
      position: { ...step.position },
    })),
  };
}

export function routeArrivalSecond(route: TimedRoute): number {
  return route.departureSecond + route.lengthMeters / route.metersPerSecond;
}

/** Pure position along a committed route at an absolute second. */
export function routePositionAtSecond(route: TimedRoute, second: number): LayerPosition {
  const traveled = Math.min(
    route.lengthMeters,
    Math.max(0, (second - route.departureSecond) * route.metersPerSecond),
  );
  let current = route.origin;
  let remaining = traveled;
  for (const step of route.steps) {
    if (step.connectorId !== null) {
      if (remaining < step.distanceMeters) return current;
      current = step.position;
      remaining -= step.distanceMeters;
      continue;
    }
    const distance = planarDistance(current, step.position);
    if (distance <= remaining || distance === 0) {
      current = step.position;
      remaining -= distance;
      continue;
    }
    return {
      layerId: current.layerId,
      x: current.x + ((step.position.x - current.x) / distance) * remaining,
      y: current.y + ((step.position.y - current.y) / distance) * remaining,
    };
  }
  return current;
}
