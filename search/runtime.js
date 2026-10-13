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
    publicAIEnabled: env.DOCS_AI_PUBLIC_ENABLED === 'true',
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
async function loadCorpusFiles(indexFile, documentsFile) {
  const [index, documents] = await Promise.all([
    fs.readFile(indexFile, 'utf8'),
    fs.readFile(documentsFile, 'utf8'),
  ]);
  const docs = JSON.parse(documents);
  if (!Array.isArray(docs) || !docs.length || docs.some(doc => !isContentUrl(doc.url))) throw new Error('Invalid search corpus');
  return {index: loadIndex(index), documents: new Map(docs.map(doc => [doc.id, doc]))};
}
module.exports = {readConfig, loadCorpus, loadCorpusFiles, isContentUrl};
