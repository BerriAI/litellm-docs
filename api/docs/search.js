const path = require('node:path');
const fs = require('node:fs/promises');
const {createKeywordSearchHandler} = require('../../search/keyword-api');
const {loadIndex} = require('../../search/engine');
const {send} = require('../../search/api');
const {readConfig} = require('../../search/runtime');

let handler;
module.exports = async (req, res) => {
  try {
    if (!handler) {
      const config = readConfig(process.env, {host: '0.0.0.0'});
      let index;
      handler = createKeywordSearchHandler({config, getIndex() {
        // Start after request validation and body reading so cold starts do not
        // queue cancelled keystrokes in front of the body-read limit.
        if (!index) index = fs.readFile(path.join(process.cwd(), 'build/search-index.json'), 'utf8')
          .then(loadIndex)
          .catch(error => {index = undefined; throw error;});
        return index;
      }});
    }
    return await handler(req, res);
  } catch {
    handler = undefined;
    return send(res, 503, {error: 'Search is unavailable. Please try again.'});
  }
};
