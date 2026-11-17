// node search/benchmark-startup.js [build directory]
// Each sample starts a new Node process; no index or ranking caches are shared.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {createHash} = require('node:crypto');

if (process.argv[2] === '--worker') {
  const [, , , format, query, directory] = process.argv;
  const started = performance.now();
  const {loadIndex, search} = require('./engine');
  const {loadRuntimeIndex} = require('./runtime-index');
  const moduleMs = performance.now() - started;
  const readStarted = performance.now();
  const buffer = fs.readFileSync(path.join(directory, format === 'json' ? 'search-index.json' : 'search-runtime.bin'));
  const readMs = performance.now() - readStarted;
  const loadStarted = performance.now();
  const index = format === 'json' ? loadIndex(buffer.toString('utf8')) : loadRuntimeIndex(buffer);
  const loadMs = performance.now() - loadStarted;
  const rankStarted = performance.now();
  const results = search(index, query, {type: 'all', limit: 100});
  const rankingMs = performance.now() - rankStarted;
  const totalMs = performance.now() - started;
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const warmStarted = performance.now();
  const warm = search(index, query, {type: 'all', limit: 100});
  const warmMs = performance.now() - warmStarted;
  if (hash(warm) !== hash(results)) throw new Error('Warm results changed');
  console.log(JSON.stringify({format, query, bytes: buffer.length, moduleMs, readMs, loadMs, rankingMs, totalMs, warmMs,
    resultHash: hash(results), maxRssKB: process.resourceUsage().maxRSS}));
} else {
  const directory = path.resolve(process.argv[2] || 'build');
  const samples = [];
  for (const query of ['test', 'caching', 'virtual keys']) {
    for (let run = 0; run < 3; run++) {
      const pair = [];
      for (const format of ['json', 'runtime']) {
        const child = spawnSync(process.execPath, [__filename, '--worker', format, query, directory], {encoding: 'utf8'});
        if (child.status !== 0) throw new Error(child.stderr || child.stdout);
        const sample = JSON.parse(child.stdout);
        pair.push(sample); samples.push(sample);
      }
      if (pair[0].resultHash !== pair[1].resultHash) throw new Error(`Results changed: ${query}`);
    }
  }
  console.log(JSON.stringify({node: process.version, platform: `${process.platform}/${process.arch}`,
    scope: 'Local fresh processes, including index load and first ranking; not Vercel startup or network latency.', samples}, null, 2));
}
