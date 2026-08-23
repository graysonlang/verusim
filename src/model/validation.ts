export class ScenarioValidationError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ScenarioValidationError';
  }
}
