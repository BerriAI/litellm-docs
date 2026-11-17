const fs = require('node:fs');
const path = require('node:path');

function lstatIfPresent(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function measureEntry(filePath) {
  const stats = lstatIfPresent(filePath);
  if (!stats || stats.isSymbolicLink()) return null;
  if (!stats.isDirectory()) return {bytes: stats.isFile() ? stats.size : 0};

  const children = fs.readdirSync(filePath).map((name) => measureEntry(path.join(filePath, name)));
  return {bytes: children.reduce((total, child) => total + (child?.bytes ?? 0), 0)};
}

function listFiles(directory, prefix = '') {
  return fs.readdirSync(directory).sort().flatMap((name) => {
    const filePath = path.join(directory, name);
    const stats = lstatIfPresent(filePath);
    if (!stats || stats.isSymbolicLink()) return [];
    if (stats.isDirectory()) return listFiles(filePath, path.join(prefix, name));
    if (!stats.isFile()) return [];
    return [{name: path.join(prefix, name), bytes: stats.size}];
  });
}

function measureCache(cacheDir) {
  const root = lstatIfPresent(cacheDir);
  if (!root || root.isSymbolicLink() || !root.isDirectory()) return {entries: [], stores: []};

  const entries = fs.readdirSync(cacheDir).sort().flatMap((name) => {
    const measured = measureEntry(path.join(cacheDir, name));
    return measured ? [{name, bytes: measured.bytes}] : [];
  });
  const webpack = lstatIfPresent(path.join(cacheDir, 'webpack'));
  const stores = webpack && !webpack.isSymbolicLink() && webpack.isDirectory()
    ? fs.readdirSync(path.join(cacheDir, 'webpack')).sort().flatMap((name) => {
      const storeDir = path.join(cacheDir, 'webpack', name);
      const stats = lstatIfPresent(storeDir);
      if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) return [];
      return [{name, files: listFiles(storeDir)}];
    })
    : [];

  return {entries, stores};
}

function formatTopLevelSize(bytes) {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

function formatFileSize(bytes) {
  return `${Math.round(bytes / 1_000_000)} MB`;
}

function logCacheSizes(phase, siteDir) {
  try {
    const {entries, stores} = measureCache(path.join(siteDir, 'node_modules/.cache'));
    if (entries.length === 0) return;

    const summary = entries.map(({name, bytes}) => {
      const storeDetails = name === 'webpack' && stores.length > 0
        ? ` (${stores.map(({name: storeName, files}) => {
          const fileSizes = files.map((file) => `${file.name} ${formatFileSize(file.bytes)}`).join(', ');
          return `${storeName}: ${fileSizes}`;
        }).join('; ')})`
        : '';
      return `${name} ${formatTopLevelSize(bytes)}${storeDetails}`;
    }).join(', ');

    console.log(`[webpack-cache] ${phase}: ${summary}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[webpack-cache] ${phase}: cache size measurement failed: ${message}`);
  }
}

module.exports = function webpackCachePlugin(context) {
  logCacheSizes('before build', context.siteDir);
  return {
    name: 'webpack-cache',
    postBuild() {
      logCacheSizes('after build', context.siteDir);
    },
    configureWebpack(config, isServer) {
      // Docusaurus names its production compilers "client" and "server".
      // Avoid overlapping their peak allocations on the 8 GB build machine.
      const production = config.mode === 'production';
      const buildOptions = production
        ? {parallelism: 16, ...(isServer ? {dependencies: ['client']} : {})}
        : {};
      if (!config.cache || typeof config.cache !== 'object' || config.cache.type !== 'filesystem') return buildOptions;

      // Webpack's default maxAge retains unused entries for 60 days, letting the cache exceed Vercel's 1.50 GB build-cache limit; Vercel then discards the whole cache.
      const cache = {...config.cache, maxAge: 60 * 60 * 1000,
        ...(production ? {compression: 'gzip', maxMemoryGenerations: 0, allowCollectingMemory: true} : {})};
      return {...buildOptions, cache, mergeStrategy: {cache: 'replace'}};
    },
  };
};
