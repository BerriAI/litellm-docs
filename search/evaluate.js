const fs = require('node:fs');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {loadIndex, search} = require('./engine');
const index = loadIndex(fs.readFileSync('build/search-index.json', 'utf8'));
const cases = require('./relevance-cases.json');
let first = 0;
for (const {query, url: expected, top} of cases) {
  const start = performance.now();
  const hits = search(index, query);
  const rank = hits.findIndex(hit => hit.url.split('#')[0] === expected) + 1;
  if (rank === 1) first += 1;
  console.log(`${query}: ${rank ? `rank ${rank}` : 'NOT FOUND'} (${(performance.now() - start).toFixed(1)}ms), first: ${hits[0]?.url}`);
  assert.ok(rank > 0 && rank <= top, `${query}: expected ${expected} in top ${top}`);
}
assert.deepEqual(search(index, 'unfindableqzxv987654321'), []);
console.log(`All ${cases.length} relevance checks passed; ${first} expected pages ranked first.`);
