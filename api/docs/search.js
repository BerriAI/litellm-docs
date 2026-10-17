const path = require('node:path');
const {createRerankHandler} = require('../../search/rerank-api');
const {send} = require('../../search/api');
const {readConfig, loadRerankCorpusFiles} = require('../../search/runtime');

let handler;
module.exports = async (req, res) => {
  const started = performance.now();
  try {
    if (!handler) {
      const config = readConfig(process.env, {host: '0.0.0.0'});
      // Explicit files keep Vercel's tracer from bundling the entire built site.
      handler = loadRerankCorpusFiles(
        path.join(process.cwd(), 'build/search-index.json'),
        path.join(process.cwd(), 'build/search-documents.json'),
        path.join(process.cwd(), 'build/search-structure.json'),
      )
        .then(corpus => createRerankHandler({...corpus, config}));
    }
    const ready = await handler;
    res.setHeader('Server-Timing', `corpus;dur=${(performance.now() - started).toFixed(1)}`);
    return await ready(req, res);
  } catch {
    handler = undefined;
    return send(res, 503, {error: 'Search reranking is unavailable. Local search is still available.'});
  }
};
