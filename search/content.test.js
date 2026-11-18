const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createIndex, loadIndex, search} = require('./engine');
const {collectPages, extractSections} = require('../plugins/docs-search');
const {sourceLabel, sourceDetail} = require('./content');
const {serializeRuntimeIndex, loadRuntimeIndex} = require('./runtime-index');

const passage = (url, title, extra = {}) => ({id: url, url, title, heading: '', text: 'Configure request routing.', ...extra});

test('search results use the rendered parent product instead of the URL folder', () => {
  const cases = [
    ['/docs/proxy/lens/deployment/storage', 'LiteLLM Lens', 'Set up Lens', 'Storage and secrets', 'Lens'],
    ['/docs/benchmarks', 'AI Gateway', 'Performance', 'Benchmarks', 'AI Gateway'],
    ['/docs/proxy/tool_policies', 'MCP Gateway', 'Access Control', 'Tool policies', 'MCP Gateway'],
    ['/docs/response_api', 'Python SDK', 'SDK Functions', 'responses()', 'Python SDK'],
    ['/docs/skills_gateway', 'Agent Gateway', 'Skills', 'Skills gateway', 'Agent Gateway'],
    ['/docs/proxy/auto_routing', 'Auto Router', 'Configuration', 'Routing', 'Auto Router'],
    ['/docs/future_product/setup', 'Future product', 'Deployment', 'Setup', 'Future product'],
  ];
  const documents = cases.flatMap(([url, parent, section, title]) => extractSections(
    `<nav><ol><li class="breadcrumbs__item"><a aria-label="Home page" href="/docs/"></a></li>
      <li class="breadcrumbs__item">${parent}</li><li class="breadcrumbs__item">${section}</li>
      <li class="breadcrumbs__item breadcrumbs__item--active">${title}</li></ol></nav>
      <article class="theme-doc-markdown"><h1>${title}</h1><h2 id="configuration">Configuration</h2><p>Configure request routing.</p></article>`, url));
  const portable = loadIndex(JSON.stringify(createIndex(documents)));
  for (const index of [portable, loadRuntimeIndex(serializeRuntimeIndex(portable))]) {
    for (const groupPages of [true, false]) {
      const results = search(index, 'request routing', {groupPages, limit: 20});
      assert.equal(results.length, cases.length);
      for (const [url, , , , category] of cases) {
        const result = results.find(hit => hit.url.split('#')[0] === url);
        assert.equal(sourceLabel(result), 'Docs');
        assert.equal(sourceDetail(result), category, url);
      }
    }
  }
});

test('product landing pages without parent breadcrumbs keep specific product labels', () => {
  const cases = [
    ['/docs/proxy/lens', 'Lens'], ['/docs/proxy/lens/deployment/storage', 'Lens'],
    ['/docs/simple_proxy', 'AI Gateway'], ['/docs/proxy/config_settings', 'AI Gateway'],
    ['/docs/mcp', 'MCP Gateway'], ['/docs/mcp_authentication', 'MCP Gateway'],
    ['/docs/a2a', 'Agent Gateway'], ['/docs/auto_router/', 'Auto Router'],
    ['/docs/python_sdk', 'Python SDK'], ['/docs/completion/input', 'Python SDK'],
    ['/docs/proxy/lens_other', 'AI Gateway'], ['/docs/mcpherson', 'Docs'],
  ];
  for (const [url, category] of cases) {
    const [result] = search(createIndex([passage(url, 'Configuration')]), 'request routing');
    assert.equal(result.category, category, url);
  }
});

test('explicit integration and API categories and provider ranking categories are preserved', () => {
  const html = '<li class="breadcrumbs__item">OpenAI</li><li class="breadcrumbs__item">Setup</li><article class="theme-doc-markdown"><h1>Setup</h1><p>Configure request routing.</p></article>';
  const cases = [
    ['/docs/tutorials/openai_agents_sdk', {category: 'Integrations'}, 'Integration guide', ''],
    ['/docs/reference', {category: 'API reference'}, 'Docs', 'API reference'],
    ['/docs/providers/openai/responses_api', {}, 'Docs', 'Providers'],
  ];
  for (const [url, metadata, label, detail] of cases) {
    const [result] = search(createIndex(extractSections(html, url, metadata)), 'request routing');
    assert.equal(sourceLabel(result), label);
    assert.equal(sourceDetail(result), detail);
  }
});

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

test('SDK scope follows the Python SDK subtree and includes the standalone LiteAgents doc', () => {
  const docs = [
    ['python_sdk', '/docs/python_sdk'],
    ['response_api', '/docs/response_api'],
    ['harness/index', '/docs/harness'],
    ['liteagents', '/docs/liteagents'],
    ['gateway_overview', '/docs/gateway_overview'],
  ].map(([id, permalink]) => ({id, permalink, title: id, sidebar: 'tutorialSidebar'}));
  const pages = collectPages({
    'docusaurus-plugin-content-docs': {default: {loadedVersions: [{docs, sidebars: {tutorialSidebar: [
      {type: 'category', link: {type: 'doc', id: 'python_sdk'}, items: [
        {type: 'category', items: [{type: 'doc', id: 'response_api'}, {type: 'doc', id: 'harness/index'}]},
        {type: 'link', href: '/docs/gateway_overview'},
      ]},
      {type: 'doc', id: 'liteagents'},
      {type: 'doc', id: 'gateway_overview'},
    ]}}]}},
  });
  const html = '<article class="theme-doc-markdown"><h1>SDK guide</h1><p>Run a harness.</p></article>';
  const sections = [...pages].flatMap(([url, metadata]) => extractSections(html, url, metadata));
  assert.deepEqual(sections.filter(section => section.sdk).map(section => section.url),
    ['/docs/python_sdk', '/docs/response_api', '/docs/harness', '/docs/liteagents']);
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
