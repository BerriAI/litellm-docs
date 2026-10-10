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

test('excerpts show a relevant match far into a section', () => {
  const result = snippet('Introductory filler. '.repeat(50) + 'Set CLICKHOUSE_URL to enable the trace store. More detail. ', ['clickhouse_url']);
  assert.match(result, /CLICKHOUSE_URL/);
  assert.ok(result.length <= 212);
});
test('prototype property names can be indexed and searched', () => {
  const sample = createIndex([{...docs[0], text: 'constructor prototype toString'}]);
  assert.equal(search(sample, 'constructor')[0].title, 'LiteLLM Lens');
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
