import type {
  AuthoredResource,
  CharacterLibraryFile,
  CharacterProfileResourceFile,
  ContentSource,
  EnvironmentLayoutResourceFile,
  EnvironmentLibraryFile,
  PreparedScenario,
  ResourceAddress,
  ResourceCatalog,
  ResourceCatalogEntry,
  ResourceLock,
  ScenarioContent,
  ScenarioFile,
} from '../model/types.js';
import {
  DEFAULT_RESOURCE_PACKAGE_ID,
  parseCharacterLibrary,
  parseEnvironmentLibrary,
  parseResourceFile,
  parseScenario,
  resourceAddressKey,
  ScenarioValidationError,
} from './parse.js';
import { validateReferences } from './references.js';

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function cloneAddress(address: ResourceAddress): ResourceAddress {
  return { kind: address.kind, packageId: address.packageId, resourceId: address.resourceId };
}

function compareAddresses(left: ResourceAddress, right: ResourceAddress): number {
  const leftKey = resourceAddressKey(left);
  const rightKey = resourceAddressKey(right);
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

export function createResourceCatalog(resources: readonly AuthoredResource[]): ResourceCatalog {
  const entries: ResourceCatalogEntry[] = [];
  const byKey = new Map<string, ResourceCatalogEntry>();
  for (const input of resources) {
    const resource = parseResourceFile(input.value, input.source);
    const address = cloneAddress(resource.address);
    const key = resourceAddressKey(address);
    const previous = byKey.get(key);
    if (previous !== undefined) {
      throw new ScenarioValidationError(
        input.source,
        `duplicate resource address "${key}"; first authored at ${previous.source}`,
      );
    }
    const entry = { address, resource, source: input.source };
    entries.push(entry);
    byKey.set(key, entry);
  }
  entries.sort((left, right) => compareAddresses(left.address, right.address));
  return deepFreeze({ entries });
}

export function createResourceCatalogFromLibraries(input: {
  characterLibrary: unknown;
  environmentLibrary: unknown;
}): ResourceCatalog {
  const characters = parseCharacterLibrary(input.characterLibrary);
  const environments = parseEnvironmentLibrary(input.environmentLibrary);
  return createResourceCatalog([
    ...characters.characters.map((profile, index) => ({
      source: `characterLibrary.characters[${index}]`,
      value: {
        address: {
          kind: 'character-profile',
          packageId: DEFAULT_RESOURCE_PACKAGE_ID,
          resourceId: profile.profileId,
        },
        profile,
        schemaVersion: 1,
      } satisfies CharacterProfileResourceFile,
    })),
    ...environments.environments.map((layout, index) => ({
      source: `environmentLibrary.environments[${index}]`,
      value: {
        address: {
          kind: 'environment-layout',
          packageId: DEFAULT_RESOURCE_PACKAGE_ID,
          resourceId: layout.layoutId,
        },
        layout,
        schemaVersion: 2,
      } satisfies EnvironmentLayoutResourceFile,
    })),
  ]);
}

function requiredAddresses(scenario: ScenarioFile): ResourceAddress[] {
  const byKey = new Map<string, ResourceAddress>();
  for (const address of [scenario.environment, ...scenario.characters.map(item => item.profile)]) {
    byKey.set(resourceAddressKey(address), cloneAddress(address));
  }
  return [...byKey.values()].sort(compareAddresses);
}

function catalogEntries(catalog: ResourceCatalog): Map<string, ResourceCatalogEntry> {
  return new Map(catalog.entries.map(entry => [resourceAddressKey(entry.address), entry]));
}

export function prepareScenario(input: {
  catalog: ResourceCatalog;
  scenario: unknown;
}): PreparedScenario {
  const scenario = parseScenario(input.scenario);
  const entries = catalogEntries(input.catalog);
  const lock: ResourceLock = { resources: requiredAddresses(scenario) };
  const resources = lock.resources.map(address => {
    const entry = entries.get(resourceAddressKey(address));
    if (entry === undefined) {
      throw new ScenarioValidationError(
        address.kind === 'character-profile' ? 'scenario.characters' : 'scenario.environment',
        `unknown resource "${resourceAddressKey(address)}"`,
      );
    }
    return entry.resource;
  });
  const characterFiles = resources.filter(
    (resource): resource is CharacterProfileResourceFile =>
      resource.address.kind === 'character-profile',
  );
  const environmentFiles = resources.filter(
    (resource): resource is EnvironmentLayoutResourceFile =>
      resource.address.kind === 'environment-layout',
  );
  const content: ScenarioContent = {
    characterLibrary: {
      characters: characterFiles.map(resource => resource.profile),
      schemaVersion: 7,
    } satisfies CharacterLibraryFile,
    environmentLibrary: {
      environments: environmentFiles.map(resource => resource.layout),
      schemaVersion: 2,
    } satisfies EnvironmentLibraryFile,
    scenario,
  };
  validateReferences(content);
  const profiles = new Map(
    characterFiles.map(resource => [resourceAddressKey(resource.address), resource.profile]),
  );
  const environmentFile = environmentFiles.find(
    resource => resourceAddressKey(resource.address) === resourceAddressKey(scenario.environment),
  );
  if (environmentFile === undefined) throw new Error('Validated resources contain the environment');
  const characters = scenario.characters.map(placement => {
    const profile = profiles.get(resourceAddressKey(placement.profile));
    if (profile === undefined)
      throw new Error('Validated resources contain every character profile');
    return { placement, profile };
  });
  return deepFreeze({
    characters,
    environment: environmentFile.layout,
    resourceLock: lock,
    scenario,
    schemaVersion: 1,
    type: 'verusim-prepared-scenario',
  });
}

export async function prepareScenarioFromSource(input: {
  scenario: unknown;
  source: ContentSource;
}): Promise<PreparedScenario> {
  const scenario = parseScenario(input.scenario);
  const resources: AuthoredResource[] = [];
  for (const address of requiredAddresses(scenario)) {
    resources.push({
      source: resourceAddressKey(address),
      value: await input.source.read(address),
    });
  }
  return prepareScenario({ catalog: createResourceCatalog(resources), scenario });
}

export function prepareScenarioFromLibraries(input: {
  characterLibrary: unknown;
  environmentLibrary: unknown;
  scenario: unknown;
}): PreparedScenario {
  return prepareScenario({
    catalog: createResourceCatalogFromLibraries(input),
    scenario: input.scenario,
  });
}

export function dependencyClosure(prepared: PreparedScenario): readonly ResourceAddress[] {
  return prepared.resourceLock.resources;
}

export function isPreparedScenario(value: unknown): value is PreparedScenario {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'verusim-prepared-scenario'
  );
}
