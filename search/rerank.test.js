const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {once} = require('node:events');
const {createIndex} = require('./engine');
const {createReranker} = require('./rerank');
const {createLabHandler} = require('./lab-server');
const {extractStructure} = require('./page-structure');
const config = {baseUrl: 'https://gateway.example/v1', apiKey: 'server-secret'};
const docs = Array.from({length: 105}, (_, i) => ({id: `p${i}`, title: `Topic ${i}`, heading: 'Setup', text: 'Configure the topic for your team.', url: `/docs/topic_${i}`, type: 'docs'}));
const corpus = {index: createIndex(docs), documents: new Map(docs.map(d => [d.id, d]))};
const answer = (body, probability = 0.6) => new Response(JSON.stringify({model: 'jev-test', answers: Object.fromEntries(Object.keys(body.questions).map(key => [key, {type: 'noul', noul: probability}]))}), {headers: {'x-litellm-response-cost': '0.0001'}});

test('reranks 100 candidates in parallel batches, preserves evidence, sums cost, and caches', async () => {
  const requests = [];
  const ranker = createReranker({...corpus, config, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://gateway.example/v1/systemone');
    const body = JSON.parse(options.body); requests.push(body);
    assert.equal(body.model, 'typesafe/jev-latest');
    assert.ok(Object.keys(body.questions).length <= 10);
    assert.equal(body.max_tokens, undefined);
    assert.ok(!options.body.includes('server-secret'));
    const prompt = Object.values(body.questions)[0].instructions;
    assert.match(prompt, /FIRST page/); assert.match(prompt, /full indexed page/); assert.match(prompt, /Configure the topic/);
    return answer(body);
  }});
  const first = await ranker.rerank('topic');
  assert.equal(first.results.length, 100); assert.equal(requests.length, 10);
  assert.ok(Math.abs(first.costUsd - .001) < 1e-10);
  assert.deepEqual(first.results.map(r => r.originalRank), Array.from({length: 100}, (_, i) => i + 1));
  const repeat = await ranker.rerank(' TOPIC  ');
  assert.equal(requests.length, 10); assert.equal(repeat.cached, true); assert.equal(repeat.costUsd, 0);
});

test('incomplete probabilities fail without caching a misleading ranking', async () => {
  let calls = 0;
  const ranker = createReranker({...corpus, config, fetchImpl: async () => {calls++; return new Response('{"answers":{}}');}});
  await assert.rejects(ranker.rerank('topic'), /incomplete/);
  await assert.rejects(ranker.rerank('topic'), /incomplete/);
  assert.equal(calls, 20);
});

test('aborted searches do not call the provider', async () => {
  let calls = 0;
  const ranker = createReranker({...corpus, config, fetchImpl: async () => {calls++;}});
  const controller = new AbortController(); controller.abort();
  await assert.rejects(ranker.rerank('topic', 'all', controller.signal), {name: 'AbortError'});
  assert.equal(calls, 0);
});

test('extracts article structure including unselected tabs without global navigation or body prose', () => {
  const result = extractStructure(`<title>Setup | LiteLLM</title><meta name="description" content="Configure your integration"><nav><a href="/global">Global navigation</a></nav><ul class="breadcrumbs"><li class="breadcrumbs__item">Authentication</li></ul><article class="theme-doc-markdown"><h1>Setup</h1><h2 id="provider">Provider</h2><ul class="tabs"><li role="tab">Okta</li><li role="tab">Microsoft Entra ID</li></ul><div hidden><h3 id="entra">Entra configuration</h3></div><p>Body text must not become metadata.</p><a href="/docs/teams">Team mapping</a><table><thead><tr><th>Parameter</th><th>Purpose</th></tr></thead><tbody><tr><td>body value</td><td>body value</td></tr></tbody></table><figure><img src="/img/entra.png" alt="Enterprise application"><figcaption>SSO settings</figcaption></figure><div class="codeBlockTitle_test">config.yaml</div><pre class="language-yaml">body code</pre><div class="admonitionHeading_test">Prerequisites</div></article>`, '/docs/setup');
  assert.deepEqual(result.tabs, ['Okta', 'Microsoft Entra ID']);
  assert.ok(result.outline.some(h => h.title === 'Entra configuration'));
  assert.deepEqual(result.tables[0].columns, ['Parameter', 'Purpose']);
  assert.equal(result.images[0].alt, 'Enterprise application');
  assert.deepEqual(result.codeTitles, ['config.yaml']);
  assert.deepEqual(result.admonitionTitles, ['Prerequisites']);
  assert.ok(!JSON.stringify(result).includes('Body text'));assert.ok(!JSON.stringify(result).includes('Global navigation'));
});

test('metadata survives context fitting and oversized provider batches split without losing pages', async () => {
  const structure = Object.fromEntries(docs.map(doc => [doc.url, {tabs: ['Provider setup'], links: Array.from({length: 400}, (_, i) => ({label: `Topic ${i}`, url: '/docs/' + 'x'.repeat(100)}))}]));
  let splits = 0;
  const ranker = createReranker({...corpus, config, pageStructure: structure, fetchImpl: async (_, options) => {
    const body = JSON.parse(options.body);
    const question = Object.values(body.questions)[0].instructions;
    assert.ok(Buffer.byteLength(question) < 31000);assert.match(question, /Provider setup/);assert.match(question, /omittedForContext/);
    if (Object.keys(body.questions).length > 5) {splits++;return new Response('{"error":"max_tokens_exceeded"}', {status: 400});}
    return answer(body);
  }});
  const result = await ranker.rerank('topic');
  assert.equal(result.results.length, 100);assert.equal(splits, 10);
});

test('local server blocks cross-origin calls and extra model or credential fields', async t => {
  let handler, calls = 0;
  const server = http.createServer((req, res) => handler(req, res));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => {server.closeAllConnections(); server.close();});
  const port = server.address().port;
  handler = createLabHandler({port, html: '<h1>Search</h1>', clientScript: '', ranker: {rerank: async () => {calls++;return {results: []};}, candidates: () => []}});
  const post = (body, headers = {}) => fetch(`http://127.0.0.1:${port}/api/rerank`, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
  assert.equal((await post({query: 'topic'}, {origin: 'https://evil.example'})).status, 403);
  assert.equal((await post({query: 'topic', model: 'other'})).status, 400);
  assert.equal((await post({query: 'topic', type: 'other'})).status, 400);
  assert.equal(calls, 0);
  assert.equal((await post({query: 'topic'})).status, 200); assert.equal(calls, 1);
});

function fakeTimers() {
  let now = 0, next = 0; const jobs = new Map();
  return {setTimeout(fn, ms){jobs.set(++next, {fn, at: now + ms});return next;},clearTimeout(id){jobs.delete(id);},tick(ms){now += ms;for(const [id, job] of [...jobs])if(job.at <= now){jobs.delete(id);job.fn();}}};
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('typing is debounced, stale replies are ignored, and repeat queries skip requests', async () => {
  const {SearchSession} = await import('./search-client.mjs');
  const timers = fakeTimers(), calls = [], displayed = [], pending = [];
  const session = new SearchSession({onBaseline: data => displayed.push(data.query),onRanking(){},onRanked: data => displayed.push(data.query),onError: message => assert.fail(message)}, {
    timers, fetchImpl: function(url, options){'use strict';assert.equal(this, undefined);calls.push({url, options});return new Promise(resolve => pending.push(()=>resolve(new Response(JSON.stringify({query: JSON.parse(options.body).query, results: [], costUsd: .001})))));},
  });
  session.search('e');timers.tick(200);session.search('en');timers.tick(200);assert.equal(calls.length, 0);
  session.search('entra');timers.tick(250);assert.equal(calls.length, 1);timers.tick(200);assert.equal(calls.length, 2);
  session.search('redis');assert.ok(calls.every(call => call.options.signal.aborted));
  pending.splice(0).forEach(resolve => resolve());await flush();assert.deepEqual(displayed, []);
  timers.tick(450);assert.equal(calls.length, 4);pending.splice(0).forEach(resolve => resolve());await flush();
  assert.deepEqual(displayed, ['redis', 'redis']);session.search('redis');assert.equal(calls.length, 4);
  session.search('');assert.ok(calls.every(call => call.options.signal.aborted));
});
