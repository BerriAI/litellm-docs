const path = require('node:path');
const {createAskHandler, send} = require('../../search/api');
const {readConfig, loadCorpusFiles} = require('../../search/runtime');

let handler;
module.exports = async (req, res) => {
  try {
    if (!handler) {
      const config = readConfig(process.env, {host: '0.0.0.0'});
      handler = loadCorpusFiles(path.join(process.cwd(), 'build/search-index.json'), path.join(process.cwd(), 'build/search-documents.json'))
        .then(corpus => createAskHandler({...corpus, config}));
    }
    return await (await handler)(req, res);
  } catch {
    handler = undefined;
    return send(res, 503, {error: 'Ask AI is temporarily unavailable. Document search is still available.'});
  }
};
