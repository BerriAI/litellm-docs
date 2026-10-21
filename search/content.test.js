const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createIndex, loadIndex, search} = require('./engine');
const {collectPages, extractSections} = require('../plugins/docs-search');
const {sourceLabel, sourceDetail} = require('./content');

const passage = (url, title, extra = {}) => ({id: url, url, title, heading: '', text: 'Configure request routing.', ...extra});

test('article metadata excludes listings, drafts, unlisted content, and external pages', () => {
  const metadata = (permalink, extra = {}) => ({permalink, title: 'Request routing', ...extra});
  const pages = collectPages({
    'docusaurus-plugin-content-docs': {default: {loadedVersions: [{docs: [
      metadata('/docs/routing'), metadata('/docs/integrations/example', {sidebar: 'integrationsSidebar'}),
      metadata('/docs/private', {frontMatter: {unlisted: true}}),
      metadata('/release_notes/', {title: 'Release notes'}),
      metadata('/release_notes/version', {title: 'v2.10.0 - Request routing', frontMatter: {date: '2026-01-02'}}),
    ]}]}},
    'docusaurus-plugin-content-blog': {default: {blogPosts: [
      {metadata: metadata('/blog/routing', {date: '2026-01-02'})},
      {metadata: metadata('/blog/draft', {frontMatter: {draft: true}})},
      {metadata: metadata('https://elsewhere.example/blog/article')},
    ], blogTags: {'/blog/tags/routing': {}}, archive: '/blog/archive'}},
  });
  assert.deepEqual([...pages.keys()], ['/docs/routing', '/docs/integrations/example', '/release_notes/version', '/blog/routing']);
  assert.equal(sourceLabel(pages.get('/docs/integrations/example')), 'Integration guide');
  assert.equal(sourceDetail(pages.get('/release_notes/version')), 'v2.10.0 · Jan 2, 2026');
});

test('blog extraction preserves article headings and code without author or navigation text', () => {
  const html = '<nav>Navigation noise</nav><article><header><h1>Article title</h1><p>Author noise</p></header><div class="markdown"><p>Measured conditions.</p><h2 id="results">Results</h2><pre><code>first line<br>second line</code><button>Copy</button></pre></div><footer>Tag noise</footer></article>';
  const sections = extractSections(html, '/blog/routing', {title: 'Request routing', type: 'blog', date: '2026-01-02'});
  assert.equal(sections[1].url, '/blog/routing#results');
  assert.equal(sections[1].text, 'first line\nsecond line');
  assert.equal(sections[1].date, '2026-01-02');
  assert.doesNotMatch(JSON.stringify(sections), /Navigation noise|Author noise|Tag noise|Copy/);
  assert.deepEqual(extractSections('<meta http-equiv="refresh" content="0;url=/elsewhere">' + html, '/blog/redirect'), []);
});

test('archive growth leaves docs scores unchanged and source filters survive serialization', () => {
  const docs = [passage('/docs/routing', 'Request routing'), passage('/docs/routing-config', 'Routing configuration')];
  const archive = Array.from({length: 80}, (_, i) => passage(`/blog/routing-${i}`, 'Request routing benchmark', {type: 'blog', date: '2025-01-02'}));
  const baseline = search(createIndex(docs), 'request routing', {type: 'docs'});
  const index = loadIndex(JSON.stringify(createIndex([...docs, ...archive])));
  assert.deepEqual(search(index, 'request routing', {type: 'docs'}), baseline);
  assert.equal(search(index, 'request routing')[0].type, 'docs');
  assert.ok(search(index, 'request routing', {type: 'blog'}).every(hit => hit.type === 'blog' && hit.date === '2025-01-02'));
  assert.ok(search(index, 'request routing blog').every(hit => hit.type === 'blog'));
  assert.deepEqual(search(index, 'request routing', {type: 'release'}), []);
});

test('numeric model identifiers and exact release versions cannot match different numbers', () => {
  const index = createIndex([
    passage('/docs/model-one', 'Model 5.5'), passage('/docs/model-two', 'Model 5.43'),
    passage('/release_notes/one', 'v2.10.1', {type: 'release', version: '2.10.1'}),
    passage('/release_notes/two', 'v2.10.10', {type: 'release', version: '2.10.10'}),
  ]);
  for (const query of ['model 5.5', 'model-5-5']) assert.deepEqual(search(index, query).map(hit => hit.url), ['/docs/model-one']);
  assert.deepEqual(search(index, 'v2.10.1').map(hit => hit.version), ['2.10.1']);
  assert.deepEqual(search(index, 'v2.10.9'), []);
});

test('latest queries order dates and versions, exclude prereleases on request, and expose real passage IDs', () => {
  const docs = [
    passage('/release_notes/older', 'v2.8.1', {type: 'release', version: '2.8.1', date: '2026-01-01'}),
    passage('/release_notes/backport', 'v2.9.3', {type: 'release', version: '2.9.3', date: '2026-01-02'}),
    passage('/release_notes/stable', 'v2.10.0', {type: 'release', version: '2.10.0', date: '2026-01-02'}),
    passage('/release_notes/prerelease', 'v2.11.0rc1', {type: 'release', version: '2.11.0-rc1', date: '2026-01-02'}),
    passage('/blog/older', 'Earlier article', {type: 'blog', date: '2026-01-01'}),
    passage('/blog/newer', 'Newer article', {type: 'blog', date: '2026-01-02'}),
  ].map((doc, i) => ({...doc, id: `passage-${i}`}));
  const index = createIndex(docs);
  assert.deepEqual(search(index, 'latest stable release').map(hit => hit.version), ['2.10.0', '2.9.3', '2.8.1']);
  assert.equal(search(index, 'latest releases')[0].version, '2.11.0-rc1');
  for (const query of ['v2.11.0rc1', 'v2.11.0-rc1', 'v2.11.0-rc.1']) {
    assert.equal(search(index, query)[0].version, '2.11.0-rc1');
  }
  for (const query of ['latest release candidate', 'latest prerelease', 'latest RC']) {
    assert.deepEqual(search(index, query).map(hit => hit.version), ['2.11.0-rc1']);
  }
  assert.equal(search(index, 'latest blog posts')[0].url, '/blog/newer');
  assert.deepEqual(search(index, 'latest blog posts', {type: 'docs'}), []);
  assert.deepEqual(search(index, 'latest stable release', {type: 'blog'}), []);
  const passages = search(index, 'latest stable release', {groupPages: false});
  assert.ok(passages.length && passages.every(hit => docs.some(doc => doc.id === hit.id)));
  for (const query of [null, undefined, '', 42, '   ']) assert.deepEqual(search(index, query), []);
});
