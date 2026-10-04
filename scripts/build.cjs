const {spawnSync} = require('node:child_process');

// Leave room for image processing on the 8 GB production build machine.
const env = {DOCUSAURUS_SSR_CONCURRENCY: '4', ...process.env};
console.log(`[build] Rendering up to ${env.DOCUSAURUS_SSR_CONCURRENCY} pages at a time`);

const result = spawnSync(process.execPath, [
  require.resolve('@docusaurus/core/bin/docusaurus.mjs'),
  'build',
  ...process.argv.slice(2),
], {env, stdio: 'inherit'});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
