const fs = require('node:fs/promises');
const path = require('node:path');
const {loadIndex} = require('./engine');
const {BASE_URL} = require('./gateway');
const {isContentUrl} = require('./content');

function readConfig(env, defaults = {}) {
  return {
    ...defaults,
    baseUrl: env.DOCS_AI_BASE_URL || BASE_URL,
    apiKey: env.DOCS_AI_API_KEY,
    botApiKey: env.DOCS_BOT_AI_API_KEY,
    botServiceToken: env.DOCS_BOT_SERVICE_TOKEN,
    botTracingKey: env.DOCS_BOT_TRACING_KEY,
    publicAIEnabled: env.DOCS_AI_PUBLIC_ENABLED === 'true',
    publicRerankEnabled: env.DOCS_SEARCH_RERANK_ENABLED === 'true',
    origin: env.DOCS_ORIGIN || defaults.origin || 'https://docs.litellm.ai',
    tracing: {
      endpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
      key: env.LITELLM_TRACING_KEY,
      protocol: env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL || env.OTEL_EXPORTER_OTLP_PROTOCOL,
    },
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
