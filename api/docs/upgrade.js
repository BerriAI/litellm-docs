const {createUpgradeHandler} = require('../../search/upgrade-api');
const {loadReleaseNotes} = require('../../search/upgrade-sources');
const {readConfig} = require('../../search/runtime');
const {send} = require('../../search/api');

let handler;
module.exports = async (req, res) => {
  try {
    handler ||= createUpgradeHandler({notes: loadReleaseNotes(), config: {
      ...readConfig(process.env, {host: '0.0.0.0'}), githubToken: process.env.DOCS_UPGRADE_GITHUB_TOKEN,
    }});
    return await handler(req, res);
  } catch {
    return send(res, 503, {error: 'Upgrade guidance is temporarily unavailable. Please read the release notes below.'});
  }
};
