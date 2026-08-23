import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_ROOT = path.join(REPOSITORY_ROOT, 'content');
const SCENARIO_ROOT = path.join(CONTENT_ROOT, 'scenarios');
const OUTPUT_PATH = path.join(REPOSITORY_ROOT, 'content', 'catalog.generated.ts');
const RESOURCE_KINDS = new Set(['character-profile', 'environment-layout']);
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** @param {string} directory @returns {Promise<string[]>} */
async function discoverResourceFiles(directory) {
  const discovered = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory() && entryPath !== SCENARIO_ROOT) {
      discovered.push(...(await discoverResourceFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) discovered.push(entryPath);
  }
  return discovered.sort();
}

/** @param {string} filePath */
function repositoryPath(filePath) {
  return path.relative(REPOSITORY_ROOT, filePath).split(path.sep).join('/');
}

/** @param {any} value @param {string} source */
function validateAddress(value, source) {
  const address = value?.address;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${source}: expected a resource object`);
  }
  if (typeof address !== 'object' || address === null || Array.isArray(address)) {
    throw new Error(`${source}.address: expected an object`);
  }
  for (const field of ['packageId', 'resourceId']) {
    if (typeof address[field] !== 'string' || !IDENTIFIER.test(address[field])) {
      throw new Error(`${source}.address.${field}: expected a lowercase kebab-case identifier`);
    }
  }
  if (!RESOURCE_KINDS.has(address.kind)) {
    throw new Error(`${source}.address.kind: expected a known resource kind`);
  }
  const supportedVersions = address.kind === 'environment-layout' ? [1, 2, 3] : [1];
  if (!supportedVersions.includes(value.schemaVersion)) {
    throw new Error(`${source}.schemaVersion: expected ${supportedVersions.join(' or ')}`);
  }
  return address;
}

/** @param {any} address */
function addressKey(address) {
  return `${address.packageId}:${address.kind}:${address.resourceId}`;
}

async function generatedSource() {
  const files = await discoverResourceFiles(CONTENT_ROOT);
  const resources = [];
  const sourcesByAddress = new Map();
  for (const filePath of files) {
    const source = repositoryPath(filePath);
    const value = JSON.parse(await readFile(filePath, 'utf8'));
    const address = validateAddress(value, source);
    const key = addressKey(address);
    const previous = sourcesByAddress.get(key);
    if (previous !== undefined) {
      throw new Error(
        `${source}: duplicate resource address "${key}"; first authored at ${previous}`,
      );
    }
    sourcesByAddress.set(key, source);
    resources.push({ filePath, source });
  }
  const imports = resources
    .map(
      (resource, index) =>
        `import resource${index} from './${path.relative(path.dirname(OUTPUT_PATH), resource.filePath).split(path.sep).join('/')}';`,
    )
    .join('\n');
  const entries = resources
    .map(
      (resource, index) =>
        `  Object.freeze({\n    source: '${resource.source}',\n    value: resource${index},\n  }),`,
    )
    .join('\n');
  return `${imports}\nimport type { AuthoredResource } from '../src/model/types.js';\n\nexport const BUILT_IN_RESOURCES: readonly AuthoredResource[] = Object.freeze([\n${entries}\n]);\n`;
}

export async function generateResourceCatalog({ check = false } = {}) {
  const generated = await generatedSource();
  if (!check) {
    await writeFile(OUTPUT_PATH, generated);
    return;
  }
  let current = '';
  try {
    current = await readFile(OUTPUT_PATH, 'utf8');
  } catch {
    // The comparison below reports the same actionable regeneration command.
  }
  if (current !== generated) {
    throw new Error('content/catalog.generated.ts is stale; run npm run catalog:generate');
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  await generateResourceCatalog({ check: process.argv.includes('--check') });
}
