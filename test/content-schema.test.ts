import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parseResourceFile, parseScenario } from '../src/index.js';

const CONTENT_ROOT = path.resolve('content');
const SCENARIO_ROOT = path.join(CONTENT_ROOT, 'scenarios');
const CURRENT_RESOURCE_VERSIONS: Record<string, number> = {
  'character-profile': 1,
  'environment-layout': 3,
  norm: 2,
  'social-contract': 2,
};
const CURRENT_SCENARIO_VERSION = 17;

function jsonFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return jsonFiles(entryPath);
      return entry.name.endsWith('.json') ? [entryPath] : [];
    })
    .sort();
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
}

describe('first-party content schema', () => {
  it('declares the current schema version for every shipped resource and parses as the identity', () => {
    const files = jsonFiles(CONTENT_ROOT).filter(file => !file.startsWith(SCENARIO_ROOT));
    assert.ok(files.length > 0);
    for (const file of files) {
      const value = readJson(file);
      const kind = (value.address as { kind: string }).kind;
      assert.equal(value.schemaVersion, CURRENT_RESOURCE_VERSIONS[kind], file);
      assert.deepEqual(parseResourceFile(value), value, file);
    }
  });

  it('declares the current schema version for every shipped scenario and parses as the identity', () => {
    const files = jsonFiles(SCENARIO_ROOT);
    assert.ok(files.length > 0);
    for (const file of files) {
      const value = readJson(file);
      assert.equal(value.schemaVersion, CURRENT_SCENARIO_VERSION, file);
      assert.deepEqual(parseScenario(value), value, file);
    }
  });
});
