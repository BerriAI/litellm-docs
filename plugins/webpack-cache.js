module.exports = function webpackCachePlugin() {
  return {
    name: 'webpack-cache',
    configureWebpack(config) {
      if (!config.cache || typeof config.cache !== 'object' || config.cache.type !== 'filesystem') return;

      // Webpack's default maxAge retains unused entries for 60 days, letting the cache exceed Vercel's 1.50 GB build-cache limit; Vercel then discards the whole cache.
      const cache = {...config.cache, maxAge: 60 * 60 * 1000};
      return {cache, mergeStrategy: {cache: 'replace'}};
    },
  };
};
