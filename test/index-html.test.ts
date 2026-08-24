import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('application document shell', () => {
  it('locks browser viewport scaling without changing the device-width baseline', async () => {
    const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
    const content = html.match(/<meta name="viewport" content="([^"]+)">/)?.[1];
    assert.ok(content);

    const directives = new Map(
      content.split(',').map(directive => {
        const [name, value] = directive.trim().split('=');
        return [name, value] as const;
      }),
    );
    assert.equal(directives.get('width'), 'device-width');
    assert.equal(directives.get('initial-scale'), '1.0');
    assert.equal(directives.get('maximum-scale'), '1.0');
    assert.equal(directives.get('user-scalable'), 'no');
    assert.equal(directives.get('viewport-fit'), 'cover');
  });
});
