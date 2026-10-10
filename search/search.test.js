const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createIndex, loadIndex, search, snippet} = require('./engine');
const {extractSections} = require('../plugins/docs-search');

const docs = [
  {id: 'lens', title: 'LiteLLM Lens', heading: 'Set up analysis', url: '/docs/proxy/lens#setup', text: 'Lens investigates agent traces. Enable tracing with ClickHouse and PostgreSQL.', snippet: 'Investigate agent traces.'},
  {id: 'edits', title: '/images/edits', heading: 'Size limits', url: '/docs/image_edits', text: 'Images must be less than 4MB. Use the same dimensions as the image.', snippet: 'Edit images.'},
  {id: 'config', title: 'Configuration', heading: 'Lens', url: '/docs/proxy/config#lens', text: 'CLICKHOUSE_URL enables the trace store used by Lens.', snippet: 'Configure tracing.'},
  {id: 'cache', title: 'Caching', heading: 'Redis caching', url: '/docs/proxy/caching#redis', text: 'Enable caching by setting cache to true and configure Redis.', snippet: 'Enable response caching.'},
];
const index = createIndex(docs);

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
