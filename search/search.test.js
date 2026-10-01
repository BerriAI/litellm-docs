const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createIndex, loadIndex, search, snippet} = require('./engine');
const {extractSections} = require('../plugins/docs-search');
const {answerQuestion} = require('./answer');
const {createHandler} = require('./server');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const docs = [
  {id: 'lens', title: 'LiteLLM Lens', heading: 'Set up analysis', url: '/docs/proxy/lens#setup', text: 'Lens investigates agent traces. Enable tracing with ClickHouse and PostgreSQL.', snippet: 'Investigate agent traces.'},
  {id: 'edits', title: '/images/edits', heading: 'Size limits', url: '/docs/image_edits', text: 'Images must be less than 4MB. Use the same dimensions as the image.', snippet: 'Edit images.'},
  {id: 'config', title: 'Configuration', heading: 'Lens', url: '/docs/proxy/config#lens', text: 'CLICKHOUSE_URL enables the trace store used by Lens.', snippet: 'Configure tracing.'},
  {id: 'cache', title: 'Caching', heading: 'Redis caching', url: '/docs/proxy/caching#redis', text: 'Enable caching by setting cache to true and configure Redis.', snippet: 'Enable response caching.'},
];
const index = createIndex(docs);
const documents = new Map(docs.map(doc => [doc.id, doc]));
const config = {origin: 'https://docs.example.com', baseUrl: 'https://gateway.example.com/v1', apiKey: 'test-only', model: 'test-model'};

test('Lens ranks the actual guide first and does not fuzzy-match less', () => {
  const results = search(index, 'lens');
  assert.equal(results[0].url, '/docs/proxy/lens');
  assert.ok(!results.some(hit => hit.url === '/docs/image_edits'));
});
test('prefix, typo, question, and exact configuration token searches work', () => {
  assert.equal(search(index, 'cach')[0].url, '/docs/proxy/caching');
  assert.equal(search(index, 'cachign')[0].url, '/docs/proxy/caching');
  assert.equal(search(index, 'How do I enable caching?')[0].url, '/docs/proxy/caching');
  assert.equal(search(index, 'CLICKHOUSE_URL')[0].url, '/docs/proxy/config#lens');
  assert.deepEqual(search(index, 'unfindableqzx'), []);
  assert.deepEqual(search(index, 'the and'), []);
});
test('short transpositions and typos find Lens while exact words keep their meaning', () => {
  for (const query of ['lnes', 'lesn', 'lenz', 'lense']) {
    const hits = search(index, query);
    assert.equal(hits[0].url, '/docs/proxy/lens', query);
    assert.equal(hits[0].matchType, 'typo');
  }
  assert.equal(search(index, 'less')[0].url, '/docs/image_edits');
});
test('fuzzy search does not confuse fallbacks and callbacks', () => {
  const sample = createIndex([
    {...docs[0], id: 'fallback', title: 'Fallbacks (Provider Failover)', url: '/docs/fallbacks'},
    {...docs[0], id: 'callback', title: 'Callbacks', url: '/docs/callbacks'},
  ]);
  const results = search(sample, 'fallbaks');
  assert.equal(results[0].url, '/docs/fallbacks');
  assert.ok(!results.some(hit => hit.url === '/docs/callbacks'));
});
test('filters are applied before truncation and use stable page IDs', () => {
  const results = search(index, 'lens', {category: 'Gateway', limit: 1});
  assert.equal(results.length, 1);
  assert.equal(results[0].category, 'Gateway');
  assert.deepEqual(search(index, 'lens', {category: 'Providers'}), []);
  assert.deepEqual(search(index, 'lnes', {category: 'Providers'}), []);
});
test('excerpts show a relevant match far into a section', () => {
  const result = snippet('Introductory filler. '.repeat(50) + 'Set CLICKHOUSE_URL to enable the trace store. More detail. ', ['clickhouse_url']);
  assert.match(result, /CLICKHOUSE_URL/);
  assert.ok(result.length <= 212);
});
test('prototype property names can be indexed and searched', () => {
  const sample = createIndex([{...docs[0], text: 'constructor prototype toString'}]);
  assert.equal(search(sample, 'constructor')[0].title, 'LiteLLM Lens');
});
test('metadata matches can still supply a source to Ask AI', () => {
  const sample = createIndex([{...docs[0], keywords: 'investigations'}]);
  assert.equal(search(sample, 'investigations', {groupPages: false})[0].id, 'lens');
});
test('serialization preserves rankings', () => {
  assert.deepEqual(search(loadIndex(JSON.stringify(index)), 'lens'), search(index, 'lens'));
});
test('rendered docs preserve actual heading anchors, code, and exclude page furniture', () => {
  const html = '<nav>Secret nav noise</nav><article><div class="theme-doc-markdown"><h1>Lens</h1><p>Investigations</p><h2 id="custom-anchor">Set up<a class="hash-link">#</a></h2><pre><code>cache: true\nredis: localhost</code><button>Copy</button></pre><ul><li>Enable tracing</li></ul></div></article><footer>Footer noise</footer>';
  const sections = extractSections(html, '/docs/lens');
  assert.equal(sections[1].url, '/docs/lens#custom-anchor');
  assert.match(sections[1].text, /cache: true\nredis: localhost/);
  assert.match(sections[1].text, /Enable tracing/);
  assert.doesNotMatch(JSON.stringify(sections), /Secret nav|Footer noise|Copy/);
  assert.deepEqual(extractSections('<meta name="robots" content="noindex">' + html, '/docs/private'), []);
});
test('rendered Prism line breaks preserve runnable code in retrieved passages', () => {
  const html = '<div class="theme-doc-markdown"><h1>Setup</h1><pre><code><span>general_settings:<br></span><span>  tracing:<br></span><span>    store: clickhouse<br></span></code></pre></div>';
  assert.equal(extractSections(html, '/docs/setup')[0].text, 'general_settings:\n  tracing:\n    store: clickhouse');
});
test('AI uses server-selected context and returns only indexed citation URLs', async () => {
  const result = await answerQuestion({question: 'Lens', index, documents, config, fetchImpl: async (url, request) => {
    assert.equal(url, config.baseUrl + '/chat/completions');
    assert.equal(request.redirect, 'error');
    const body = JSON.parse(request.body);
    assert.equal(body.model, 'test-model');
    assert.equal(body.tools, undefined);
    assert.match(body.messages[1].content, /ClickHouse/);
    return {ok: true, json: async () => ({choices: [{message: {content: 'Lens investigates agent traces. [1]'}}]})};
  }});
  assert.equal(result.status, 200);
  assert.equal(result.body.sources[0].url, docs[0].url);
});
test('AI abstains on unknown queries without calling a model', async () => {
  const result = await answerQuestion({question: 'unfindableqzx', index, documents, config, fetchImpl: () => assert.fail('must not call model')});
  assert.deepEqual(result.body.sources, []);
  assert.match(result.body.answer, /couldn't find enough/);
});
test('AI retains prerequisite sections from a short matching guide in source order', async () => {
  const guide = [
    {...docs[0], id: 'prerequisites', heading: 'Prerequisites', text: 'Install the database first.'},
    {...docs[0], id: 'connect', heading: 'Connect your agent', text: 'Send agent traces to the gateway.'},
    {...docs[0], id: 'analyzer', heading: 'Configure the analyzer', text: 'Start the analyzer after the agent is connected.'},
  ];
  await answerQuestion({question: 'Configure the analyzer', index: createIndex(guide), documents: new Map(guide.map(doc => [doc.id, doc])), config,
    fetchImpl: async (_, request) => {
      const context = JSON.parse(JSON.parse(request.body).messages[1].content).documentation;
      assert.deepEqual(context.map(doc => doc.heading), guide.map(doc => doc.heading));
      return {ok: true, json: async () => ({choices: [{message: {content: 'Install the database first. [1]'}}]})};
    }});
});
test('AI rejects invalid citations and missing credentials', async () => {
  const result = await answerQuestion({question: 'Lens', index, documents, config, fetchImpl: async () => ({ok: true, json: async () => ({choices: [{message: {content: 'Invented fact. [999]'}}]})})});
  assert.deepEqual(result.body.sources, []);
  assert.equal((await answerQuestion({question: 'Lens', index, documents, config: {}})).status, 503);
});

async function withServer(fn, overrides = {}) {
  const server = http.createServer(createHandler({index, documents, config, ...overrides}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {await fn(`http://127.0.0.1:${server.address().port}/api/docs/ask`);}
  finally {await new Promise(resolve => server.close(resolve));}
}
const post = (question, extra = {}) => ({method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({question}), ...extra});

test('API rejects cross-origin, invalid method, malformed and oversized input', async () => {
  await withServer(async url => {
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await fetch(url, post('Lens', {headers: {'Content-Type': 'application/json', Origin: 'https://evil.example'}}))).status, 403);
    assert.equal((await fetch(url, post('Lens', {headers: {'Content-Type': 'text/plain'}}))).status, 415);
    assert.equal((await fetch(url, post('', {body: '{'}))).status, 400);
    assert.equal((await fetch(url, post('x'.repeat(501)))).status, 400);
    assert.equal((await fetch(url, post('x'.repeat(5000)))).status, 413);
  });
});
test('API rate limits requests even when callers spoof forwarded addresses', async () => {
  await withServer(async url => {
    for (let i = 0; i < 10; i++) assert.equal((await fetch(url, post('unfindableqzx'))).status, 200);
    const response = await fetch(url, post('Lens', {headers: {'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4'}}));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '60');
  });
});
test('API does not expose gateway error bodies or secrets', async () => {
  await withServer(async url => {
    const response = await fetch(url, post('Lens'));
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /test-only|sensitive/);
  }, {fetchImpl: async () => {throw new Error('sensitive test-only');}});
});

test('preview serves only build output, never sibling server configuration', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-search-test-'));
  const buildDir = path.join(root, 'build');
  await fs.mkdir(buildDir);
  await fs.writeFile(path.join(root, '.env.local'), 'SERVER_SECRET');
  await fs.writeFile(path.join(buildDir, 'index.html'), '<h1>Public docs</h1>');
  try {
    await withServer(async url => {
      const origin = new URL(url).origin;
      assert.match(await (await fetch(origin + '/')).text(), /Public docs/);
      for (const pathname of ['/.env.local', '/..%2f.env.local', '/%2e%2e%2f.env.local']) {
        const response = await fetch(origin + pathname);
        assert.equal(response.status, 404);
        assert.doesNotMatch(await response.text(), /SERVER_SECRET/);
      }
    }, {config: {...config, buildDir}});
  } finally {await fs.rm(root, {recursive: true, force: true});}
});
