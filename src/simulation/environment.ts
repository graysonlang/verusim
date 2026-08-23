import type {
  EnvironmentArea,
  EnvironmentDefinition,
  EnvironmentEnclosure,
  EnvironmentLayer,
  LayerPosition,
  Point,
} from '../model/types.js';

export interface EnvironmentSpatialContext {
  areaIds: readonly string[];
  enclosure: EnvironmentEnclosure;
  overheadCover: number;
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function pointInBounds(point: Point, bounds: EnvironmentArea): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

export function areasAtPosition(
  environment: EnvironmentDefinition,
  position: LayerPosition,
): readonly EnvironmentArea[] {
  return environment.areas.filter(
    area => area.layerId === position.layerId && pointInBounds(position, area),
  );
}

export function environmentSpatialContextAt(
  environment: EnvironmentDefinition,
  position: LayerPosition,
): EnvironmentSpatialContext {
  const areas = areasAtPosition(environment, position);
  let remainingOverheadExposure = 1;
  for (const area of areas) remainingOverheadExposure *= 1 - area.cover.overhead;
  return {
    areaIds: areas.map(area => area.id),
    enclosure: areas.some(area => area.enclosure === 'interior') ? 'interior' : 'exterior',
    overheadCover: 1 - remainingOverheadExposure,
  };
}

export function environmentLayersTopDown(
  environment: EnvironmentDefinition,
): readonly EnvironmentLayer[] {
  return environment.layers.toSorted(
    (left, right) => right.elevationMeters - left.elevationMeters || compareIds(left.id, right.id),
  );
}

export function relativeLayerLevel(environment: EnvironmentDefinition, layerId: string): number {
  const layer = environment.layers.find(candidate => candidate.id === layerId);
  if (layer === undefined) throw new RangeError(`Unknown environment layer "${layerId}"`);
  if (layer.elevationMeters === 0) return 0;
  const sameSide = environment.layers
    .filter(candidate => Math.sign(candidate.elevationMeters) === Math.sign(layer.elevationMeters))
    .toSorted(
      (left, right) =>
        Math.abs(left.elevationMeters) - Math.abs(right.elevationMeters) ||
        compareIds(left.id, right.id),
    );
  const index = sameSide.findIndex(candidate => candidate.id === layerId);
  return Math.sign(layer.elevationMeters) * (index + 1);
}
