// Rewrite every first-party content document to its current schema version.
//
// Each file is run through the ordinary parser, which migrates legacy versions
// and validates the result, and the migrated value is written back. Before any
// file is touched, every built-in scenario is prepared and stepped from both the
// on-disk content and the rewritten content, and the prepared scenarios and
// resulting snapshots must be byte-equivalent: the rewrite may change how
// content is stored, never what it means.
//
// `--check` verifies the invariant the rewrite establishes without writing:
// every document declares its kind's current schema version and parsing it is
// the identity, so no first-party file depends on migration.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSrc } from './load-src.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_ROOT = path.join(REPOSITORY_ROOT, 'content');
const SCENARIO_ROOT = path.join(CONTENT_ROOT, 'scenarios');
const EQUIVALENCE_TICKS = 60;

/** @param {string} directory @returns {Promise<string[]>} */
async function discoverJsonFiles(directory) {
  const discovered = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) discovered.push(...(await discoverJsonFiles(entryPath)));
    else if (entry.isFile() && entry.name.endsWith('.json')) discovered.push(entryPath);
  }
  return discovered.sort();
}

/** @param {string} filePath */
function repositoryPath(filePath) {
  return path.relative(REPOSITORY_ROOT, filePath).split(path.sep).join('/');
}

/** @param {string[]} files */
async function readDocuments(files) {
  return Promise.all(
    files.map(async filePath => ({
      filePath,
      source: repositoryPath(filePath),
      value: JSON.parse(await readFile(filePath, 'utf8')),
    })),
  );
}

/** @param {unknown} value */
function canonical(value) {
  return JSON.stringify(value);
}

async function main() {
  const check = process.argv.includes('--check');
  const src = await loadSrc();
  const allFiles = await discoverJsonFiles(CONTENT_ROOT);
  const resourceFiles = allFiles.filter(file => !file.startsWith(SCENARIO_ROOT + path.sep));
  const scenarioFiles = allFiles.filter(file => file.startsWith(SCENARIO_ROOT + path.sep));
  const resources = await readDocuments(resourceFiles);
  const scenarios = await readDocuments(scenarioFiles);

  const rewrittenResources = resources.map(document => ({
    ...document,
    rewritten: src.parseResourceFile(document.value, document.source),
  }));
  const rewrittenScenarios = scenarios.map(document => ({
    ...document,
    rewritten: src.parseScenario(document.value),
  }));
  const documents = [...rewrittenResources, ...rewrittenScenarios];

  if (check) {
    const stale = documents.filter(
      document => canonical(document.value) !== canonical(document.rewritten),
    );
    for (const document of stale) {
      console.error(`${document.source}: parsing is not the identity; run npm run content:rewrite`);
    }
    if (stale.length > 0) process.exit(1);
    console.log(`content:check: ${documents.length} documents are at their current schema`);
    return;
  }

  const currentCatalog = src.createResourceCatalog(
    resources.map(document => ({ source: document.source, value: document.value })),
  );
  const rewrittenCatalog = src.createResourceCatalog(
    rewrittenResources.map(document => ({ source: document.source, value: document.rewritten })),
  );
  const mismatches = [];
  for (const document of rewrittenScenarios) {
    const before = src.prepareScenario({ catalog: currentCatalog, scenario: document.value });
    const after = src.prepareScenario({ catalog: rewrittenCatalog, scenario: document.rewritten });
    if (canonical(before) !== canonical(after)) {
      mismatches.push(`${document.source}: prepared scenario differs after rewrite`);
      continue;
    }
    const beforeState = src.advanceSimulation(src.createSimulation(before), EQUIVALENCE_TICKS);
    const afterState = src.advanceSimulation(src.createSimulation(after), EQUIVALENCE_TICKS);
    if (
      canonical(src.serializeSnapshot(beforeState)) !== canonical(src.serializeSnapshot(afterState))
    ) {
      mismatches.push(`${document.source}: snapshot after ${EQUIVALENCE_TICKS} ticks differs`);
    }
  }
  if (mismatches.length > 0) {
    for (const mismatch of mismatches) console.error(mismatch);
    console.error('content:rewrite: aborted; no files were written');
    process.exit(1);
  }

  let written = 0;
  for (const document of documents) {
    const output = `${JSON.stringify(document.rewritten, null, 2)}\n`;
    if (canonical(document.value) === canonical(document.rewritten)) continue;
    await writeFile(document.filePath, output);
    written += 1;
  }
  console.log(
    `content:rewrite: ${written} of ${documents.length} documents rewritten; prepared scenarios and ${EQUIVALENCE_TICKS}-tick snapshots are byte-equivalent`,
  );
}

await main();
