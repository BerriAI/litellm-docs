import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {translateFiles} from '../translate.mjs';
import {makeRepo, fakeFetch, noLog} from './helpers.mjs';

const baseOpts = (root, calls, extra = {}) => ({
  repoRoot: root,
  i18nRoot: path.join(root, 'i18n'),
  stagingDir: path.join(root, '.i18n-staging'),
  locale: 'zh-Hans',
  writeTranslations: false,
  fetchImpl: fakeFetch(calls, extra.fetchOpts || {}),
  backoffMs: [1, 1],
  log: noLog,
  ...extra.opts,
});

test('unchanged rerun makes zero fetch calls', async () => {
  const root = makeRepo();
  const calls = [];
  const o = baseOpts(root, calls);
  const r1 = await translateFiles(o);
  assert.equal(r1.exitCode, 0);
  assert.ok(calls.length > 0);
  calls.length = 0;
  const r2 = await translateFiles(baseOpts(root, calls));
  assert.equal(r2.exitCode, 0);
  assert.equal(calls.length, 0);
  assert.ok(r2.summary.filesSkippedUnchanged > 0);
});

test('editing one paragraph sends only that chunk', async () => {
  const root = makeRepo();
  const calls = [];
  await translateFiles(baseOpts(root, calls));
  calls.length = 0;
  const p = path.join(root, 'docs/other.md');
  fs.writeFileSync(p, '# Other\n\nA brand new paragraph.\n');
  const r = await translateFiles(baseOpts(root, calls));
  assert.equal(r.exitCode, 0);
  const sent = calls.flatMap((c) => JSON.parse(c.body.messages[1].content).map((i) => i.text));
  assert.deepEqual(sent, ['A brand new paragraph.']);
});

test('deleted source file prunes target, cache, and manifest entry', async () => {
  const root = makeRepo();
  const calls = [];
  await translateFiles(baseOpts(root, calls));
  const target = path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/other.md');
  const cache = path.join(root, 'i18n/zh-Hans/cache/docs/other.md.json');
  assert.ok(fs.existsSync(target));
  assert.ok(fs.existsSync(cache));
  fs.unlinkSync(path.join(root, 'docs/other.md'));
  await translateFiles(baseOpts(root, calls));
  assert.ok(!fs.existsSync(target));
  assert.ok(!fs.existsSync(cache));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'i18n/zh-Hans/manifest.json')));
  assert.ok(!('docs/other.md' in manifest.files));
});

test('renamed file reuses all chunks from cache with zero model calls', async () => {
  const root = makeRepo();
  const calls = [];
  await translateFiles(baseOpts(root, calls));
  calls.length = 0;
  fs.renameSync(path.join(root, 'docs/other.md'), path.join(root, 'docs/other-renamed.md'));
  const r = await translateFiles(baseOpts(root, calls));
  assert.equal(r.exitCode, 0);
  assert.equal(calls.length, 0);
  const target = path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/other-renamed.md');
  assert.ok(fs.existsSync(target));
  assert.ok(fs.readFileSync(target, 'utf8').includes('ZH:'));
});

test('malformed output then missing id retries, then marks failed', async () => {
  const root = makeRepo();
  const calls = [];
  let n = 0;
  const fetchImpl = async (url, init) => {
    n++;
    const body = JSON.parse(init.body);
    const items = JSON.parse(body.messages[1].content.split('\n\n')[0]);
    const inner = {
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({}),
    };
    if (n === 1) {
      inner.json = async () => ({choices: [{message: {content: 'not json'}}], usage: {}});
    } else {
      // every retry still drops an id, so the chunk stays failed
      const arr = items.map((i) => ({id: i.id, text: `ZH:${i.text}`}));
      arr.pop();
      inner.json = async () => ({choices: [{message: {content: JSON.stringify({translations: arr})}}], usage: {}});
    }
    return inner;
  };
  const o = baseOpts(root, calls, {opts: {files: ['docs/other.md']}});
  o.fetchImpl = fetchImpl;
  const r = await translateFiles(o);
  assert.equal(r.exitCode, 1);
  assert.equal(r.summary.chunksFailed > 0, true);
  assert.equal(n, 3); // 1 attempt + 2 content-level retries for the batch
  assert.ok(!fs.existsSync(path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/other.md')));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'i18n/zh-Hans/manifest.json')));
  assert.equal(manifest.files['docs/other.md'].status, 'partial');
});

test('a fetch that never resolves times out, retries, then fails', async () => {
  const root = makeRepo();
  let n = 0;
  const fetchImpl = (url, init) => {
    n++;
    return new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
  };
  const o = baseOpts(root, [], {opts: {files: ['docs/other.md'], timeoutMs: 50}});
  o.fetchImpl = fetchImpl;
  const r = await translateFiles(o);
  assert.equal(r.exitCode, 1);
  assert.ok(r.summary.chunksFailed > 0);
  assert.equal(n, 3); // 3 request attempts on the first try
});

test('placeholders and anchors preserved; dropped placeholder rejected', async () => {
  const root = makeRepo();
  fs.writeFileSync(
    path.join(root, 'docs/other.md'),
    '# Head {#custom-anchor}\n\nText with {{openai_small}} placeholder.\n',
  );
  const calls = [];
  const r = await translateFiles(baseOpts(root, calls, {opts: {files: ['docs/other.md']}}));
  assert.equal(r.exitCode, 0);
  const out = fs.readFileSync(path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/other.md'), 'utf8');
  assert.ok(out.includes('{#custom-anchor}'));
  assert.ok(out.includes('{{openai_small}}'));
  // now a model that drops the placeholder
  fs.writeFileSync(path.join(root, 'docs/other.md'), '# Head {#custom-anchor}\n\nText with {{openai_small}} changed.\n');
  const calls2 = [];
  const r2 = await translateFiles(
    baseOpts(root, calls2, {
      fetchOpts: {transform: (t) => `ZH:${t.replace(/\{\{[^}]+\}\}/g, '')}`},
      opts: {files: ['docs/other.md']},
    }),
  );
  assert.equal(r2.exitCode, 1);
  assert.ok(r2.summary.failedChunks.length > 0);
});

test('heading without explicit id gets english slug appended', async () => {
  const root = makeRepo();
  const calls = [];
  await translateFiles(baseOpts(root, calls, {opts: {files: ['docs/intro.md']}}));
  const out = fs.readFileSync(path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/intro.md'), 'utf8');
  // the only heading in intro.md is an H1, which gets no injected anchor
  assert.ok(!out.includes('{#getting-started}'));
});

test('h1 gets no injected anchor while h2 in the same doc does', async () => {
  const root = makeRepo();
  fs.writeFileSync(
    path.join(root, 'docs/other.md'),
    '# Top Heading\n\nPara.\n\n## Sub Heading\n\nMore.\n',
  );
  const calls = [];
  const r = await translateFiles(baseOpts(root, calls, {opts: {files: ['docs/other.md']}}));
  assert.equal(r.exitCode, 0, JSON.stringify(r.summary.failedChunks));
  const out = fs.readFileSync(path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/other.md'), 'utf8');
  assert.ok(out.includes('# ZH:Top Heading\n') || /^# ZH:Top Heading$/m.test(out));
  assert.ok(!/{#top-heading}/.test(out));
  assert.ok(out.includes('{#sub-heading}'));
});

test('relative asset paths preserved, md links untouched, code/frontmatter intact', async () => {
  const root = makeRepo();
  const calls = [];
  const r = await translateFiles(baseOpts(root, calls));
  assert.equal(r.exitCode, 0, JSON.stringify(r.summary.failedChunks));
  const blog = fs.readFileSync(
    path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-blog-blog/post-one/index.md'),
    'utf8',
  );
  assert.ok(blog.includes('![pic](./img/a.png)'));
  assert.ok(!blog.includes('@site/'));
  const page = fs.readFileSync(path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-pages/page.md'), 'utf8');
  assert.ok(page.includes("from './styles.module.css'"));
  assert.ok(page.includes('![i](./p.png)'));
  const intro = fs.readFileSync(path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/intro.md'), 'utf8');
  assert.ok(intro.includes('[the docs](./other.md)') || intro.includes('](./other.md)'));
  // frontmatter id/slug byte identical
  assert.ok(intro.includes('id: intro\n'));
  assert.ok(intro.includes('slug: /intro\n'));
  assert.ok(intro.includes('title: "ZH:Introduction"'));
  // fenced code untouched
  assert.ok(intro.includes('```bash\nexport KEY=value\n# comment stays\n```'));
});

test('finished jobs are persisted before later jobs resolve', async () => {
  const root = makeRepo();
  const calls = [];
  const target = path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/intro.md');
  const cacheFile = path.join(root, 'i18n/zh-Hans/cache/docs/intro.md.json');
  const base = fakeFetch(calls);
  const gatedFetch = async (url, init) => {
    // with concurrency 1 the second call starts only after the first job's
    // batches finished; its outputs must already be on disk
    if (calls.length === 1) {
      assert.ok(fs.existsSync(target), 'translated file missing before second job ran');
      assert.ok(fs.existsSync(cacheFile), 'cache file missing before second job ran');
    }
    return base(url, init);
  };
  const r = await translateFiles(baseOpts(root, calls, {opts: {files: ['docs/intro.md', 'docs/other.md'], concurrency: 1, fetchImpl: gatedFetch}}));
  assert.equal(r.exitCode, 0, JSON.stringify(r.summary.failedChunks));
  assert.equal(calls.length, 2);
});

test('explicit {#id} heading does not consume slugger counter', async () => {
  const root = makeRepo();
  fs.writeFileSync(
    path.join(root, 'docs/other.md'),
    '## Overview {#custom-id}\n\nFirst.\n\n## Overview\n\nSecond.\n',
  );
  const calls = [];
  const r = await translateFiles(baseOpts(root, calls, {opts: {files: ['docs/other.md']}}));
  assert.equal(r.exitCode, 0, JSON.stringify(r.summary.failedChunks));
  const out = fs.readFileSync(path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/other.md'), 'utf8');
  assert.ok(out.includes('{#custom-id}'));
  assert.ok(out.includes('{#overview}'));
  assert.ok(!out.includes('{#overview-1}'));
});

test('frontmatter block scalars and empty values are left untouched', async () => {
  const root = makeRepo();
  fs.writeFileSync(
    path.join(root, 'docs/other.md'),
    '---\ntitle: >\n  Folded title\n  continues here\ndescription:\nsidebar_label: Side\n---\n\n# H\n\nBody.\n',
  );
  const calls = [];
  const r = await translateFiles(baseOpts(root, calls, {opts: {files: ['docs/other.md']}}));
  assert.equal(r.exitCode, 0, JSON.stringify(r.summary.failedChunks));
  const out = fs.readFileSync(path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/other.md'), 'utf8');
  assert.ok(out.includes('title: >\n  Folded title\n  continues here\n'));
  assert.ok(out.includes('description:\n'));
  assert.ok(out.includes('sidebar_label: "ZH:Side"'));
});

test('model-added backticks around source identifiers pass; invented spans fail', async () => {
  const root = makeRepo();
  fs.writeFileSync(
    path.join(root, 'docs/other.md'),
    '# H\n\nSend aws_session_tags on every call.\n',
  );
  const calls = [];
  const r = await translateFiles(
    baseOpts(root, calls, {
      fetchOpts: {transform: (t) => t.replace('aws_session_tags', '`aws_session_tags`').replace(/^(#+\s*)/, '$1ZH:').replace(/^((?!#)\S.*)$/m, 'ZH:$1')},
      opts: {files: ['docs/other.md']},
    }),
  );
  assert.equal(r.exitCode, 0, JSON.stringify(r.summary.failedChunks));
  const out = fs.readFileSync(path.join(root, 'i18n/zh-Hans/docusaurus-plugin-content-docs/current/other.md'), 'utf8');
  assert.ok(out.includes('`aws_session_tags`'));

  // invented code span (text not in source) is still rejected
  const calls2 = [];
  fs.writeFileSync(path.join(root, 'docs/other.md'), '# H\n\nSend tags on every call.\n');
  const r2 = await translateFiles(
    baseOpts(root, calls2, {
      fetchOpts: {transform: (t) => t.replace('tags', '`invented_thing`').replace(/^(#+\s*)/, '$1ZH:').replace(/^((?!#)\S.*)$/m, 'ZH:$1')},
      opts: {files: ['docs/other.md']},
    }),
  );
  assert.equal(r2.exitCode, 1);
  assert.ok(r2.summary.failedChunks.length > 0);
});
