import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {replaceDirectory, transformReadme, validateManifest} from './sync-lens-docs.mjs';

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

test('replaces imported guides after staging the new directory', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lens-replace-'));
  const stage = path.join(root, '.import-test');
  const destination = path.join(root, 'imported');
  try {
    await fsp.mkdir(stage);
    await fsp.mkdir(destination);
    await fsp.writeFile(path.join(stage, 'new.md'), 'new');
    await fsp.writeFile(path.join(destination, 'old.md'), 'old');

    await replaceDirectory(stage, destination);

    assert.deepEqual(await fsp.readdir(destination), ['new.md']);
    await assert.rejects(fsp.access(stage), {code: 'ENOENT'});
    await assert.rejects(fsp.access(stage + '-previous'), {code: 'ENOENT'});
  } finally {
    await fsp.rm(root, {recursive: true, force: true});
  }
});

test('restores imported guides when installing the stage directory fails', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lens-replace-'));
  const stage = path.join(root, '.import-test');
  const destination = path.join(root, 'imported');
  const failure = new Error('stage rename failed');
  const rename = async (source, target) => {
    if (source === stage) throw failure;
    return fsp.rename(source, target);
  };
  try {
    await fsp.mkdir(stage);
    await fsp.mkdir(destination);
    await fsp.writeFile(path.join(stage, 'new.md'), 'new');
    await fsp.writeFile(path.join(destination, 'old.md'), 'old');

    await assert.rejects(replaceDirectory(stage, destination, {rename}), (error) => error === failure);

    assert.deepEqual(await fsp.readdir(destination), ['old.md']);
    await assert.rejects(fsp.access(stage + '-previous'), {code: 'ENOENT'});
  } finally {
    await fsp.rm(root, {recursive: true, force: true});
  }
});

test('installs imported guides when the destination does not exist yet', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'lens-replace-'));
  const stage = path.join(root, '.import-test');
  const destination = path.join(root, 'imported');
  try {
    await fsp.mkdir(stage);
    await fsp.writeFile(path.join(stage, 'new.md'), 'new');

    await replaceDirectory(stage, destination);

    assert.deepEqual(await fsp.readdir(destination), ['new.md']);
    await assert.rejects(fsp.access(stage), {code: 'ENOENT'});
    await assert.rejects(fsp.access(stage + '-previous'), {code: 'ENOENT'});
  } finally {
    await fsp.rm(root, {recursive: true, force: true});
  }
});

test('old section and framework links stay within the Proxy Lens category', () => {
  const legacy = JSON.parse(fs.readFileSync(new URL('../docs/proxy/lens/legacy-links.json', import.meta.url), 'utf8'));
  const source = fs.readFileSync(new URL('../src/clientModules/lensLegacyRedirect.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/, '').replace('export function', 'function');
  const redirects = [];
  const context = {legacy, URLSearchParams, window: {location: {replace: (url) => redirects.push(url)}}};
  const locations = [
    {pathname: '/docs/proxy/lens/', search: '', hash: '#quick-start'},
    {pathname: '/docs/proxy/lens', search: '?framework=claude', hash: ''},
    {pathname: '/docs/proxy/lens', search: '', hash: ''},
    {pathname: '/docs/proxy/lens', search: '?framework=claude', hash: '#connect-the-analyzer'},
    {pathname: '/docs/proxy/lens', search: '?framework=claude', hash: '#send-your-first-trace'},
    {pathname: '/docs/proxy/lens', search: '?framework=constructor', hash: ''},
    {pathname: '/docs/proxy/lens/deployment', search: '', hash: '#existing-storage-and-secrets'},
    {pathname: '/docs/proxy/lens/deployment/', search: '', hash: '#using-helm'},
    {pathname: '/docs/proxy/lens/deployment', search: '', hash: '#constructor'},
    {pathname: '/docs/proxy/lens/deployment', search: '', hash: '#check-the-installation'},
    {pathname: '/docs/proxy/lens/deployment/storage', search: '', hash: '#gitops'},
  ];
  vm.runInNewContext(source + '\n' + locations.map((location) => 'onRouteDidUpdate(' + JSON.stringify({location}) + ');').join('\n'), context);
  assert.deepEqual(redirects, [
    '/docs/proxy/lens/deployment/local',
    '/docs/proxy/lens/integrations/claude-agent-sdk',
    '/docs/proxy/lens/investigations#connect-the-analyzer',
    '/docs/proxy/lens/integrations/claude-agent-sdk',
    '/docs/proxy/lens/deployment/storage',
    '/docs/proxy/lens/deployment/kubernetes#existing-deployment',
  ]);
});
