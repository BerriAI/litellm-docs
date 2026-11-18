const fs = require('node:fs/promises');
const path = require('node:path');
const {loadIndex} = require('./engine');
const {BASE_URL} = require('./gateway');
const {isContentUrl} = require('./content');

function readConfig(env, defaults = {}) {
  // Select the endpoint and key together; a partial cutover must not reuse an old key.
  const proxyConfigured = env.LITELLM_PROXY_API_BASE !== undefined || env.LITELLM_PROXY_API_KEY !== undefined;
  const cloudflareConfigured = env.CF_ACCESS_CLIENT_ID !== undefined || env.CF_ACCESS_CLIENT_SECRET !== undefined;
  const botCloudflareConfigured = env.DOCS_BOT_CF_ACCESS_CLIENT_ID !== undefined || env.DOCS_BOT_CF_ACCESS_CLIENT_SECRET !== undefined;
  return {
    ...defaults,
    baseUrl: proxyConfigured ? env.LITELLM_PROXY_API_BASE
      : env.DOCS_AI_BASE_URL || (cloudflareConfigured ? undefined : BASE_URL),
    apiKey: proxyConfigured ? env.LITELLM_PROXY_API_KEY : env.DOCS_AI_API_KEY,
    cfAccessClientId: env.CF_ACCESS_CLIENT_ID,
    cfAccessClientSecret: env.CF_ACCESS_CLIENT_SECRET,
    botApiKey: env.DOCS_BOT_AI_API_KEY,
    // Moving website inference must not redirect the bot's existing key.
    botGateway: {
      baseUrl: env.DOCS_BOT_AI_BASE_URL || (botCloudflareConfigured ? undefined : env.DOCS_AI_BASE_URL || BASE_URL),
      cfAccessClientId: env.DOCS_BOT_CF_ACCESS_CLIENT_ID,
      cfAccessClientSecret: env.DOCS_BOT_CF_ACCESS_CLIENT_SECRET,
    },
    botServiceToken: env.DOCS_BOT_SERVICE_TOKEN,
    publicAIEnabled: env.DOCS_AI_PUBLIC_ENABLED === 'true',
    publicRerankEnabled: env.DOCS_SEARCH_RERANK_ENABLED === 'true',
    origin: env.DOCS_ORIGIN || defaults.origin || 'https://docs.litellm.ai',
  };
}
async function loadCorpus(buildDir) {
  return loadCorpusFiles(path.join(buildDir, 'search-index.json'), path.join(buildDir, 'search-documents.json'));
}
async function loadRerankCorpus(buildDir) {
  return loadRerankCorpusFiles(path.join(buildDir, 'search-index.json'), path.join(buildDir, 'search-documents.json'), path.join(buildDir, 'search-structure.json'));
}
async function loadRerankCorpusFiles(indexFile, documentsFile, structureFile) {
  const [corpus, structure] = await Promise.all([
    loadCorpusFiles(indexFile, documentsFile), fs.readFile(structureFile, 'utf8'),
  ]);
  const {pages} = JSON.parse(structure);
  if (!pages || typeof pages !== 'object' || Array.isArray(pages) || Object.keys(pages).some(url => !isContentUrl(url))) {
    throw new Error('Invalid search structure');
  }
  return {...corpus, pageStructure: pages};
}
async function loadCorpusFiles(indexFile, documentsFile) {
  const [index, documents] = await Promise.all([
    fs.readFile(indexFile, 'utf8'),
    fs.readFile(documentsFile, 'utf8'),
  ]);
  const docs = JSON.parse(documents);
  if (!Array.isArray(docs) || !docs.length || docs.some(doc => !isContentUrl(doc.url))) throw new Error('Invalid search corpus');
  return {index: loadIndex(index), documents: new Map(docs.map(doc => [doc.id, doc]))};
}
module.exports = {readConfig, loadCorpus, loadCorpusFiles, loadRerankCorpus, loadRerankCorpusFiles, isContentUrl};
