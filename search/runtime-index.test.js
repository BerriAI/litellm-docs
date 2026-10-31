const test = require('node:test');
const assert = require('node:assert/strict');
const {serialize} = require('node:v8');
const {createIndex, loadIndex, search} = require('./engine');
const {serializeRuntimeIndex, loadRuntimeIndex} = require('./runtime-index');

test('runtime snapshot preserves exact, prefix, typo, section, filter and release results', () => {
  const index = createIndex([
    {id: 'cache', title: 'Caching', heading: 'Redis', url: '/docs/caching#redis', text: 'Configure Redis response caching.'},
    {id: 'cache-ttl', title: 'Caching', heading: 'Cache TTL', url: '/docs/caching#ttl', text: 'Set the Redis cache ttl to 3600.'},
    {id: 'keys', title: 'Virtual Keys', url: '/docs/proxy/virtual_keys', text: 'Track spend and set budgets.'},
    {id: 'blog', title: 'Caching benchmark', url: '/blog/cache', text: 'Redis caching latency compared.', type: 'blog', date: '2026-10-01'},
    {id: 'release', title: 'Release 1.104.1', url: '/release_notes/v1-104-1', text: 'Redis caching improvements.', type: 'release', date: '2026-10-02', version: '1.104.1'},
    {id: 'rc', title: 'Release 1.105.0-rc.1', url: '/release_notes/v1-105-0-rc-1', text: 'Virtual key improvements.', type: 'release', date: '2026-10-03', version: '1.105.0-rc.1'},
  ]);
  const portable = loadIndex(JSON.stringify(index));
  const restored = loadRuntimeIndex(serializeRuntimeIndex(portable));
  for (const query of ['caching', 'cach', 'cachign', 'redis ttl', 'virtualkeys', 'latest stable release', '1.104.1', 'blog caching', 'constructor']) {
    for (const type of ['all', 'docs', 'blog', 'release']) {
      for (const groupPages of [true, false]) {
        const options = {type, groupPages, limit: 100};
        assert.deepEqual(search(restored, query, options), search(portable, query, options), `${query}, ${type}, ${groupPages}`);
      }
    }
  }
  // The restored radix tree and document maps must also survive serialization.
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(portable)));
});

test('runtime snapshot rejects incompatible or incomplete artifacts', () => {
  assert.throws(() => loadRuntimeIndex(serialize({format: 'old'})), /Rebuild/);
  const data = require('node:v8').deserialize(serializeRuntimeIndex(createIndex([])));
  delete data.collections.docs.pages._fieldLength;
  assert.throws(() => loadRuntimeIndex(serialize(data)), /Invalid/);
});
