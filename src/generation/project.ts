import type {
  AuthoredResource,
  PreparedScenario,
  ResourceAddress,
  ResourceKind,
} from '../model/types.js';
import { ScenarioValidationError } from '../model/validation.js';
import { createResourceCatalog, prepareScenario } from '../scenario/prepare.js';

export interface GenerationProjectFile {
  resources: AuthoredResource[];
  scenario: unknown;
  schemaVersion: 2;
  type: 'verusim-generation-project';
}

export interface GenerationValidationDiagnostic {
  message: string;
  path: string;
}

export interface GenerationValidationSummary {
  characterProfiles: number;
  dyads: number;
  environmentLayouts: number;
  norms: number;
  scenarioCharacters: number;
  socialContracts: number;
}

export interface GenerationValidationReport {
  diagnostics: GenerationValidationDiagnostic[];
  resourceLock: readonly ResourceAddress[];
  summary: GenerationValidationSummary | null;
  valid: boolean;
}

export interface PreparedGenerationProject {
  file: GenerationProjectFile;
  prepared: PreparedScenario;
}

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ScenarioValidationError(path, 'expected an object');
  }
  return value as Record<string, unknown>;
}

function arrayValue(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ScenarioValidationError(path, 'expected an array');
  return value;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ScenarioValidationError(path, 'expected a non-empty string');
  }
  return value;
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function migrateGenerationProject(value: unknown): Record<string, unknown> {
  const file = structuredClone(objectValue(value, 'generationProject'));
  if (file.type !== 'verusim-generation-project') {
    throw new ScenarioValidationError(
      'generationProject.type',
      'expected verusim-generation-project',
    );
  }
  if (file.schemaVersion !== 1 && file.schemaVersion !== 2) {
    throw new ScenarioValidationError(
      'generationProject.schemaVersion',
      'unsupported schema version',
    );
  }
  if (file.schemaVersion === 1) {
    file.resources = arrayValue(file.resources, 'generationProject.resources').map(
      (resource, index) => ({
        source: `generationProject.resources[${index}]`,
        value: resource,
      }),
    );
  }
  file.schemaVersion = 2;
  return file;
}

export function parseGenerationProject(value: unknown): GenerationProjectFile {
  const file = migrateGenerationProject(value);
  const resources = arrayValue(file.resources, 'generationProject.resources').map(
    (entryValue, index) => {
      const entryPath = `generationProject.resources[${index}]`;
      const entry = objectValue(entryValue, entryPath);
      return {
        source: stringValue(entry.source, `${entryPath}.source`),
        value: structuredClone(entry.value),
      };
    },
  );
  return deepFreeze({
    resources,
    scenario: structuredClone(file.scenario),
    schemaVersion: 2,
    type: 'verusim-generation-project',
  });
}

export function prepareGenerationProject(value: unknown): PreparedGenerationProject {
  const file = parseGenerationProject(value);
  const catalog = createResourceCatalog(file.resources);
  const prepared = prepareScenario({ catalog, scenario: file.scenario });
  return deepFreeze({ file, prepared });
}

function diagnosticFor(error: unknown): GenerationValidationDiagnostic {
  const message = error instanceof Error ? error.message : String(error);
  const separator = message.indexOf(': ');
  return {
    message,
    path: separator < 0 ? 'generationProject' : message.slice(0, separator),
  };
}

function countKinds(resources: readonly ResourceAddress[]): Record<ResourceKind, number> {
  const counts: Record<ResourceKind, number> = {
    'character-profile': 0,
    'environment-layout': 0,
    norm: 0,
    'social-contract': 0,
  };
  for (const resource of resources) counts[resource.kind] += 1;
  return counts;
}

export function validateGenerationProject(value: unknown): GenerationValidationReport {
  try {
    const { prepared } = prepareGenerationProject(value);
    const counts = countKinds(prepared.resourceLock.resources);
    return deepFreeze({
      diagnostics: [],
      resourceLock: prepared.resourceLock.resources.map(resource => ({ ...resource })),
      summary: {
        characterProfiles: counts['character-profile'],
        dyads: prepared.scenario.dyads.length,
        environmentLayouts: counts['environment-layout'],
        norms: counts.norm,
        scenarioCharacters: prepared.scenario.characters.length,
        socialContracts: counts['social-contract'],
      },
      valid: true,
    });
  } catch (error) {
    return deepFreeze({
      diagnostics: [diagnosticFor(error)],
      resourceLock: [],
      summary: null,
      valid: false,
    });
  }
}
