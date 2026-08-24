export class ScenarioValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ScenarioValidationError';
    this.path = path;
  }
}
