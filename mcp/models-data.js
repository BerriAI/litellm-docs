// Model data for the docs MCP server's model tools (see models.js).
//
// Source of truth is two community-edited files in BerriAI/litellm:
// model_prices_and_context_window.json and provider_endpoints_support.json.
// Anything taken from them ends up in an agent's context, so normalize()
// keeps only numbers, booleans and strings that match strict patterns.
// Free text (source, comment, metadata, notes, display copy) never survives.
//
// The docs build fetches both files once (fetchLive) and writes the normalized
// result to build/mcp-models.json (plugins/mcp-models-snapshot.js). At runtime
// getData() only reads that snapshot, so docs and model data always come from
// the same deploy and the server never calls GitHub. Data is as fresh as the
// last docs deploy, which is fine for docs.

const fs = require('node:fs');
const path = require('node:path');

const RAW = 'https://raw.githubusercontent.com/BerriAI/litellm';
const PRICES_URL = `${RAW}/main/model_prices_and_context_window.json`;
const ENDPOINTS_URL = `${RAW}/main/provider_endpoints_support.json`;
// raw.githubusercontent.com caches main for up to five minutes, so once the
// head of main is known both files are read at that commit instead.
const atCommit = (url, sha) => (sha ? url.replace('/main/', `/${sha}/`) : url);
const API = 'https://api.github.com/repos/BerriAI/litellm/commits';
const HEAD_URL = `${API}/main`;
// The last commit that touched the price file, shown in tool answers.
const COMMITS_URL = `${API}?path=model_prices_and_context_window.json&per_page=1`;
// Price-file key -> page slug, published by the models.litellm.ai build.
const SLUGS_URL = 'https://models.litellm.ai/models/slugs.json';

const TIMEOUT_MS = 15000;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SIDE_BYTES = 2 * 1024 * 1024;
const VERSION = 1;

// Price-file keys. No whitespace or URLs (no "://"), at most 150 characters
// (the longest real key is 76). Keys that would shadow Object.prototype
// members are never used as lookup keys.
const KEY_RE = /^[A-Za-z0-9._:/@+*-]{1,150}$/;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const isKey = (k) => KEY_RE.test(k) && !k.includes('://') && !BAD_KEYS.has(k);
const PROVIDER_RE = /^[a-z0-9_-]{1,40}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,150}$/;
// Prototype-free lookup table, so data or input keys like "constructor" or
// "__proto__" never resolve to Object.prototype members.
const dict = (entries = []) => {
  const out = Object.create(null);
  for (const [k, v] of entries) if (!BAD_KEYS.has(k)) out[k] = v;
  return out;
};
const own = (obj, k) => (obj && Object.hasOwn(obj, k) ? obj[k] : undefined);

// The provider prefix to write in litellm_params.model. Several price-file
// provider values are sub-buckets of one route (vertex_ai-anthropic_models).
function routeOf(provider) {
  if (!provider) return null;
  if (provider.startsWith('vertex_ai')) return 'vertex_ai';
  if (provider === 'bedrock_converse') return 'bedrock';
  if (provider === 'fireworks_ai-embedding-models') return 'fireworks_ai';
  return provider;
}

// Provider display names, fixed by hand from provider_endpoints_support.json
// on 2026-11-12 (upstream display_name is free text and is never read). A
// provider missing here is shown by its slug.
const DISPLAY_NAMES = dict(Object.entries({
  a2a: 'A2A (Agent-to-Agent)', abliteration: 'Abliteration', agentcore: 'AgentCore', ai21: 'AI21',
  ai21_chat: 'AI21 Chat', aihubmix: 'AIHubMix', aiand: 'ai&', aiml: 'AI/ML API', amazon_nova: 'Amazon Nova', anthropic: 'Anthropic',
  anthropic_text: 'Anthropic Text', anyscale: 'Anyscale', apertis: 'Apertis', apiserpent: 'APISerpent',
  assemblyai: 'AssemblyAI', auto_router: 'Auto Router', aws_polly: 'AWS - Polly', azure: 'Azure',
  azure_ai: 'Azure AI', azure_text: 'Azure Text', baseten: 'Baseten', bedrock: 'AWS - Bedrock',
  bedrock_mantle: 'Bedrock Mantle', bespoke: 'Bespoke Nimble', bigmodel: 'BigModel (Zhipu AI)',
  bing_grounding: 'Bing Grounding', black_forest_labs: 'Black Forest Labs', brave: 'Brave Search', bytez: 'Bytez',
  cerebras: 'Cerebras', charity_engine: 'Charity Engine', chatgpt: 'ChatGPT Subscription', chutes: 'Chutes',
  clarifai: 'Clarifai', clf_ai_gateway: 'CLF AI Gateway', cloudflare: 'Cloudflare AI Workers', codestral: 'Codestral',
  cognition: 'Cognition', cohere: 'Cohere', cohere_chat: 'Cohere Chat', cometapi: 'CometAPI',
  compactifai: 'CompactifAI', coralbricks: 'CoralBricks', cortecs: 'Cortecs', crusoe: 'Crusoe', cursor: 'Cursor BYOK',
  custom: 'Custom', custom_openai: 'Custom OpenAI', darkbloom: 'Darkbloom', dashscope: 'Dashscope',
  databricks: 'Databricks', dataforseo: 'DataForSEO', datarobot: 'DataRobot', deepgram: 'Deepgram',
  deepinfra: 'DeepInfra', deepseek: 'Deepseek', docker_model_runner: 'Docker Model Runner', duckduckgo: 'DuckDuckGo',
  e2b: 'E2B', edenai: 'Eden AI', elevenlabs: 'ElevenLabs', empiriolabs: 'EmpirioLabs AI', empower: 'Empower',
  eu_jev: 'eu/jev', exa_ai: 'Exa AI', fal_ai: 'Fal AI', fastcrw: 'fastCRW', featherless_ai: 'Featherless AI',
  firecrawl: 'Firecrawl', fireworks_ai: 'Fireworks AI', friendliai: 'FriendliAI', galadriel: 'Galadriel',
  gdc: 'Google Distributed Cloud (GDC)', gemini: 'Google AI Studio - Gemini', gigachat: 'GigaChat',
  github: 'GitHub Models', github_copilot: 'GitHub Copilot', gmi: 'GMI Cloud', google_pse: 'Google PSE',
  gradient_ai: 'GradientAI', groq: 'Groq AI', helicone: 'Helicone', heroku: 'Heroku', hosted_vllm: 'Hosted VLLM',
  hostinger_router: 'Hostinger Router', huggingface: 'Huggingface', hyperbolic: 'Hyperbolic', inception: 'Inception',
  inferenceapis: 'Inference APIs', infinity: 'Infinity', jina_ai: 'Jina AI', kyma: 'Kyma API', lambda_ai: 'Lambda AI',
  langflow: 'LangFlow', langgraph: 'LangGraph', laya: 'Laya', lemonade: 'Lemonade', libertai: 'LibertAI',
  linkup: 'Linkup', litellm_proxy: 'LiteLLM Proxy', llamafile: 'Llamafile', llamagate: 'LlamaGate',
  lm_studio: 'LM Studio', manus: 'Manus', maritalk: 'Maritalk', meta: 'Meta Model API',
  meta_llama: 'Meta - Llama API', microsoft_365_copilot: 'Microsoft 365 Copilot', milvus: 'Milvus',
  minimax: 'Minimax', mistral: 'Mistral AI API', modelscope: 'ModelScope', mongodb: 'MongoDB Atlas',
  moonshot: 'Moonshot', morph: 'Morph', nace: 'Nace', nadir: 'Nadir', nanogpt: 'NanoGPT', nebius: 'Nebius AI Studio',
  neosantara: 'Neosantara', nimble: 'Nimble', nlp_cloud: 'NLP Cloud', novita: 'Novita AI', nscale: 'Nscale',
  nvidia_nim: 'Nvidia NIM', nvidia_riva: 'Nvidia Riva', oci: 'OCI', ollama: 'Ollama', ollama_chat: 'Ollama Chat',
  oobabooga: 'Oobabooga', openai: 'OpenAI', openai_like: 'OpenAI-like', opencode_go: 'OpenCode Go',
  openinfer: 'OpenInfer', openrouter: 'OpenRouter', opensandbox: 'OpenSandbox', opensearch: 'Amazon OpenSearch',
  ovhcloud: 'OVHCloud AI Endpoints', parallel_ai: 'Parallel AI', parasail: 'Parasail', perplexity: 'Perplexity AI',
  petals: 'Petals', pg_vector: 'PG Vector', pinstripes: 'Pinstripes', poe: 'Poe', predibase: 'Predibase',
  prism: 'Prism', publicai: 'PublicAI', pydantic_ai_agents: 'Pydantic AI Agents', qwen_ai_platform: 'Qianwen AI Platform', qwencloud: 'QwenCloud',
  ragflow: 'RAGFlow', recraft: 'Recraft', reducto: 'Reducto', refuseless: 'Refuseless', reka: 'Reka',
  replicate: 'Replicate', runwayml: 'RunwayML', s3_vectors: 'AWS S3 Vectors', sagemaker: 'AWS - Sagemaker',
  sagemaker_chat: 'Sagemaker Chat', sail: 'Sail', sambanova: 'Sambanova', sap: 'SAP Generative AI Hub',
  sarvam: 'Sarvam', scaledown: 'ScaleDown', scaleway: 'Scaleway', 'scx-ai': 'SCX.ai', searchapi: 'SearchAPI',
  searxng: 'SearXNG', serper: 'Serper', snowflake: 'Snowflake', soniox: 'Soniox', stability: 'Stability AI',
  strands_decider: 'Strands Decider', streamlake: 'StreamLake', synthetic: 'Synthetic', tavily: 'Tavily',
  tencent: 'Tencent TokenHub', tensormesh: 'Tensormesh', 'text-completion-codestral': 'Text Completion Codestral',
  'text-completion-openai': 'Text Completion OpenAI', tinyfish: 'TinyFish', together_ai: 'Together AI',
  topaz: 'Topaz', transcribe: 'Transcribe', triton: 'Triton', typesafe: 'TypeSafe', v0: 'V0', valkey: 'Valkey',
  venice: 'Venice.ai', vercel_ai_gateway: 'Vercel AI Gateway', vertex_ai: 'Google - Vertex AI', vllm: 'VLLM',
  volcengine: 'Volcengine', voyage: 'VoyageAI by MongoDB', wally: 'Wally', wandb: 'WandB Inference',
  watsonx: 'IBM - Watsonx.ai', watsonx_text: 'Watsonx Text', webiq: 'Microsoft Web IQ', xai: 'xAI',
  xiaomi_mimo: 'Xiaomi Mimo', xinference: 'Xinference', you_com: 'You.com', zai: 'Z.AI (Zhipu AI)',
  zerogpu: 'ZeroGPU',
}));
const DISPLAY_NAME_RE = /^[A-Za-z0-9 .()_\-/&+,]{1,40}$/;
const displayName = (slug) => own(DISPLAY_NAMES, slug) || null;
const DOCS_URL_RE = /^https:\/\/docs\.litellm\.ai\/[A-Za-z0-9_\-/#.]{0,200}$/;
// Price fields: anything with "cost", a "_per_" rate, or an uplift multiplier,
// with a finite, non-negative value. Field names are echoed back to agents, so
// each "_"-separated word must come from the vocabulary below (every word used
// by price fields as of 2026-11, plus a few obvious units) or be a number such
// as 272k, 1080p, 0.5K, 12hr. A new word in upstream data drops that field
// until it is added here.
const COST_KEY_RE = /^[A-Za-z0-9_.]{1,100}$/;
const COST_NAME_RE = /cost|_per_|multiplier/;
const COST_WORDS = new Set(
  (
    'above annotation audio balanced batches billable cache calls character characters citation code computer cost ' +
    'creation credit day dbu decisions endpoint eu explicit fedramp file flex gb google grounding hit hour image images ' +
    'input interpreter interval maps max message minute multiplier ocr output page pages per pixel priority processing ' +
    'query range read reasoning regional request results search second session store text token tokens ultrafast unit ' +
    'uplift us use vector video web tool storage standard hd low medium high'
  ).split(' '),
);
const COST_NUM_WORD_RE = /^(\d+(\.\d+)?[kKmMp]?|\d+hr|\d+s|\d+x\d+)$/;
const isCostName = (k) =>
  COST_KEY_RE.test(k) &&
  COST_NAME_RE.test(k) &&
  k.split('_').every((w) => COST_WORDS.has(w) || COST_NUM_WORD_RE.test(w));
const LIMIT_KEYS = new Set(
  'max_input_tokens max_output_tokens max_tokens output_vector_size prompt_cache_min_tokens rpm tpm'.split(' '),
);
// Every supports_* flag in the price file on 2026-11-12. Flag names are echoed
// to agents, so a flag outside this list is dropped until it is added here.
const SUPPORTS_FLAGS = new Set(
  (
    'adaptive_thinking anthropic_compaction anthropic_thinking_payload assistant_prefill audio_input audio_output ' +
    'bedrock_converse_tool_result_images bedrock_native_structured_output bedrock_native_structured_output_by_default ' +
    'bedrock_runtime_chat_completions_inline_reasoning bedrock_runtime_chat_completions_response_format ' +
    'bedrock_runtime_chat_completions_tools_with_reasoning box_questions computer_use continuation ' +
    'embedding_image_input fast_mode forced_tool_use function_calling image_input image_size legacy_thinking ' +
    'low_reasoning_effort max_reasoning_effort mid_conversation_system minimal_reasoning_effort multimodal ' +
    'native_streaming native_structured_output none_reasoning_effort nova_canvas_image_edit output_config ' +
    'parallel_function_calling parallel_tool_use_config pdf_input prompt_cache_breakpoint prompt_caching reasoning ' +
    'regex_lookaround response_schema sampling_params speed system_messages thinking_cache_preservation tool_choice ' +
    'tool_search url_context video_input vision web_search xhigh_reasoning_effort'
  ).split(' '),
);

// Every mode in the price file as of 2026-11. A mode outside this set is
// dropped rather than echoed, so a typo or injected text never reaches output.
const MODES = (
  'chat completion responses embedding image_generation image_edit video_generation ' +
  'audio_transcription audio_speech realtime rerank moderation ocr search vector_store guardrail ' +
  'evaluation extraction decisions'
).split(' ');
const MODE_SET = new Set(MODES);

// Endpoint keys used in provider_endpoints_support.json as of 2026-11.
const ENDPOINT_KEYS = (
  'chat_completions responses messages text_completion embeddings image_generations image_edits ' +
  'image_variations audio_transcriptions audio_speech realtime video_generations rerank ocr search ' +
  'moderations batches files fine_tuning assistants interactions generateContent count_tokens ' +
  'bedrock_invoke bedrock_converse systemone a2a skills sandbox container container_files compact ' +
  'vector_stores_create vector_stores_search vector_store_files rag_ingest rag_query'
).split(' ');
const ENDPOINT_SET = new Set(ENDPOINT_KEYS);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// tiered_pricing is kept only when every tier is fully numeric: a [from, to]
// range (token range, or result-count range for search) plus cost fields.
// One malformed tier drops the whole list, since a partial table would misprice.
function normalizeTiers(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0 || tiers.length > 20) return undefined;
  const out = [];
  for (const tier of tiers) {
    if (!isObj(tier)) return undefined;
    const t = {costs: {}};
    for (const [k, v] of Object.entries(tier)) {
      if (k === 'range' || k === 'max_results_range') {
        if (!Array.isArray(v) || v.length !== 2 || !v.every(isNum)) return undefined;
        t.range = [v[0], v[1]];
        t.unit = k === 'range' ? 'tokens' : 'results';
      } else if (isCostName(k) && isNum(v)) {
        t.costs[k] = v;
      } else {
        return undefined;
      }
    }
    if (!t.range || Object.keys(t.costs).length === 0) return undefined;
    out.push(t);
  }
  return out;
}

function normalizeModel(raw, allKeys) {
  const m = {costs: {}, limits: {}, supports: {}};
  if (typeof raw.mode === 'string' && MODE_SET.has(raw.mode)) m.mode = raw.mode;
  if (typeof raw.deprecation_date === 'string' && DATE_RE.test(raw.deprecation_date)) m.deprecation_date = raw.deprecation_date;
  // These two point at other entries; keep them only when they name a real key.
  for (const ref of ['alias_of', 'successor_model']) {
    if (typeof raw[ref] === 'string' && allKeys.has(raw[ref])) m[ref] = raw[ref];
  }
  for (const [k, v] of Object.entries(raw)) {
    if (LIMIT_KEYS.has(k)) {
      if (isNum(v)) m.limits[k] = v;
    } else if (k.startsWith('supports_')) {
      if (typeof v === 'boolean' && SUPPORTS_FLAGS.has(k.slice(9))) m.supports[k.slice(9)] = v;
    } else if (k === 'search_context_cost_per_query' && isObj(v)) {
      // {search_context_size_low, _medium, _high} -> flat cost fields.
      for (const size of ['low', 'medium', 'high']) {
        const c = own(v, `search_context_size_${size}`);
        if (isNum(c)) m.costs[`search_context_cost_per_query_${size}`] = c;
      }
    } else if (k === 'tiered_pricing') {
      const tiers = normalizeTiers(v);
      if (tiers) m.tiered_pricing = tiers;
    } else if (isCostName(k) && isNum(v)) {
      m.costs[k] = v;
    }
  }
  return m;
}

// A litellm_provider value is shown only when provider_endpoints_support.json
// lists it (or its route), when 3 or more models use it, or when it is already
// the first segment of the model key. A one-off value cannot carry text.
function providerFilter(prices, keys, listed) {
  const counts = new Map();
  for (const k of keys) {
    const p = prices[k].litellm_provider;
    if (typeof p === 'string' && PROVIDER_RE.test(p)) counts.set(p, (counts.get(p) || 0) + 1);
  }
  return (key, p) =>
    counts.has(p) && (listed.has(p) || listed.has(routeOf(p)) || counts.get(p) >= 3 || key.startsWith(`${p}/`));
}

// Normalize the two raw files (plus the optional slug map and commit sha)
// into the shape every tool reads. Pure; runs once per refresh.
function normalize({prices, endpoints, slugs, sha, fetchedAt}) {
  if (!isObj(prices)) throw new Error('model price file is not a JSON object');
  const rawProviders = isObj(endpoints) && isObj(endpoints.providers) ? endpoints.providers : {};
  const providers = dict();
  for (const [slug, p] of Object.entries(rawProviders)) {
    if (!PROVIDER_RE.test(slug) || BAD_KEYS.has(slug) || !isObj(p)) continue;
    const out = {endpoints: {}};
    if (typeof p.url === 'string' && DOCS_URL_RE.test(p.url)) out.url = p.url;
    if (isObj(p.endpoints)) {
      for (const [ek, ev] of Object.entries(p.endpoints)) if (ENDPOINT_SET.has(ek) && typeof ev === 'boolean') out.endpoints[ek] = ev;
    }
    providers[slug] = out;
  }
  const keys = Object.keys(prices).filter((k) => k !== 'sample_spec' && isKey(k) && isObj(prices[k]));
  const allKeys = new Set(keys);
  const showProvider = providerFilter(prices, keys, new Set(Object.keys(providers)));
  const models = dict();
  for (const key of keys) {
    const m = normalizeModel(prices[key], allKeys);
    if (showProvider(key, prices[key].litellm_provider)) m.provider = prices[key].litellm_provider;
    const slug = isObj(slugs) ? own(slugs, key) : undefined;
    if (typeof slug === 'string' && SLUG_RE.test(slug)) m.page_slug = slug;
    models[key] = m;
  }
  return {
    version: VERSION,
    sha: typeof sha === 'string' && SHA_RE.test(sha) ? sha : null,
    fetchedAt: fetchedAt || new Date().toISOString(),
    models,
    providers,
  };
}

// Fetch a URL as JSON with a timeout and a hard size cap. The body is read
// as a stream so an oversized response is cut off rather than buffered.
async function fetchJson(fetchImpl, url, {maxBytes = MAX_BYTES, timeoutMs = TIMEOUT_MS, headers} = {}) {
  const res = await fetchImpl(url, {signal: AbortSignal.timeout(timeoutMs), headers});
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  const declared = Number(res.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`${url} is larger than ${maxBytes} bytes`);
  let text;
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`${url} is larger than ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
    text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
  } else {
    text = await res.text();
    if (Buffer.byteLength(text) > maxBytes) throw new Error(`${url} is larger than ${maxBytes} bytes`);
  }
  return JSON.parse(text);
}

// Fetch everything and normalize (build time only). The price and endpoint
// files are required; the commit sha and the models.litellm.ai slug map are
// optional extras.
async function fetchLive({fetch: fetchImpl = globalThis.fetch, now = Date.now, token = process.env.GITHUB_TOKEN} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const optional = (p) => p.catch(() => null);
  const github = (url) => optional(fetchJson(fetchImpl, url, {
    maxBytes: 256 * 1024,
    headers: {accept: 'application/vnd.github+json', 'user-agent': 'litellm-docs-mcp', ...(token ? {authorization: `Bearer ${token}`} : {})},
  }));
  const shaOf = (body) => {
    const sha = Array.isArray(body) ? body[0]?.sha : body?.sha;
    return typeof sha === 'string' && SHA_RE.test(sha) ? sha : null;
  };
  const [head, pricesCommits] = await Promise.all([github(HEAD_URL), github(COMMITS_URL)]);
  const headSha = shaOf(head);
  const [prices, endpoints, slugs] = await Promise.all([
    fetchJson(fetchImpl, atCommit(PRICES_URL, headSha)),
    fetchJson(fetchImpl, atCommit(ENDPOINTS_URL, headSha), {maxBytes: MAX_SIDE_BYTES}),
    optional(fetchJson(fetchImpl, SLUGS_URL, {maxBytes: MAX_SIDE_BYTES})),
  ]);
  return normalize({prices, endpoints, slugs, sha: shaOf(pricesCommits), fetchedAt: new Date(now()).toISOString()});
}

const defaultSnapshotPath = () => path.join(process.cwd(), 'build/mcp-models.json');

async function readSnapshot(snapshotPath = defaultSnapshotPath()) {
  const data = JSON.parse(await fs.promises.readFile(snapshotPath, 'utf8'));
  if (!isObj(data) || data.version !== VERSION || !isObj(data.models) || !isObj(data.providers)) {
    throw new Error(`${snapshotPath} is not a version ${VERSION} model snapshot`);
  }
  return {...data, models: dict(Object.entries(data.models)), providers: dict(Object.entries(data.providers))};
}

// The snapshot is read once per process. A failed read is not cached, so the
// next call tries again.
let loading = null;

/**
 * Normalized model data from the build snapshot: {version, sha, fetchedAt,
 * models: {[key]: {provider, mode, costs, limits, supports, ...}}, providers}.
 * snapshotPath exists for tests.
 */
function getData({snapshotPath} = {}) {
  if (!loading) {
    // The caller logs the error; its message can name server paths, so it
    // never reaches a tool response.
    loading = readSnapshot(snapshotPath).catch((err) => {
      loading = null;
      throw new Error(`LiteLLM model data is unavailable: ${err.message}`);
    });
  }
  return loading;
}

function resetCache() {
  loading = null;
}

module.exports = {
  getData,
  resetCache,
  normalize,
  routeOf,
  displayName,
  own,
  DISPLAY_NAMES,
  DISPLAY_NAME_RE,
  SUPPORTS_FLAGS,
  isCostName,
  fetchLive,
  fetchJson,
  readSnapshot,
  MODES,
  ENDPOINT_KEYS,
  PRICES_URL,
  ENDPOINTS_URL,
  COMMITS_URL,
  HEAD_URL,
  SLUGS_URL,
  MAX_BYTES,
};
