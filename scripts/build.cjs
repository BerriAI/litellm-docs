const {spawnSync} = require('node:child_process');

// Leave room for image processing on the 8 GB production build machine.
const env = {DOCUSAURUS_SSR_CONCURRENCY: '2', TERSER_PARALLEL: '2', ...process.env};
console.log(`[build] Rendering up to ${env.DOCUSAURUS_SSR_CONCURRENCY} pages at a time`);

// Node caps the heap near 2 GB inside an 8 GB container, which a cold webpack compile exceeds.
const heapArgs = /--max-old-space-size/.test(env.NODE_OPTIONS ?? '') ? [] : ['--max-old-space-size=6144'];

const result = spawnSync(process.execPath, [
  ...heapArgs,
  require.resolve('@docusaurus/core/bin/docusaurus.mjs'),
  'build',
  ...process.argv.slice(2),
], {env, stdio: 'inherit'});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
