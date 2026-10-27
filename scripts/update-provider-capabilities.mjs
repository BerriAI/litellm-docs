// Refreshes src/data/providerCapabilities.json, which the AI Providers landing
// page (docs/providers/index.mdx) uses for the capability filter and the
// one-line summary on each card. Three sources in BerriAI/litellm, merged:
// provider_endpoints_support.json, the provider code itself
// (litellm/llms/<provider>/<endpoint folder>), and the config-only
// OpenAI-compatible providers (litellm/llms/openai_like/providers.json). The
// JSON is generated from the pricing map, so it misses endpoints of providers
// without priced models (self-hosted and pass-through ones). Each card is a top-level entry of
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
const OPENAI_LIKE_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/litellm/llms/openai_like/providers.json';
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
  chat: ['chat', 'completion', 'responses', 'messages'],
  embeddings: ['embed', 'embedding', 'embeddings', 'gemini_embeddings', 'multimodal_embeddings', 'vertex_embeddings'],
  images: ['image_generation', 'image_edit', 'image_variations'],
  audio: ['audio_transcription', 'transcriptions', 'stt', 'text_to_speech', 'audio_speech', 'speech', 'realtime'],
  video: ['videos'],
  rerank: ['rerank', 'rerank_v2'],
  vector_stores: ['vector_store', 'vector_stores'],
};

// supported_endpoints paths in openai_like/providers.json. A provider there
// without the field is a chat provider.
const OPENAI_LIKE_ENDPOINTS = {
  '/v1/chat/completions': 'chat',
  '/v1/responses': 'chat',
  '/v1/messages': 'chat',
  '/v1/embeddings': 'embeddings',
  '/v1/realtime': 'audio',
};

// Provider keys whose docs URL in the source file does not point at the page.
const KEY_ALIASES = {
  'providers/nano-gpt': ['nanogpt'],
};

// Capabilities none of the sources show, checked by hand against the provider's
// page (or, for Ollama embeddings, ollama_embeddings in litellm/main.py).
// Added to whatever the sources say.
const PAGE_CAPABILITIES = {
  'providers/aiml': ['embeddings'],
  'providers/aleph_alpha': ['chat'],
  'providers/anyscale': ['chat'],
  'providers/black_forest_labs_img_edit': ['images'],
  'providers/clf_ai_gateway': ['chat'],
  'providers/custom_llm_server': ['chat', 'embeddings'],
  'providers/litellm_proxy': ['embeddings', 'audio', 'rerank'],
  'providers/ollama': ['embeddings'],
  'providers/opencode_go': ['chat'],
  'providers/qwencloud': ['embeddings', 'rerank'],
  'providers/ragflow_vector_store': ['vector_stores'],
  'providers/xinference': ['embeddings'],
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

// Provider names differ between sources only in "-" versus "_" (scx-ai, scx_ai).
const norm = key => key.replaceAll('-', '_');
const addCapability = (map, provider, capability) => {
  if (!map.has(norm(provider))) map.set(norm(provider), new Set());
  map.get(norm(provider)).add(capability);
};

// provider -> capabilities its code implements
const codeCapabilities = new Map();
for (const {path, type} of JSON.parse(await request(TREE_URL)).tree) {
  const [root, llms, provider, folder, ...rest] = path.split('/');
  if (root !== 'litellm' || llms !== 'llms' || type !== 'tree' || !folder || rest.length) continue;
  for (const [capability, folders] of Object.entries(CODE_FOLDERS)) {
    if (folders.includes(folder)) addCapability(codeCapabilities, provider, capability);
  }
}
for (const [provider, config] of Object.entries(JSON.parse(await request(OPENAI_LIKE_URL)))) {
  const capabilities = config.supported_endpoints
    ? config.supported_endpoints.map(path => OPENAI_LIKE_ENDPOINTS[path]).filter(Boolean)
    : ['chat'];
  for (const capability of capabilities) addCapability(codeCapabilities, provider, capability);
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
  const documented = PAGE_CAPABILITIES[cardId] ?? [];
  if (matches.length === 0) {
    if (documented.length) output[cardId] = {capabilities: documented};
    continue;
  }

  const endpoints = new Set(matches.flatMap(([, p]) => Object.keys(p.endpoints ?? {}).filter(e => p.endpoints[e])));
  const names = [...matches.map(([key]) => key), ...ids.map(id => id.split('/').pop())];
  const inCode = new Set(names.flatMap(name => [...(codeCapabilities.get(norm(name)) ?? [])]));
  const capabilities = Object.keys(CAPABILITIES).filter(
    c => inCode.has(c) || documented.includes(c) || CAPABILITIES[c].some(e => endpoints.has(e)),
  );
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
