// Writes build/mcp-models.json: LiteLLM's model price and provider endpoint
// data, normalized exactly as the docs MCP server's model tools use it (see
// mcp/models-data.js). The server reads only this file, so model data is as
// fresh as the last docs deploy.
//
// Runs on Vercel deploys, or locally with MCP_MODELS_SNAPSHOT=1. The GitHub
// API calls are unauthenticated unless GITHUB_TOKEN is set in the Vercel
// project, which avoids shared-IP rate limits. A fetch that
// still fails after retries only warns: the docs deploy goes out, and the
// model tools answer "temporarily unavailable" until the next deploy.

const fs = require('node:fs');
const path = require('node:path');
const {fetchLive} = require('../mcp/models-data');

const FILE = 'mcp-models.json';
const ATTEMPTS = 3;

module.exports = function mcpModelsSnapshotPlugin() {
  return {
    name: 'litellm-mcp-models-snapshot',

    async postBuild({outDir}) {
      if (!process.env.VERCEL && process.env.MCP_MODELS_SNAPSHOT !== '1') return;
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        try {
          const data = await fetchLive();
          await fs.promises.writeFile(path.join(outDir, FILE), JSON.stringify(data));
          console.log(
            `[mcp-models] wrote ${FILE}: ${Object.keys(data.models).length} models, ` +
              `${Object.keys(data.providers).length} providers${data.sha ? ` at ${data.sha.slice(0, 12)}` : ''}`,
          );
          return;
        } catch (err) {
          console.warn(`[mcp-models] attempt ${attempt} of ${ATTEMPTS} failed: ${err.message}`);
          if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, attempt * 5000));
        }
      }
      console.warn(`[mcp-models] model snapshot not written; the model tools will be unavailable until the next deploy`);
    },
  };
};
