module.exports = function webpackCachePlugin() {
  return {
    name: 'webpack-cache',
    configureWebpack(config) {
      if (!config.cache || typeof config.cache !== 'object' || config.cache.type !== 'filesystem') return;

      // Keep retained Webpack data under Vercel's 1.50 GB build-cache limit.
      const cache = {...config.cache, maxAge: 60 * 60 * 1000, compression: 'gzip'};
      return {cache, mergeStrategy: {cache: 'replace'}};
    },
  };
};
