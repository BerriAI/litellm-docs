import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {translateFiles} from '../translate.mjs';
import {stage} from '../stage.mjs';
import {makeRepo, fakeFetch, noLog} from './helpers.mjs';

test('stage.mjs mirrors all roots: translated, english fallback, assets, stale', async () => {
  const root = makeRepo();
  const calls = [];
  const opts = {
    repoRoot: root,
    i18nRoot: path.join(root, 'i18n'),
    stagingDir: path.join(root, '.i18n-staging'),
    locale: 'zh-Hans',
    writeTranslations: false,
    fetchImpl: fakeFetch(calls),
    backoffMs: [1, 1],
    log: noLog,
  };
  await translateFiles({...opts, files: ['docs/intro.md', 'docs/other.md']});
  // make docs/other.md stale by editing the source after translating
  fs.appendFileSync(path.join(root, 'docs/other.md'), '\nMore english.\n');
  const logs = [];
  const res = stage({repoRoot: root, i18nRoot: opts.i18nRoot, stagingDir: opts.stagingDir, log: (s) => logs.push(s)});
  const r = res['zh-Hans'];
  assert.deepEqual(r.staged, ['docs/intro.md']);
  assert.deepEqual(r.stale.sort(), ['docs/other.md']);
  assert.ok(r.missing.includes('src/pages/page.md'));

  const stagedDocs = path.join(root, '.i18n-staging/zh-Hans/docusaurus-plugin-content-docs/current');
  // translated file staged
  assert.ok(fs.readFileSync(path.join(stagedDocs, 'intro.md'), 'utf8').includes('ZH:'));
  // stale translation replaced by the english source, byte-identical
  assert.equal(
    fs.readFileSync(path.join(stagedDocs, 'other.md'), 'utf8'),
    fs.readFileSync(path.join(root, 'docs/other.md'), 'utf8'),
  );
  // untranslated file mirrored byte-identical
  assert.equal(
    fs.readFileSync(path.join(root, '.i18n-staging/zh-Hans/docusaurus-plugin-content-blog-blog/post-one/index.md'), 'utf8'),
    fs.readFileSync(path.join(root, 'blog/post-one/index.md'), 'utf8'),
  );
  // non-md assets mirrored
  assert.ok(fs.existsSync(path.join(root, '.i18n-staging/zh-Hans/docusaurus-plugin-content-blog-blog/post-one/img/a.png')));
  assert.ok(fs.existsSync(path.join(root, '.i18n-staging/zh-Hans/docusaurus-plugin-content-pages/p.png')));
  // fallback.json lists every english copy as @site aliases, sorted
  const fb = JSON.parse(fs.readFileSync(path.join(root, '.i18n-staging/fallback.json')));
  const list = fb['zh-Hans'];
  assert.ok(Array.isArray(list));
  assert.deepEqual([...list].sort(), list);
  assert.ok(list.includes('@site/.i18n-staging/zh-Hans/docusaurus-plugin-content-docs/current/other.md'));
  assert.ok(list.includes('@site/.i18n-staging/zh-Hans/docusaurus-plugin-content-blog-blog/post-one/index.md'));
  assert.ok(!list.includes('@site/.i18n-staging/zh-Hans/docusaurus-plugin-content-docs/current/intro.md'));
  const report = JSON.parse(fs.readFileSync(path.join(root, '.i18n-staging/zh-Hans/staging-report.json')));
  assert.deepEqual(report.staged, r.staged);
});

test('stage.mjs with no locale dir creates empty staging dir and empty fallback.json', async () => {
  const root = makeRepo();
  const res = stage({
    repoRoot: root,
    i18nRoot: path.join(root, 'i18n'),
    stagingDir: path.join(root, '.i18n-staging'),
    log: noLog,
  });
  assert.deepEqual(res, {locales: []});
  assert.ok(fs.existsSync(path.join(root, '.i18n-staging')));
  const fb = JSON.parse(fs.readFileSync(path.join(root, '.i18n-staging/fallback.json')));
  assert.deepEqual(fb, {});
});
