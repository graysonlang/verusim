// Bundle `src/index.ts` on demand so plain-Node maintenance scripts can call
// the engine. Node cannot resolve TypeScript's `.js` specifiers back to `.ts`
// files, so scripts reach `src/` the same way tests do: through esbuild, under
// the same resolution rules as the real build.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createDefines } from './defines.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(REPOSITORY_ROOT, 'dist-tests');
const OUT_FILE = path.join(OUT_DIR, 'src-index.bundle.mjs');

/** @returns {Promise<typeof import('../src/index.js')>} */
export async function loadSrc() {
  await mkdir(OUT_DIR, { recursive: true });
  await build({
    entryPoints: [path.join(REPOSITORY_ROOT, 'src', 'index.ts')],
    outfile: OUT_FILE,
    define: createDefines(),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'esnext',
    logLevel: 'warning',
    packages: 'external',
  });
  return import(`${pathToFileURL(OUT_FILE).href}?t=${Date.now()}`);
}
