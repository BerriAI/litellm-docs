const path = require('node:path');
const {createRerankHandler} = require('../../search/rerank-api');
const {send} = require('../../search/api');
const {readConfig, loadRerankCorpus} = require('../../search/runtime');

let handler;
module.exports = async (req, res) => {
  try {
    if (!handler) {
      const config = readConfig(process.env, {host: '0.0.0.0'});
      handler = loadRerankCorpus(path.join(process.cwd(), 'build'))
        .then(corpus => createRerankHandler({...corpus, config}));
    }
    return await (await handler)(req, res);
  } catch {
    handler = undefined;
    return send(res, 503, {error: 'Search reranking is unavailable. Local search is still available.'});
  }
};
