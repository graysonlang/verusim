const UINT32_RANGE = 0x1_0000_0000;
const UINT32_MAX = UINT32_RANGE - 1;

export interface NumericGenerationRange {
  maximum: number;
  minimum: number;
}

export interface IntegerGenerationRange extends NumericGenerationRange {}

export interface RealizedGenerationDraw {
  id: string;
  maximum: number;
  minimum: number;
  position: number;
  unit: number;
  value: number;
}

export function cloneGenerated<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

export function freezeGenerated<Value>(value: Value): Value {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeGenerated(child);
  return value;
}

export function validateGenerationSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new RangeError(`seed must be an integer from 0 through ${UINT32_MAX}`);
  }
}

export function validateSamplerPosition(position: number): void {
  if (!Number.isInteger(position) || position < 0 || position > UINT32_MAX) {
    throw new RangeError(`samplerPosition must be an integer from 0 through ${UINT32_MAX}`);
  }
}

export function validateGenerationRange(
  range: NumericGenerationRange,
  path: string,
  bounds: NumericGenerationRange,
  integer = false,
): void {
  if (!Number.isFinite(range.minimum) || !Number.isFinite(range.maximum)) {
    throw new TypeError(`${path} bounds must be finite numbers`);
  }
  if (range.minimum > range.maximum) {
    throw new RangeError(`${path}.minimum must not exceed ${path}.maximum`);
  }
  if (range.minimum < bounds.minimum || range.maximum > bounds.maximum) {
    throw new RangeError(`${path} must stay within ${bounds.minimum} through ${bounds.maximum}`);
  }
  if (integer && (!Number.isInteger(range.minimum) || !Number.isInteger(range.maximum))) {
    throw new TypeError(`${path} bounds must be integers`);
  }
}

function unitFor(seed: number, position: number): number {
  let value = (seed + Math.imul(position + 1, 0x9e3779b9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x21f0aaad);
  value ^= value >>> 15;
  value = Math.imul(value, 0x735a2d97);
  value ^= value >>> 15;
  return (value >>> 0) / UINT32_RANGE;
}

export class GenerationSampler {
  readonly draws: RealizedGenerationDraw[] = [];
  position: number;

  constructor(
    readonly seed: number,
    position: number,
  ) {
    this.position = position;
  }

  number(id: string, range: NumericGenerationRange): RealizedGenerationDraw {
    if (this.position > UINT32_MAX) throw new RangeError('generation sampler position overflow');
    const position = this.position;
    const unit = unitFor(this.seed, position);
    const draw = {
      id,
      maximum: range.maximum,
      minimum: range.minimum,
      position,
      unit,
      value: range.minimum + (range.maximum - range.minimum) * unit,
    };
    this.position += 1;
    this.draws.push(draw);
    return draw;
  }

  integer(id: string, range: IntegerGenerationRange): RealizedGenerationDraw {
    const draw = this.number(id, range);
    draw.value = Math.min(
      range.maximum,
      range.minimum + Math.floor(draw.unit * (range.maximum - range.minimum + 1)),
    );
    return draw;
  }
}
