const fs = require('node:fs');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {loadIndex, search} = require('./engine');
const index = loadIndex(fs.readFileSync('build/search-index.json', 'utf8'));
const cases = [
  ['lens', '/docs/proxy/lens', 1],
  ['LiteLLM Lens', '/docs/proxy/lens', 1],
  ['How do I set up Lens?', '/docs/proxy/lens', 3],
  ['caching', '/docs/proxy/caching', 3],
  ['fallbacks', '/docs/proxy/reliability', 5],
  ['virtual keys', '/docs/proxy/virtual_keys', 3],
];
for (const [query, expected, top] of cases) {
  const start = performance.now();
  const hits = search(index, query);
  const rank = hits.findIndex(hit => hit.url.split('#')[0] === expected) + 1;
  console.log(`${query}: ${rank ? `rank ${rank}` : 'NOT FOUND'} (${(performance.now() - start).toFixed(1)}ms), first: ${hits[0]?.url}`);
  assert.ok(rank > 0 && rank <= top, `${query}: expected ${expected} in top ${top}`);
}
assert.deepEqual(search(index, 'unfindableqzxv987654321'), []);
console.log('All relevance checks passed.');
