import { contentDigest } from './digest.js';
import { arrayValue, objectValue } from './primitives.js';
import type {
  AuthoredResource,
  CharacterLibraryFile,
  CharacterProfileResourceFile,
  ContentSource,
  EnvironmentLayoutResourceFile,
  EnvironmentLibraryFile,
  NormResourceFile,
  PreparedScenario,
  ResourceAddress,
  ResourceCatalog,
  ResourceCatalogEntry,
  ResourceFile,
  ResourceLock,
  ScenarioContent,
  ScenarioFile,
  SocialContractResourceFile,
} from '../model/types.js';
import {
  DEFAULT_RESOURCE_PACKAGE_ID,
  parseCharacterLibrary,
  parseEnvironmentLibrary,
  parseResourceFile,
  parseScenario,
  resourceAddressKey,
  ScenarioValidationError,
  parseResourceAddress,
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
        schemaVersion: 3,
      } satisfies EnvironmentLayoutResourceFile,
    })),
  ]);
}

interface ResourceRequirement {
  address: ResourceAddress;
  missingLabel?: string;
  path: string;
}

function compareRequirements(left: ResourceRequirement, right: ResourceRequirement): number {
  return compareAddresses(left.address, right.address);
}

function directRequirements(scenario: ScenarioFile): ResourceRequirement[] {
  const byKey = new Map<string, ResourceRequirement>();
  const localNormKeys = new Set(
    scenario.legacyLocalNorms.map(norm => resourceAddressKey(norm.address)),
  );
  const add = (address: ResourceAddress, path: string, missingLabel?: string) => {
    const key = resourceAddressKey(address);
    if (!byKey.has(key)) byKey.set(key, { address: cloneAddress(address), missingLabel, path });
  };
  add(scenario.environment, 'scenario.environment');
  scenario.characters.forEach((item, index) => {
    add(item.profile, `scenario.characters[${index}].profile`);
    item.normPerspectives.forEach((perspective, perspectiveIndex) => {
      if (!localNormKeys.has(resourceAddressKey(perspective.norm))) {
        add(
          perspective.norm,
          `scenario.characters[${index}].normPerspectives[${perspectiveIndex}].norm`,
          'norm resource',
        );
      }
    });
  });
  scenario.socialContractPlacements.forEach((item, index) => {
    add(item.contract, `scenario.socialContractPlacements[${index}].contract`);
  });
  return [...byKey.values()].sort(compareRequirements);
}

function resourceRequirements(resource: ResourceFile, source: string): ResourceRequirement[] {
  if (!('contract' in resource)) return [];
  return resource.contract.norms.map((address, index) => ({
    address: cloneAddress(address),
    path: `${source}.contract.norms[${index}]`,
  }));
}

function resolvedCatalogResources(
  scenario: ScenarioFile,
  catalog: ResourceCatalog,
): ResourceFile[] {
  const entries = catalogEntries(catalog);
  const resolved = new Map<string, ResourceFile>();
  const pending = directRequirements(scenario);
  const pendingKeys = new Set(pending.map(item => resourceAddressKey(item.address)));
  while (pending.length > 0) {
    const requirement = pending.shift();
    if (requirement === undefined) break;
    const key = resourceAddressKey(requirement.address);
    pendingKeys.delete(key);
    if (resolved.has(key)) continue;
    const entry = entries.get(key);
    if (entry === undefined) {
      throw new ScenarioValidationError(
        requirement.path,
        `unknown ${requirement.missingLabel ?? 'resource'} "${key}"`,
      );
    }
    resolved.set(key, entry.resource);
    for (const dependency of resourceRequirements(entry.resource, entry.source)) {
      const dependencyKey = resourceAddressKey(dependency.address);
      if (!resolved.has(dependencyKey) && !pendingKeys.has(dependencyKey)) {
        pending.push(dependency);
        pendingKeys.add(dependencyKey);
      }
    }
    pending.sort(compareRequirements);
  }
  return [...resolved.values()].sort((left, right) =>
    compareAddresses(left.address, right.address),
  );
}

function catalogEntries(catalog: ResourceCatalog): Map<string, ResourceCatalogEntry> {
  return new Map(catalog.entries.map(entry => [resourceAddressKey(entry.address), entry]));
}

export function prepareScenario(input: {
  catalog: ResourceCatalog;
  scenario: unknown;
}): PreparedScenario {
  const scenario = parseScenario(input.scenario);
  const resources = resolvedCatalogResources(scenario, input.catalog);
  const lock: ResourceLock = {
    digest: contentDigest(resources),
    resources: resources.map(resource => cloneAddress(resource.address)),
  };
  const characterFiles = resources.filter(
    (resource): resource is CharacterProfileResourceFile =>
      resource.address.kind === 'character-profile',
  );
  const environmentFiles = resources.filter(
    (resource): resource is EnvironmentLayoutResourceFile =>
      resource.address.kind === 'environment-layout',
  );
  const normFiles = resources.filter(
    (resource): resource is NormResourceFile => resource.address.kind === 'norm',
  );
  const socialContractFiles = resources.filter(
    (resource): resource is SocialContractResourceFile =>
      resource.address.kind === 'social-contract',
  );
  const content: ScenarioContent = {
    characterLibrary: {
      characters: characterFiles.map(resource => resource.profile),
      schemaVersion: 7,
    } satisfies CharacterLibraryFile,
    environmentLibrary: {
      environments: environmentFiles.map(resource => resource.layout),
      schemaVersion: 3,
    } satisfies EnvironmentLibraryFile,
    norms: normFiles,
    scenario,
    socialContracts: socialContractFiles,
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
  const resolvedNorms = [
    ...normFiles,
    ...scenario.legacyLocalNorms.map(({ address, ...norm }) => ({
      address,
      norm,
      schemaVersion: 2 as const,
    })),
  ].sort((left, right) => compareAddresses(left.address, right.address));
  return deepFreeze({
    characters,
    environment: environmentFile.layout,
    norms: resolvedNorms,
    resourceLock: lock,
    scenario,
    schemaVersion: 2,
    socialContracts: socialContractFiles,
    type: 'verusim-prepared-scenario',
  });
}

export async function prepareScenarioFromSource(input: {
  scenario: unknown;
  source: ContentSource;
}): Promise<PreparedScenario> {
  const scenario = parseScenario(input.scenario);
  const resources: AuthoredResource[] = [];
  const resolved = new Set<string>();
  const pending = directRequirements(scenario);
  const pendingKeys = new Set(pending.map(item => resourceAddressKey(item.address)));
  while (pending.length > 0) {
    const requirement = pending.shift();
    if (requirement === undefined) break;
    const address = requirement.address;
    const key = resourceAddressKey(address);
    pendingKeys.delete(key);
    if (resolved.has(key)) continue;
    const value = await input.source.read(address);
    const resource = parseResourceFile(value, key);
    resources.push({
      source: key,
      value,
    });
    resolved.add(key);
    for (const dependency of resourceRequirements(resource, key)) {
      const dependencyKey = resourceAddressKey(dependency.address);
      if (!resolved.has(dependencyKey) && !pendingKeys.has(dependencyKey)) {
        pending.push(dependency);
        pendingKeys.add(dependencyKey);
      }
    }
    pending.sort(compareRequirements);
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
  try {
    validatePreparedScenario(value);
    return true;
  } catch {
    return false;
  }
}

/** Validate a prepared scenario's structure at the boundary instead of trusting its discriminator. */
export function validatePreparedScenario(value: unknown): PreparedScenario {
  const path = 'prepared';
  const file = objectValue(value, path);
  if (file.type !== 'verusim-prepared-scenario') {
    throw new ScenarioValidationError(`${path}.type`, 'expected a prepared scenario');
  }
  if (file.schemaVersion !== 2) {
    throw new ScenarioValidationError(`${path}.schemaVersion`, 'unsupported schema version');
  }
  const scenario = objectValue(file.scenario, `${path}.scenario`);
  if (scenario.schemaVersion !== 18) {
    throw new ScenarioValidationError(
      `${path}.scenario.schemaVersion`,
      'unsupported schema version',
    );
  }
  const placements = arrayValue(scenario.characters, `${path}.scenario.characters`);
  const characters = arrayValue(file.characters, `${path}.characters`);
  if (characters.length !== placements.length) {
    throw new ScenarioValidationError(
      `${path}.characters`,
      'must resolve exactly the scenario character placements',
    );
  }
  objectValue(file.environment, `${path}.environment`);
  arrayValue(file.norms, `${path}.norms`);
  arrayValue(file.socialContracts, `${path}.socialContracts`);
  const lock = objectValue(file.resourceLock, `${path}.resourceLock`);
  if (typeof lock.digest !== 'string' || lock.digest.length === 0) {
    throw new ScenarioValidationError(`${path}.resourceLock.digest`, 'expected a content digest');
  }
  const keys = arrayValue(lock.resources, `${path}.resourceLock.resources`).map((address, index) =>
    resourceAddressKey(parseResourceAddress(address, `${path}.resourceLock.resources[${index}]`)),
  );
  if (
    new Set(keys).size !== keys.length ||
    JSON.stringify(keys) !== JSON.stringify([...keys].sort())
  ) {
    throw new ScenarioValidationError(
      `${path}.resourceLock.resources`,
      'expected sorted unique resource addresses',
    );
  }
  return value as PreparedScenario;
}
