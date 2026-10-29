const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {once} = require('node:events');
const {createIndex} = require('./engine');
const {createReranker} = require('./rerank');
const {createRerankHandler} = require('./rerank-api');
const {loadRerankCorpus, loadRerankCorpusFiles, readConfig} = require('./runtime');
const {buildSearchIndex} = require('../plugins/docs-search');

const docs = [{id: 'setup', title: 'Topic setup', url: '/docs/setup', text: 'Configure your topic.', type: 'docs'}];
const corpus = {index: createIndex(docs), documents: new Map(docs.map(doc => [doc.id, doc]))};
const config = {publicRerankEnabled: true, origin: 'https://docs.example.com', baseUrl: 'https://gateway.example', apiKey: 'server-only-secret'};
const post = (body = {query: 'topic'}, headers = {}) => ({method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
const success = async (_, request) => Response.json({answers: Object.fromEntries(Object.keys(JSON.parse(request.body).questions).map(key => [key, {noul: .7}]))});
const neverFetch = () => assert.fail('must not call model');
async function serve(t, overrides = {}, parsedBody) {
  const options = {...corpus, config, fetchImpl: success, ...overrides};
  const handler = createRerankHandler(options);
  const server = http.createServer((req, res) => {
    if (parsedBody !== undefined) req.body = parsedBody;
    return handler(req, res);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => {server.closeAllConnections(); server.close();});
  return `http://127.0.0.1:${server.address().port}/api/docs/search`;
}

test('search endpoint restricts transport, origins, configuration and caller-controlled evidence', async t => {
  const url = await serve(t, {fetchImpl: neverFetch});
  assert.equal((await fetch(url)).status, 405);
  for (const headers of [{Origin: 'https://elsewhere.example'}, {'Sec-Fetch-Site': 'cross-site'}]) {
    assert.equal((await fetch(url, post(undefined, headers))).status, 403);
  }
  assert.equal((await fetch(url, post(undefined, {'Content-Type': 'text/plain'}))).status, 415);
  assert.equal((await fetch(url, {...post(), body: '{'})).status, 400);
  assert.equal((await fetch(url, post({query: 'x'.repeat(17000)}))).status, 413);
  for (const body of [null, [], {query: ''}, {query: 'x'.repeat(501)}, {query: 'topic', type: null},
    {query: 'topic', type: 'invalid'}, {query: 'topic', model: 'other'}, {query: 'topic', prompt: 'override'},
    {query: 'topic', documents: docs}, {query: 'topic', baseUrl: 'https://elsewhere.example'}]) {
    assert.equal((await fetch(url, post(body))).status, 400);
  }
});

test('public reranking has a separate opt-in and localhost rejects foreign Host headers', async t => {
  assert.equal(readConfig({DOCS_AI_PUBLIC_ENABLED: 'true'}).publicRerankEnabled, false);
  const disabled = await serve(t, {config: {...config, publicRerankEnabled: false, publicAIEnabled: true}, fetchImpl: neverFetch});
  assert.equal((await fetch(disabled, post())).status, 503);
  const local = await serve(t, {config: {...config, publicRerankEnabled: false, host: '127.0.0.1', origin: 'http://localhost:1234'}, fetchImpl: neverFetch});
  assert.equal((await fetch(local, post())).status, 403);
  const missingKey = await serve(t, {config: {...config, apiKey: undefined}, fetchImpl: neverFetch});
  assert.equal((await fetch(missingKey, post())).status, 503);
});

test('Vercel parsed search bodies are validated and provider errors never expose secrets', async t => {
  for (const [body, status] of [[{query: 'topic'}, 200], [{query: 'topic', apiKey: 'evil'}, 400], [{query: 'x'.repeat(17000)}, 413]]) {
    const url = await serve(t, {}, body);
    assert.equal((await fetch(url, post())).status, status);
  }
  const url = await serve(t, {fetchImpl: async () => {throw new Error(config.apiKey);}});
  const response = await fetch(url, post());
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(!(await response.text()).includes(config.apiKey));
});

test('search attempts are rate limited despite forwarding headers and the window recovers', async t => {
  let clock = 0;
  const url = await serve(t, {now: () => clock});
  for (let i = 0; i < 30; i++) assert.equal((await fetch(url, post())).status, 200);
  const limited = await fetch(url, post(undefined, {'X-Forwarded-For': '1.2.3.4'}));
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60');
  clock = 60000;
  assert.equal((await fetch(url, post())).status, 200);
});

test('search concurrency slots are released after provider failures and disconnects abort upstream', async t => {
  const pending = [];
  const url = await serve(t, {fetchImpl: (_url, options) => new Promise((resolve, reject) => {
    pending.push({reject, signal: options.signal});
    options.signal.addEventListener('abort', () => reject(options.signal.reason), {once: true});
  })});
  const waiting = Array.from({length: 4}, () => fetch(url, post()));
  while (pending.length < 4) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal((await fetch(url, post())).status, 429);
  pending.forEach(item => item.reject(new Error('unavailable')));
  assert.ok((await Promise.all(waiting)).every(response => response.status === 502));
  const controller = new AbortController();
  const disconnected = fetch(url, {...post(), signal: controller.signal}).catch(error => error);
  while (pending.length < 5) await new Promise(resolve => setTimeout(resolve, 5));
  controller.abort(); await disconnected;
  for (let i = 0; i < 100 && !pending[4].signal.aborted; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(pending[4].signal.aborted, true);
});

test('built search structure matches indexed pages and excludes private/noindex pages', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'search-structure-'));
  t.after(() => fs.rm(directory, {recursive: true, force: true}));
  await fs.mkdir(path.join(directory, 'docs'));
  const article = '<article class="theme-doc-markdown"><h1>Topic setup</h1><p>Configure your topic.</p><li role="tab">Provider</li><div hidden><h2 id="hidden">Hidden setup</h2><p>Hidden instructions.</p></div></article>';
  await fs.writeFile(path.join(directory, 'docs/setup.html'), article);
  await fs.writeFile(path.join(directory, 'docs/private.html'), '<meta name="robots" content="noindex">' + article);
  await fs.writeFile(path.join(directory, 'openapi.json'), JSON.stringify({openapi: '3.1.0', paths: {}}));
  await buildSearchIndex({outDir: directory, pages: new Map([['/docs/setup', {}], ['/docs/private', {}]])});
  const loaded = await loadRerankCorpus(directory);
  const explicit = await loadRerankCorpusFiles(...['search-index.json', 'search-documents.json', 'search-structure.json'].map(file => path.join(directory, file)));
  assert.deepEqual(explicit.documents, loaded.documents);
  assert.deepEqual(explicit.pageStructure, loaded.pageStructure);
  assert.deepEqual(Object.keys(loaded.pageStructure), ['/docs/setup']);
  assert.ok(loaded.pageStructure['/docs/setup'].outline.some(item => item.title === 'Hidden setup'));
  const ranker = createReranker({...explicit, config, fetchImpl: (url, options) => {
    assert.match(options.body, /Hidden setup/); assert.match(options.body, /Provider/);
    return success(url, options);
  }});
  assert.equal((await ranker.rerank('topic')).results.length, 1);
});

test('chronological browsing preserves date order without a model call', async () => {
  const pages = ['2026-01-01', '2026-02-01'].map((date, i) => ({id: `b${i}`, url: `/blog/post-${i}`, title: `Article ${i}`, text: 'An article.', type: 'blog', date}));
  const ranker = createReranker({index: createIndex(pages), documents: new Map(pages.map(doc => [doc.id, doc])), config, fetchImpl: neverFetch});
  const result = await ranker.rerank('latest blog posts');
  assert.deepEqual(result.results.map(hit => hit.date), ['2026-02-01', '2026-01-01']);
  assert.equal(result.costUsd, 0);
});
