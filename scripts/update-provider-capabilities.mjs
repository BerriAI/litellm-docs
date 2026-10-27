// Refreshes src/data/providerCapabilities.json, which the AI Providers landing
// page (docs/providers/index.mdx) uses for the capability filter and the
// one-line summary on each card. Two sources in BerriAI/litellm, merged:
// provider_endpoints_support.json, and the provider code itself
// (litellm/llms/<provider>/<endpoint folder>), because the JSON is edited by
// hand and lags new endpoints. Each card is a top-level entry of
// providersSidebar; a multi-page provider takes the union of every page it
// holds.
//
// scripts/build.cjs runs this on Vercel deploys. If GitHub cannot be reached,
// the committed file is kept.
//
//   node scripts/update-provider-capabilities.mjs [path/to/provider_endpoints_support.json]
import {access, readFile, writeFile} from 'node:fs/promises';
import {get} from 'node:https';
import {createRequire} from 'node:module';

const SOURCE_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/provider_endpoints_support.json';
const TREE_URL = 'https://api.github.com/repos/BerriAI/litellm/git/trees/main?recursive=1';
const OUTPUT_URL = new URL('../src/data/providerCapabilities.json', import.meta.url);
const require = createRequire(import.meta.url);

// Per-provider endpoint fields in provider_endpoints_support.json (each
// endpoint's provider_json_field), grouped into the capabilities a reader
// filters by.
const CAPABILITIES = {
  chat: ['chat_completions', 'messages', 'responses', 'text_completion', 'generateContent', 'interactions'],
  embeddings: ['embeddings'],
  images: ['image_generations', 'image_edits', 'image_variations'],
  audio: ['audio_transcriptions', 'audio_speech', 'realtime'],
  video: ['video_generations'],
  rerank: ['rerank'],
  vector_stores: ['vector_stores_create', 'vector_stores_search'],
};

// Endpoint folders under litellm/llms/<provider>/, grouped the same way.
const CODE_FOLDERS = {
  embeddings: ['embed', 'embedding', 'embeddings', 'gemini_embeddings', 'multimodal_embeddings', 'vertex_embeddings'],
  images: ['image_generation', 'image_edit', 'image_variations'],
  audio: ['audio_transcription', 'transcriptions', 'stt', 'text_to_speech', 'audio_speech', 'speech', 'realtime'],
  video: ['videos'],
  rerank: ['rerank', 'rerank_v2'],
  vector_stores: ['vector_store', 'vector_stores'],
};

// Provider keys whose docs URL in the source file does not point at the page.
const KEY_ALIASES = {
  'providers/nano-gpt': ['nanogpt'],
};

// Pages neither source covers, read from the page itself, so the cards still
// show under the right filters.
const PAGE_CAPABILITIES = {
  'providers/aleph_alpha': ['chat'],
  'providers/anyscale': ['chat'],
  'providers/black_forest_labs_img_edit': ['images'],
  'providers/clf_ai_gateway': ['chat'],
  'providers/opencode_go': ['chat'],
  'providers/ragflow_vector_store': ['vector_stores'],
};

// Refuse to replace the committed file with one that lost more than this share
// of its providers, which means the source changed shape, not that providers
// were dropped.
const MAX_SHRINK = 0.1;

const REQUEST_TIMEOUT_MS = 20_000;

function request(url) {
  const headers = {'User-Agent': 'litellm-docs-provider-capability-sync'};
  if (process.env.GITHUB_TOKEN && url.startsWith('https://api.github.com/')) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return new Promise((resolve, reject) => {
    get(url, {headers}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`Request failed with ${response.statusCode}: ${url}`));
          return;
        }
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    })
      .on('error', reject)
      // A stalled connection must not hold up a deploy (scripts/build.cjs).
      .setTimeout(REQUEST_TIMEOUT_MS, function () {
        this.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`));
      });
  });
}

function docIds(item) {
  if (typeof item === 'string') return [item];
  const ids = [];
  if (item.type === 'doc') ids.push(item.id);
  if (item.link?.type === 'doc') ids.push(item.link.id);
  for (const child of item.items ?? []) ids.push(...docIds(child));
  return ids;
}

// Docusaurus serves index.md and folder/folder.md at the folder's URL.
const docPath = id => `/docs/${id.replace(/\/index$/, '').replace(/([^/]+)\/\1$/, '$1')}`;

const source = JSON.parse(
  process.argv[2] ? await readFile(process.argv[2], 'utf8') : await request(SOURCE_URL),
);

// provider folder -> capabilities its endpoint folders implement
const codeCapabilities = new Map();
for (const {path, type} of JSON.parse(await request(TREE_URL)).tree) {
  const [root, llms, provider, folder, ...rest] = path.split('/');
  if (root !== 'litellm' || llms !== 'llms' || type !== 'tree' || !folder || rest.length) continue;
  for (const [capability, folders] of Object.entries(CODE_FOLDERS)) {
    if (!folders.includes(folder)) continue;
    if (!codeCapabilities.has(provider)) codeCapabilities.set(provider, new Set());
    codeCapabilities.get(provider).add(capability);
  }
}

const byPath = new Map();
const byKey = new Map();
for (const [key, provider] of Object.entries(source.providers)) {
  byKey.set(key, provider);
  const path = (provider.url ?? '').replace(/^https:\/\/docs\.litellm\.ai/, '').replace(/[#?].*$/, '').replace(/\/$/, '');
  if (!byPath.has(path)) byPath.set(path, []);
  byPath.get(path).push([key, provider]);
}

const {providersSidebar} = require('../sidebars.js');
const output = {};
let inGroup = false;
for (const item of providersSidebar) {
  // Entries above the first group label (the landing page, Models & Pricing)
  // are not cards.
  if (item.type === 'html') inGroup = true;
  if (!inGroup || item.type === 'html' || item.type === 'link') continue;
  const ids = docIds(item);
  const cardId = typeof item === 'string' ? item : item.type === 'doc' ? item.id : item.link.id;
  const matches = ids.flatMap(id => byPath.get(docPath(id)) ?? []);
  for (const id of ids) {
    const key = id.split('/').pop();
    for (const alias of [key, ...(KEY_ALIASES[id] ?? [])]) {
      if (byKey.has(alias) && !matches.some(([k]) => k === alias)) matches.push([alias, byKey.get(alias)]);
    }
  }
  if (matches.length === 0) {
    if (PAGE_CAPABILITIES[cardId]) output[cardId] = {capabilities: PAGE_CAPABILITIES[cardId]};
    continue;
  }

  const endpoints = new Set(matches.flatMap(([, p]) => Object.keys(p.endpoints ?? {}).filter(e => p.endpoints[e])));
  const inCode = new Set(matches.flatMap(([key]) => [...(codeCapabilities.get(key) ?? [])]));
  const capabilities = Object.keys(CAPABILITIES).filter(c => inCode.has(c) || CAPABILITIES[c].some(e => endpoints.has(e)));
  const base = cardId.split('/').pop();
  const prefix = (matches.find(([k]) => k === base) ?? matches[0])[0];
  output[cardId] = {prefix, capabilities};
}

const committed = await access(OUTPUT_URL).then(
  async () => Object.keys(JSON.parse(await readFile(OUTPUT_URL, 'utf8'))).length,
  () => 0,
);
const count = Object.keys(output).length;
if (count < committed * (1 - MAX_SHRINK)) {
  throw new Error(`Only ${count} providers matched, down from ${committed}; keeping ${OUTPUT_URL.pathname}`);
}

await writeFile(OUTPUT_URL, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${count} providers to ${OUTPUT_URL.pathname}`);
