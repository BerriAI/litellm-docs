const path = require('node:path');
const fs = require('node:fs/promises');
const {createKeywordSearchHandler} = require('../../search/keyword-api');
const {loadIndex} = require('../../search/engine');
const {send} = require('../../search/api');
const {readConfig} = require('../../search/runtime');

let handler;
module.exports = async (req, res) => {
  const started = performance.now();
  try {
    if (!handler) {
      const config = readConfig(process.env, {host: '0.0.0.0'});
      // Keyword search needs only the index, loaded once per function instance.
      handler = fs.readFile(path.join(process.cwd(), 'build/search-index.json'), 'utf8')
        .then(loadIndex)
        .then(index => createKeywordSearchHandler({index, config}));
    }
    const ready = await handler;
    res.setHeader('Server-Timing', `corpus;dur=${(performance.now() - started).toFixed(1)}`);
    return await ready(req, res);
  } catch {
    handler = undefined;
    return send(res, 503, {error: 'Search is unavailable. Please try again.'});
  }
};
