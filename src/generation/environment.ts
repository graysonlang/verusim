import type {
  EnvironmentArea,
  EnvironmentConnectorKind,
  EnvironmentEnclosure,
  EnvironmentLayoutResourceFile,
  OutletAffordance,
} from '../model/types.js';
import { parseResourceFile } from '../scenario/parse.js';
import {
  GenerationSampler,
  cloneGenerated,
  freezeGenerated,
  validateGenerationRange,
  validateGenerationSeed,
  validateSamplerPosition,
  type NumericGenerationRange,
  type RealizedGenerationDraw,
} from './sampler.js';

const ENVIRONMENT_GENERATOR_ALGORITHM = 'verusim-environment-v1' as const;

export interface FractionalBoundsTemplate {
  height: NumericGenerationRange;
  width: NumericGenerationRange;
  x: NumericGenerationRange;
  y: NumericGenerationRange;
}

export interface EnvironmentLayerTemplate {
  elevationMeters: NumericGenerationRange;
  id: string;
  name: string;
}

export interface EnvironmentAreaTemplate extends FractionalBoundsTemplate {
  cover: {
    hearingOcclusion: NumericGenerationRange;
    overhead: NumericGenerationRange;
    sightOcclusion: NumericGenerationRange;
  };
  enclosure: EnvironmentEnclosure;
  id: string;
  kind: EnvironmentArea['kind'];
  label?: string;
  layerId: string;
}

export interface EnvironmentLocationTemplate extends FractionalBoundsTemplate {
  id: string;
  kind: string;
  layerId: string;
  name: string;
}

export interface FractionalLayerPositionTemplate {
  layerId: string;
  x: NumericGenerationRange;
  y: NumericGenerationRange;
}

export interface EnvironmentConnectorTemplate {
  from: FractionalLayerPositionTemplate;
  id: string;
  kind: EnvironmentConnectorKind;
  to: FractionalLayerPositionTemplate;
  traversalDistanceMeters: NumericGenerationRange;
}

export interface EnvironmentGenerationBlueprint {
  areas: EnvironmentAreaTemplate[];
  connectors: EnvironmentConnectorTemplate[];
  environmentId: string;
  height: NumericGenerationRange;
  layers: EnvironmentLayerTemplate[];
  layoutId: string;
  locations: EnvironmentLocationTemplate[];
  name: string;
  outletAffordances: OutletAffordance[];
  width: NumericGenerationRange;
}

export interface EnvironmentGenerationRequest {
  blueprint: EnvironmentGenerationBlueprint;
  packageId: string;
  samplerPosition?: number;
  seed: number;
}

export interface EnvironmentGenerationProvenance {
  algorithm: typeof ENVIRONMENT_GENERATOR_ALGORITHM;
  draws: RealizedGenerationDraw[];
  samplerEnd: number;
  samplerStart: number;
  seed: number;
}

export interface GeneratedEnvironmentLayout {
  generation: EnvironmentGenerationProvenance;
  resource: EnvironmentLayoutResourceFile;
}

function validateIdentifier(value: string, path: string): void {
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value)) {
    throw new TypeError(`${path} must be a lowercase semantic identifier`);
  }
}

function validateFractionalBounds(bounds: FractionalBoundsTemplate, path: string): void {
  for (const field of ['height', 'width', 'x', 'y'] as const) {
    validateGenerationRange(bounds[field], `${path}.${field}`, {
      minimum: field === 'height' || field === 'width' ? 0.001 : 0,
      maximum: 1,
    });
  }
  if (bounds.x.maximum + bounds.width.maximum > 1) {
    throw new RangeError(`${path}.x and ${path}.width ranges must remain inside the layout`);
  }
  if (bounds.y.maximum + bounds.height.maximum > 1) {
    throw new RangeError(`${path}.y and ${path}.height ranges must remain inside the layout`);
  }
}

function validateBlueprint(blueprint: EnvironmentGenerationBlueprint): void {
  validateIdentifier(blueprint.environmentId, 'blueprint.environmentId');
  validateIdentifier(blueprint.layoutId, 'blueprint.layoutId');
  if (blueprint.name.trim() === '') throw new TypeError('blueprint.name must not be empty');
  validateGenerationRange(blueprint.width, 'blueprint.width', { minimum: 1, maximum: 100_000 });
  validateGenerationRange(blueprint.height, 'blueprint.height', {
    minimum: 1,
    maximum: 100_000,
  });
  if (blueprint.layers.length === 0) throw new TypeError('blueprint.layers must not be empty');
  const layerIds = new Set<string>();
  for (const [index, layer] of blueprint.layers.entries()) {
    const path = `blueprint.layers[${index}]`;
    validateIdentifier(layer.id, `${path}.id`);
    if (layerIds.has(layer.id)) throw new TypeError(`${path}.id must be unique`);
    layerIds.add(layer.id);
    if (layer.name.trim() === '') throw new TypeError(`${path}.name must not be empty`);
    validateGenerationRange(layer.elevationMeters, `${path}.elevationMeters`, {
      minimum: -10_000,
      maximum: 10_000,
    });
  }

  const areaIds = new Set<string>();
  for (const [index, area] of blueprint.areas.entries()) {
    const path = `blueprint.areas[${index}]`;
    validateIdentifier(area.id, `${path}.id`);
    if (areaIds.has(area.id)) throw new TypeError(`${path}.id must be unique`);
    areaIds.add(area.id);
    if (!layerIds.has(area.layerId)) throw new TypeError(`${path}.layerId must name a layer`);
    validateFractionalBounds(area, path);
    for (const field of ['hearingOcclusion', 'overhead', 'sightOcclusion'] as const) {
      validateGenerationRange(area.cover[field], `${path}.cover.${field}`, {
        minimum: 0,
        maximum: 1,
      });
    }
  }

  const locationIds = new Set<string>();
  for (const [index, location] of blueprint.locations.entries()) {
    const path = `blueprint.locations[${index}]`;
    validateIdentifier(location.id, `${path}.id`);
    if (locationIds.has(location.id)) throw new TypeError(`${path}.id must be unique`);
    locationIds.add(location.id);
    if (!layerIds.has(location.layerId)) throw new TypeError(`${path}.layerId must name a layer`);
    if (location.kind.trim() === '') throw new TypeError(`${path}.kind must not be empty`);
    if (location.name.trim() === '') throw new TypeError(`${path}.name must not be empty`);
    validateFractionalBounds(location, path);
  }

  const connectorIds = new Set<string>();
  for (const [index, connector] of blueprint.connectors.entries()) {
    const path = `blueprint.connectors[${index}]`;
    validateIdentifier(connector.id, `${path}.id`);
    if (connectorIds.has(connector.id)) throw new TypeError(`${path}.id must be unique`);
    connectorIds.add(connector.id);
    for (const [endName, end] of [
      ['from', connector.from],
      ['to', connector.to],
    ] as const) {
      if (!layerIds.has(end.layerId)) {
        throw new TypeError(`${path}.${endName}.layerId must name a layer`);
      }
      validateGenerationRange(end.x, `${path}.${endName}.x`, { minimum: 0, maximum: 1 });
      validateGenerationRange(end.y, `${path}.${endName}.y`, { minimum: 0, maximum: 1 });
    }
    if (connector.from.layerId === connector.to.layerId) {
      throw new TypeError(`${path} must connect two different layers`);
    }
    validateGenerationRange(connector.traversalDistanceMeters, `${path}.traversalDistanceMeters`, {
      minimum: 0.01,
      maximum: 100_000,
    });
  }
}

function drawBounds(
  sampler: GenerationSampler,
  id: string,
  bounds: FractionalBoundsTemplate,
  width: number,
  height: number,
) {
  return {
    height: sampler.number(`${id}.height`, bounds.height).value * height,
    width: sampler.number(`${id}.width`, bounds.width).value * width,
    x: sampler.number(`${id}.x`, bounds.x).value * width,
    y: sampler.number(`${id}.y`, bounds.y).value * height,
  };
}

export function generateEnvironmentLayout(
  request: EnvironmentGenerationRequest,
): GeneratedEnvironmentLayout {
  validateGenerationSeed(request.seed);
  const samplerStart = request.samplerPosition ?? 0;
  validateSamplerPosition(samplerStart);
  validateBlueprint(request.blueprint);
  const sampler = new GenerationSampler(request.seed, samplerStart);
  const prefix = `environment.${request.blueprint.layoutId}`;
  const width = sampler.number(`${prefix}.width`, request.blueprint.width).value;
  const height = sampler.number(`${prefix}.height`, request.blueprint.height).value;
  const layout = {
    areas: request.blueprint.areas.map((area, index) => ({
      ...drawBounds(sampler, `${prefix}.areas[${index}]`, area, width, height),
      cover: {
        hearingOcclusion: sampler.number(
          `${prefix}.areas[${index}].cover.hearingOcclusion`,
          area.cover.hearingOcclusion,
        ).value,
        overhead: sampler.number(`${prefix}.areas[${index}].cover.overhead`, area.cover.overhead)
          .value,
        sightOcclusion: sampler.number(
          `${prefix}.areas[${index}].cover.sightOcclusion`,
          area.cover.sightOcclusion,
        ).value,
      },
      enclosure: area.enclosure,
      id: area.id,
      kind: area.kind,
      label: area.label,
      layerId: area.layerId,
    })),
    connectors: request.blueprint.connectors.map((connector, index) => ({
      from: {
        layerId: connector.from.layerId,
        x: sampler.number(`${prefix}.connectors[${index}].from.x`, connector.from.x).value * width,
        y: sampler.number(`${prefix}.connectors[${index}].from.y`, connector.from.y).value * height,
      },
      id: connector.id,
      kind: connector.kind,
      to: {
        layerId: connector.to.layerId,
        x: sampler.number(`${prefix}.connectors[${index}].to.x`, connector.to.x).value * width,
        y: sampler.number(`${prefix}.connectors[${index}].to.y`, connector.to.y).value * height,
      },
      traversalDistanceMeters: sampler.number(
        `${prefix}.connectors[${index}].traversalDistanceMeters`,
        connector.traversalDistanceMeters,
      ).value,
    })),
    environmentId: request.blueprint.environmentId,
    height,
    layers: request.blueprint.layers.map((layer, index) => ({
      elevationMeters: sampler.number(
        `${prefix}.layers[${index}].elevationMeters`,
        layer.elevationMeters,
      ).value,
      id: layer.id,
      name: layer.name,
    })),
    layoutId: request.blueprint.layoutId,
    locations: request.blueprint.locations.map((location, index) => ({
      ...drawBounds(sampler, `${prefix}.locations[${index}]`, location, width, height),
      id: location.id,
      kind: location.kind,
      layerId: location.layerId,
      name: location.name,
    })),
    name: request.blueprint.name,
    outletAffordances: cloneGenerated(request.blueprint.outletAffordances),
    width,
  };
  const parsed = parseResourceFile(
    {
      address: {
        kind: 'environment-layout',
        packageId: request.packageId,
        resourceId: layout.layoutId,
      },
      layout,
      schemaVersion: 3,
    },
    `generated-environment:${layout.layoutId}`,
  );
  if (parsed.address.kind !== 'environment-layout') {
    throw new TypeError('generated environment resource did not retain its resource kind');
  }
  return freezeGenerated({
    generation: {
      algorithm: ENVIRONMENT_GENERATOR_ALGORITHM,
      draws: cloneGenerated(sampler.draws),
      samplerEnd: sampler.position,
      samplerStart,
      seed: sampler.seed,
    },
    resource: parsed as EnvironmentLayoutResourceFile,
  });
}
