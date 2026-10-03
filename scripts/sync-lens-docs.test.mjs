import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {transformReadme, validateManifest} from './sync-lens-docs.mjs';

const page = {source: 'agent/README.md', slug: '/integrations/agent', title: 'Agent', description: 'Trace this agent.', category: 'integrations'};
const second = {...page, source: 'other/README.md', slug: '/integrations/other', title: 'Other'};
const revision = 'a'.repeat(40);
const legacy = {anchors: {'quick-start': '/docs/proxy/lens/deployment#quick-start'}};

test('rejects duplicate routes and paths that escape the source repository', () => {
  assert.throws(() => validateManifest({schema_version: 1, pages: [page, {...second, slug: page.slug}]}));
  assert.throws(() => validateManifest({schema_version: 1, pages: [{...page, source: '../README.md'}]}));
});

test('rewrites published READMEs, code links, references, images, and legacy anchors', async () => {
  const source = '# Agent\n\n[Other](../other/README.md#setup)\n\n[Code][code]\n\n[Deploy](https://docs.litellm.ai/docs/proxy/lens#quick-start)\n\n![Trace](trace.png)\n\n[code]: main.py?plain=1#L1\n';
  const files = new Set(['other/README.md', 'agent/main.py', 'agent/trace.png']);
  const result = await transformReadme(source, page, [page, second], revision, async () => Buffer.from('image'), files, legacy);
  assert.match(result.content, /\/lens\/integrations\/other#setup/);
  assert.match(result.content, new RegExp('/blob/' + revision + '/agent/main.py\\?plain=1#L1'));
  assert.match(result.content, /\/lens\/deployment#quick-start/);
  assert.match(result.content, /mdx:\n  format: md/);
  assert.match(result.content, /custom_edit_url:.*\/edit\/main\/agent\/README.md/);
  assert.equal(result.assets.size, 1);
  assert.match(result.content, /\.\.\/assets\/[a-f0-9]+\.png/);
});

test('fails a missing source link before producing generated pages', async () => {
  await assert.rejects(transformReadme('# Agent\n\n[Missing](gone.py)\n', page, [page], revision, async () => Buffer.alloc(0), new Set(), legacy), /Missing relative link/);
});

test('old section and framework links stay within the Proxy Lens category', () => {
  const legacy = JSON.parse(fs.readFileSync(new URL('../docs/proxy/lens/legacy-links.json', import.meta.url), 'utf8'));
  const source = fs.readFileSync(new URL('../src/clientModules/lensLegacyRedirect.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/, '').replace('export function', 'function');
  const redirects = [];
  const context = {legacy, URLSearchParams, window: {location: {replace: (url) => redirects.push(url)}}};
  vm.runInNewContext(source + '\nonRouteDidUpdate({location: {pathname: "/docs/proxy/lens/", search: "", hash: "#quick-start"}});', context);
  vm.runInNewContext(source + '\nonRouteDidUpdate({location: {pathname: "/docs/proxy/lens", search: "?framework=claude", hash: ""}});', context);
  vm.runInNewContext(source + '\nonRouteDidUpdate({location: {pathname: "/docs/proxy/lens", search: "", hash: ""}});', context);
  assert.deepEqual(redirects, ['/docs/proxy/lens/deployment#quick-start', '/docs/proxy/lens/integrations/claude-agent-sdk']);
});
