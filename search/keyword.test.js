const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {once, EventEmitter} = require('node:events');
const fs = require('node:fs/promises');
const {PassThrough} = require('node:stream');
const {createHandler} = require('./server');
const {createIndex, search} = require('./engine');
const {createKeywordSearchHandler} = require('./keyword-api');
const flush = () => new Promise(resolve => setImmediate(resolve));

const documents = [
  {id: 'redis', title: 'Redis caching', url: '/docs/caching', text: 'Cache responses in Redis.', type: 'docs'},
  {id: 'blog', title: 'Redis announcement', url: '/blog/redis', text: 'Redis caching announcement.', type: 'blog'},
];
const index = createIndex(documents);
const post = (body = {query: 'redis'}, headers = {}) => ({method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
async function serve(t, parsedBody) {
  const options = {index, documents: new Map(documents.map(doc => [doc.id, doc])),
    config: {origin: 'https://docs.example.com'}, fetchImpl() {assert.fail('keyword search must not call a model');}};
  const handler = parsedBody === undefined ? createHandler(options) : createKeywordSearchHandler(options);
  const server = http.createServer((req, res) => {
    if (parsedBody !== undefined) req.body = parsedBody;
    return handler(req, res);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => {server.closeAllConnections(); server.close();});
  return `http://127.0.0.1:${server.address().port}/api/docs/search`;
}

test('keyword endpoint preserves the engine results without credentials or response caching', async t => {
  const url = await serve(t);
  for (const type of ['all', 'docs', 'blog', 'release']) {
    const response = await fetch(url, post({query: ' Redis ', type}));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json();
    assert.deepEqual(data.results, JSON.parse(JSON.stringify(search(index, 'redis', {type, limit: 100}))));
    assert.equal(data.cached, false);
    assert.equal(data.ranking, 'lexical');
    assert.equal(data.costUsd, 0);
    assert.ok(data.timingsMs.retrieval >= 0);
  }
  // Typing no longer consumes the model endpoint's 30-per-minute allowance.
  for (let i = 0; i < 50; i++) assert.equal((await fetch(url, post({query: `redis ${i}`}))).status, 200);
});

test('keyword endpoint validates transport, origin, query and parsed Vercel bodies', async t => {
  const url = await serve(t);
  assert.equal((await fetch(url)).status, 405);
  assert.equal((await fetch(url, post(undefined, {Origin: 'https://elsewhere.example'}))).status, 403);
  assert.equal((await fetch(url, post(undefined, {'Sec-Fetch-Site': 'cross-site'}))).status, 403);
  assert.equal((await fetch(url, post(undefined, {'Content-Type': 'text/plain'}))).status, 415);
  assert.equal((await fetch(url, {...post(), body: '{'})).status, 400);
  for (const body of [null, [], {query: ''}, {query: 'x'.repeat(501)}, {query: 'redis', type: 'invalid'},
    {query: 'redis', model: 'other'}, {query: 'redis', documents}]) {
    assert.equal((await fetch(url, post(body))).status, 400);
  }
  assert.equal((await fetch(url, post({query: 'x'.repeat(17000)}))).status, 413);
  const parsed = await serve(t, {query: 'redis', type: 'docs'});
  assert.deepEqual((await (await fetch(parsed, post())).json()).results, JSON.parse(JSON.stringify(search(index, 'redis', {type: 'docs', limit: 100}))));
});

function vercelRequest(query = 'redis') {
  const req = Object.assign(new EventEmitter(), {method: 'POST', headers: {'content-type': 'application/json'}, body: {query}});
  const res = Object.assign(new EventEmitter(), {
    setHeader() {},
    writeHead(status) {this.status = status;},
    end(body) {this.body = JSON.parse(body); this.writableEnded = true;},
  });
  return {req, res};
}

function vercelHandler(t) {
  const file = require.resolve('../api/docs/search');
  delete require.cache[file];
  t.after(() => {delete require.cache[file];});
  return require(file);
}

test('Vercel cold start typing skips disconnected requests and serves the latest query', async t => {
  const corpus = Promise.withResolvers();
  const read = t.mock.method(fs, 'readFile', () => corpus.promise);
  const handler = vercelHandler(t);
  const old = Array.from({length: 4}, () => vercelRequest('r'));
  const pending = old.map(({req, res}) => handler(req, res));
  await flush();
  for (const {req, res} of old) {
    req.aborted = true; res.destroyed = true; res.emit('close');
  }
  const latest = vercelRequest();
  pending.push(handler(latest.req, latest.res));
  corpus.resolve(JSON.stringify(index));
  await Promise.all(pending);
  assert.equal(latest.res.status, 200);
  assert.equal(latest.res.body.query, 'redis');
  assert.equal(read.mock.callCount(), 1);
  assert.ok(old.every(({res}) => res.status === undefined));
});

test('Vercel cold start bursts do not count index waits as body reads', async t => {
  const corpus = Promise.withResolvers();
  const read = t.mock.method(fs, 'readFile', () => corpus.promise);
  const handler = vercelHandler(t);
  const requests = Array.from({length: 8}, () => vercelRequest());
  const pending = requests.map(({req, res}) => handler(req, res));
  await flush();
  corpus.resolve(JSON.stringify(index));
  await Promise.all(pending);
  assert.deepEqual(requests.map(({res}) => res.status), Array(8).fill(200));
  assert.equal(read.mock.callCount(), 1);
});

test('Vercel validates requests and skips previous disconnects before loading the index', async t => {
  const read = t.mock.method(fs, 'readFile', () => assert.fail('must not load the index'));
  const handler = vercelHandler(t);
  for (const disconnected of ['request', 'response']) {
    const {req, res} = vercelRequest();
    if (disconnected === 'request') req.aborted = true;
    else res.destroyed = true;
    await handler(req, res);
    assert.equal(res.status, undefined);
  }
  const invalid = vercelRequest('');
  await handler(invalid.req, invalid.res);
  assert.equal(invalid.res.status, 400);
  assert.equal(read.mock.callCount(), 0);
});

test('Vercel retries failed index loads and reuses a successful load', async t => {
  let attempts = 0;
  t.mock.method(fs, 'readFile', async () => {
    if (++attempts === 1) throw new Error('Temporary index read failure');
    return JSON.stringify(index);
  });
  const handler = vercelHandler(t);
  for (const expected of [503, 200, 200]) {
    const {req, res} = vercelRequest();
    // Node can mark a fully consumed request as destroyed while its response is still open.
    req.destroyed = true;
    await handler(req, res);
    assert.equal(res.status, expected);
  }
  assert.equal(attempts, 2);
});

test('streaming body slots remain bounded and are released on disconnect and before index loading', async () => {
  const corpus = Promise.withResolvers();
  const handler = createKeywordSearchHandler({getIndex: () => corpus.promise, config: {origin: 'https://docs.example.com'}});
  const streamed = () => {
    const {req, res} = vercelRequest();
    return {req: Object.assign(new PassThrough(), {method: req.method, headers: req.headers}), res};
  };
  const requests = Array.from({length: 4}, streamed);
  const pending = requests.map(({req, res}) => handler(req, res));
  const limited = streamed();
  await handler(limited.req, limited.res);
  assert.equal(limited.res.status, 429);
  limited.req.destroy();
  requests[0].res.destroyed = true; requests[0].res.emit('close');
  await pending[0];
  const replacement = streamed();
  pending.push(handler(replacement.req, replacement.res));
  assert.equal(replacement.res.status, undefined, 'disconnect frees its body-read slot');
  const live = [...requests.slice(1), replacement];
  for (const {req} of live) req.end(JSON.stringify({query: 'redis'}));
  await flush();
  const latest = streamed();
  pending.push(handler(latest.req, latest.res));
  assert.equal(latest.res.status, undefined, 'index waits do not hold body-read slots');
  latest.req.end(JSON.stringify({query: 'redis'}));
  corpus.resolve(index);
  await Promise.all(pending);
  assert.ok([...live, latest].every(({res}) => res.status === 200));
});

test('keyword client starts immediately, fetches only results, and does not cache repeated queries', async () => {
  const {KeywordSearchSession} = await import('./keyword-client.mjs');
  const calls = [], results = [];
  const session = new KeywordSearchSession({onRequest() {}, onResults: data => results.push(data), onError: assert.fail}, {
    fetchImpl: (url, options) => {
      calls.push({url, options});
      return Promise.resolve(Response.json({query: 'redis', results: []}, {headers: {'Server-Timing': 'corpus;dur=12.3'}}));
    },
  });
  session.search(' Redis ', 'docs');
  assert.equal(calls.length, 1, 'request starts synchronously without a debounce');
  await flush();
  assert.equal(calls[0].url, '/api/docs/search');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.deepEqual(JSON.parse(calls[0].options.body), {query: 'redis', type: 'docs'});
  assert.equal(results[0].clientMetrics.debounce_ms, 0);
  assert.equal(results[0].clientMetrics.corpus_load_ms, 12.3);
  session.search('redis', 'docs'); await flush(); assert.equal(calls.length, 2);
  session.cancel();
});

test('keyword client ignores stale replies and cancelled errors, and surfaces failures for retry', async () => {
  const {KeywordSearchSession} = await import('./keyword-client.mjs');
  const pending = [], results = [], errors = [];
  const session = new KeywordSearchSession({onRequest() {}, onResults: data => results.push(data), onError: error => errors.push(error)}, {
    fetchImpl: (_, options) => new Promise((resolve, reject) => pending.push({options, resolve, reject})),
  });
  session.search('redis', 'all'); session.search('redis', 'docs');
  assert.equal(pending[0].options.signal.aborted, true);
  pending[1].resolve(Response.json({query: 'redis', results: [{type: 'docs'}]})); await flush();
  pending[0].resolve(Response.json({query: 'redis', results: [{type: 'blog'}]})); await flush();
  assert.deepEqual(results.map(data => data.results), [[{type: 'docs'}]]);
  session.search('azure'); session.cancel(); pending[2].reject(new Error('Cancelled')); await flush();
  assert.deepEqual(errors, []);
  session.search('bedrock'); pending[3].resolve(Response.json({error: 'Search is unavailable.'}, {status: 503})); await flush();
  assert.deepEqual(errors, ['Search is unavailable.']);
  session.search(''); assert.equal(pending.length, 4);
  session.cancel();
});
