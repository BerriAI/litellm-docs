// Model data tools for the docs MCP server: look up one model, filter the
// catalog, and describe a provider. All data comes from models-data.js,
// which normalizes LiteLLM's model price file and provider endpoint file.
// Only normalized fields (numbers, booleans, allowlisted strings) are rendered.

const dataSource = require('./models-data');
const {routeOf, displayName, own} = dataSource;

const MODEL_RE = '^[A-Za-z0-9._:/@+*-]+$';
const PROVIDER_PATTERN = '^[A-Za-z0-9_-]+$';
const READ_ONLY = {readOnlyHint: true, idempotentHint: true, openWorldHint: false};
const DOCS = 'https://docs.litellm.ai/docs';
const UNAVAILABLE = 'Model data is temporarily unavailable. Try again shortly, or see https://models.litellm.ai.';

// supports_* flags offered as find_litellm_models filters: every generally
// useful flag in the price file as of 2026-11 (vendor-internal flags such as
// bedrock_* are left out). get_litellm_model lists every allowlisted flag.
const SUPPORTS = (
  'vision function_calling parallel_function_calling tool_choice response_schema native_structured_output ' +
  'reasoning adaptive_thinking none_reasoning_effort minimal_reasoning_effort max_reasoning_effort ' +
  'xhigh_reasoning_effort prompt_caching pdf_input audio_input audio_output video_input embedding_image_input ' +
  'system_messages assistant_prefill computer_use web_search url_context tool_search'
).split(' ');

const SORTS = ['name', 'input_cost', 'output_cost', 'context'];

// Fields shown in the main price table, in this order, when present.
const MAIN_COSTS = (
  'input_cost_per_token output_cost_per_token cache_read_input_token_cost cache_creation_input_token_cost ' +
  'output_cost_per_reasoning_token input_cost_per_audio_token output_cost_per_audio_token input_cost_per_image ' +
  'output_cost_per_image input_cost_per_pixel output_cost_per_pixel input_cost_per_second output_cost_per_second ' +
  'output_cost_per_video_per_second input_cost_per_character output_cost_per_character input_cost_per_query ' +
  'input_cost_per_request ocr_cost_per_page'
).split(' ');

const ENDPOINT_LABELS = new Map(Object.entries({
  chat_completions: '/chat/completions', responses: '/responses', messages: '/v1/messages',
  text_completion: '/completions', embeddings: '/embeddings', image_generations: '/images/generations',
  image_edits: '/images/edits', image_variations: '/images/variations', audio_transcriptions: '/audio/transcriptions',
  audio_speech: '/audio/speech', realtime: '/realtime', video_generations: '/videos', rerank: '/rerank', ocr: '/ocr',
  search: '/search', moderations: '/moderations', batches: '/batches', files: '/files', fine_tuning: '/fine_tuning',
  assistants: '/assistants', interactions: '/interactions', generateContent: 'Google generateContent',
  count_tokens: 'count_tokens', bedrock_invoke: 'Bedrock invoke', bedrock_converse: 'Bedrock converse',
  systemone: 'System One decisions', a2a: '/a2a (Agent Gateway)', skills: '/skills', sandbox: 'sandbox',
  container: '/containers', container_files: '/containers/{id}/files', compact: '/responses/compact',
  vector_stores_create: '/vector_stores', vector_stores_search: '/vector_stores/{id}/search',
  vector_store_files: '/vector_stores/{id}/files', rag_ingest: '/rag/ingest', rag_query: '/rag/query',
}));

const DATA_NOTE =
  "Data comes from LiteLLM's model price file (model_prices_and_context_window.json in BerriAI/litellm), " +
  'the same data LiteLLM uses for cost tracking.';

// ---------------------------------------------------------------------------
// Helpers

// Image price entries such as "high/1024-x-1536/gpt-image-1.5" or
// "azure/standard/1024-x-1024/dall-e-3" price one quality and size of a model;
// LiteLLM picks them from the request. A run of quality/size segments is a
// variant only when it holds a size, so "kling-video/o1/standard/..." stays.
const QUALITY_RE = /^(low|medium|high|xhigh|max|standard|hd|auto|\d+-steps|max-steps)$/;
const SIZE_RE = /^(\d+-x-\d+|max-x-max)$/;

function stripVariant(key) {
  const parts = key.split('/');
  const base = [];
  const variant = [];
  for (let i = 0; i < parts.length; ) {
    let j = i;
    while (j < parts.length - 1 && (QUALITY_RE.test(parts[j]) || SIZE_RE.test(parts[j]))) j++;
    const run = parts.slice(i, j);
    if (run.some((s) => SIZE_RE.test(s))) variant.push(...run);
    else base.push(...run);
    if (j === i) base.push(parts[j++]);
    i = j;
  }
  return {base: base.join('/'), variant: variant.length ? variant.join('/') : null};
}

const indexes = new WeakMap();

// Lookup tables, built once per data refresh.
function indexFor(data) {
  let idx = indexes.get(data);
  if (idx) return idx;
  const keys = Object.keys(data.models);
  const lower = new Map();
  const routes = new Map(); // route -> keys
  const prefixes = new Set(Object.keys(data.providers));
  for (const key of keys) {
    const lk = key.toLowerCase();
    if (!lower.has(lk)) lower.set(lk, key);
    const p = data.models[key].provider;
    if (!p) continue;
    const r = routeOf(p);
    prefixes.add(p).add(r);
    if (!routes.has(r)) routes.set(r, []);
    routes.get(r).push(key);
  }
  idx = {keys, lower, routes, prefixes};
  indexes.set(data, idx);
  return idx;
}

function configModel(data, key) {
  const m = data.models[key];
  const {base, variant} = stripVariant(key);
  const first = base.includes('/') ? base.slice(0, base.indexOf('/')) : null;
  const model = !(first && indexFor(data).prefixes.has(first)) && m.provider ? `${routeOf(m.provider)}/${base}` : base;
  return {model, variant};
}

function resolveModel(data, input) {
  const {keys, lower, prefixes} = indexFor(data);
  if (own(data.models, input)) return {key: input, alternatives: []};
  const li = input.toLowerCase();
  if (lower.has(li)) return {key: lower.get(li), alternatives: []};
  // "<provider>/<key>": the provider prefix is part of the config string but
  // not of the price-file key (openai/gpt-4o -> gpt-4o).
  const slash = li.indexOf('/');
  if (slash > 0 && prefixes.has(li.slice(0, slash))) {
    const first = li.slice(0, slash);
    const rest = li.slice(slash + 1);
    const hits = keys.filter((k) => {
      const p = data.models[k].provider;
      return k.toLowerCase() === rest && (p === first || routeOf(p) === first);
    });
    if (hits.length) return {key: hits[0], alternatives: hits.slice(1)};
  }
  // A bare name only stored with a provider prefix (mistral-large-latest ->
  // mistral/mistral-large-latest), preferring the provider named in the model.
  const ownRank = (k) => (li.includes(k.slice(0, k.indexOf('/')).toLowerCase()) ? 0 : 1);
  const hits = keys
    .filter((k) => {
      const lk = k.toLowerCase();
      return lk.endsWith(`/${li}`) && prefixes.has(lk.slice(0, lk.length - li.length - 1));
    })
    .sort((a, b) => ownRank(a) - ownRank(b) || (a < b ? -1 : a > b ? 1 : 0));
  return hits.length ? {key: hits[0], alternatives: hits.slice(1)} : null;
}

// Case-insensitive prefix matches, then substring matches, shortest first.
function suggest(candidates, input, max = 5) {
  const li = input.toLowerCase();
  const rank = (c) => (c.toLowerCase().startsWith(li) ? 0 : c.toLowerCase().includes(li) ? 1 : 2);
  return candidates
    .map((c) => [rank(c), c])
    .filter(([r]) => r < 2)
    .sort((a, b) => a[0] - b[0] || a[1].length - b[1].length || (a[1] < b[1] ? -1 : 1))
    .slice(0, max)
    .map(([, c]) => c);
}

// Multiplier to turn a per-unit price into a per-1M-token price, or null when
// the field is not priced per token (per image, per second, per page...).
function perMillionFactor(name) {
  if (/per_1k_tokens/.test(name)) return 1000;
  const base = name.replace(/_above_[0-9a-z]+_tokens/g, '');
  if (!/token/.test(base)) return null;
  if (/per_(second|image|pixel|character|page|query|request|session|unit|credit|call|message)/.test(base)) return null;
  return 1e6;
}

function usd(v) {
  if (v === 0) return '$0';
  // At least cents; up to four decimals; three significant digits below a cent.
  const decimals = Math.abs(v) >= 0.01 ? 4 : Math.min(12, 2 - Math.floor(Math.log10(Math.abs(v))));
  let s = v.toFixed(decimals).replace(/0+$/, '');
  if ((s.split('.')[1] || '').length < 2) s = v.toFixed(2);
  return `$${s}`;
}

function priceText(name, value) {
  if (/multiplier/.test(name)) return `x${Number(value.toFixed(4))}`;
  const f = perMillionFactor(name);
  return f ? `${usd(value * f)} / 1M tokens` : usd(value);
}

const int = (n) => Math.round(n).toLocaleString('en-US');
const yamlScalar = (s) => (/^[A-Za-z0-9_.]/.test(s) ? s : JSON.stringify(s));
const text = (value) => ({content: [{type: 'text', text: value}]});
const failure = (value) => ({content: [{type: 'text', text: value}], isError: true});

function dataFooter(data) {
  const parts = [];
  if (data.sha) parts.push(`commit ${data.sha.slice(0, 12)}`);
  parts.push(`as of ${data.fetchedAt}`);
  return `Data: LiteLLM model_prices_and_context_window.json (${parts.join(', ')}).`;
}

// Error text can quote upstream files or name server paths, so it is only logged.
async function loadData(getData) {
  try {
    return {data: await getData()};
  } catch (err) {
    console.warn(`[mcp-models] model data unavailable: ${err?.message}`);
    return {error: failure(UNAVAILABLE)};
  }
}

// ---------------------------------------------------------------------------
// get_litellm_model

// The proxy config for one entry. Search, vector store and guardrail entries
// are configured outside model_list; Azure routes by deployment name.
function configLines(data, key, m) {
  const {model, variant} = configModel(data, key);
  const route = routeOf(m.provider);
  const out = ['## Config', ''];
  if (m.mode === 'search') {
    if (route) {
      out.push(
        'Search providers are set up under `search_tools`, not `model_list`, and called through /search:', '',
        '```yaml', 'search_tools:', `  - search_tool_name: ${route}-search`, '    litellm_params:',
        `      search_provider: ${route}`, '```', '',
      );
    }
    return [...out, `See ${DOCS}/search/ for credentials and parameters.`, ''];
  }
  if (m.mode === 'vector_store') {
    return [...out, `Vector stores are set up outside \`model_list\`; this entry only prices them. See ${DOCS}/vector_stores/.`, ''];
  }
  if (m.mode === 'guardrail') {
    return [...out, `Guardrails are set up under \`guardrails\`, not \`model_list\`; this entry only prices them. See ${DOCS}/proxy/guardrails/quick_start.`, ''];
  }
  const name = yamlScalar(model.slice(model.lastIndexOf('/') + 1) || model);
  out.push('```yaml', 'model_list:', `  - model_name: ${name}`, '    litellm_params:');
  if (route === 'azure') {
    out.push(
      '      model: azure/<your-deployment-name>  # Azure routes by deployment name',
      '      api_base: os.environ/AZURE_API_BASE', '      api_key: os.environ/AZURE_API_KEY',
      '    model_info:', `      base_model: ${yamlScalar(model)}  # price-file key, for cost tracking`, '```', '',
      'Replace `<your-deployment-name>` with your Azure deployment name. `base_model` tells LiteLLM which price entry to use for cost tracking.',
      '',
    );
  } else {
    out.push(`      model: ${yamlScalar(model)}`, '```', '');
  }
  if (variant) {
    out.push(`This entry prices the \`${variant}\` variant. Configure the base model as above; LiteLLM applies this price when a request uses that quality and size.`, '');
  }
  if (!m.provider) out.push('This entry has no provider in the price file, so the config model may need a provider prefix.', '');
  return out;
}

function renderModel(data, key, input, alternatives) {
  let m = data.models[key];
  const lines = [];
  let aliasNote = null;
  if (m.alias_of && !m.provider) {
    aliasNote = `\`${key}\` is an alias of \`${m.alias_of}\`; details below are for \`${m.alias_of}\`.`;
    key = m.alias_of;
    m = data.models[key];
  }
  const route = routeOf(m.provider);
  const provider = route ? own(data.providers, route) || own(data.providers, m.provider) : null;

  lines.push(`# ${key}`, '');
  if (input !== key && !aliasNote) lines.push(`Resolved \`${input}\` to the price-file key \`${key}\`.`, '');
  if (aliasNote) lines.push(aliasNote, '');
  if (alternatives.length) lines.push(`Also listed as: ${alternatives.slice(0, 5).map((a) => `\`${a}\``).join(', ')}.`, '');
  const facts = [];
  if (m.provider) {
    const dn = displayName(route) || displayName(m.provider);
    facts.push(`Provider: \`${m.provider}\`${dn ? ` (${dn})` : ''}`);
  }
  if (m.mode) facts.push(`Mode: ${m.mode}`);
  const L = m.limits;
  if (L.max_input_tokens != null) facts.push(`Max input tokens: ${int(L.max_input_tokens)}`);
  if (L.max_output_tokens != null) facts.push(`Max output tokens: ${int(L.max_output_tokens)}`);
  if (L.max_tokens != null && L.max_input_tokens == null) facts.push(`Max tokens: ${int(L.max_tokens)}`);
  if (L.output_vector_size != null) facts.push(`Embedding size: ${int(L.output_vector_size)}`);
  if (L.prompt_cache_min_tokens != null) facts.push(`Minimum tokens to cache a prompt: ${int(L.prompt_cache_min_tokens)}`);
  if (L.rpm != null) facts.push(`Default RPM: ${int(L.rpm)}`);
  if (L.tpm != null) facts.push(`Default TPM: ${int(L.tpm)}`);
  if (m.deprecation_date) {
    facts.push(`Deprecation date: ${m.deprecation_date}${m.successor_model ? ` (successor: \`${m.successor_model}\`)` : ''}`);
  }
  lines.push(...facts.map((f) => `${f}.`), '');

  const costNames = Object.keys(m.costs);
  if (costNames.length) {
    lines.push('## Pricing (USD)', '', '| Field | Price |', '| --- | --- |');
    const main = MAIN_COSTS.filter((n) => Object.hasOwn(m.costs, n));
    for (const n of main) lines.push(`| ${n} | ${priceText(n, m.costs[n])} |`);
    const other = costNames.filter((n) => !main.includes(n)).sort();
    if (other.length) lines.push('', `Other cost fields: ${other.map((n) => `${n} ${priceText(n, m.costs[n])}`).join('; ')}.`);
    lines.push('');
  } else if (!m.tiered_pricing) {
    lines.push('No price fields are listed for this entry.', '');
  }

  if (m.tiered_pricing) {
    const fields = [...new Set(m.tiered_pricing.flatMap((t) => Object.keys(t.costs)))];
    lines.push('## Tiered pricing', '', `| Range (${m.tiered_pricing[0].unit}) | ${fields.join(' | ')} |`, `| --- | ${fields.map(() => '---').join(' | ')} |`);
    for (const t of m.tiered_pricing) {
      const cells = fields.map((f) => (Object.hasOwn(t.costs, f) ? priceText(f, t.costs[f]) : '-'));
      lines.push(`| ${int(t.range[0])} to ${int(t.range[1])} | ${cells.join(' | ')} |`);
    }
    lines.push('');
  }

  const flags = Object.keys(m.supports).sort();
  const no = flags.filter((s) => !m.supports[s]);
  if (flags.length) {
    lines.push('## Supports', '', ...flags.filter((s) => m.supports[s]).map((s) => `- ${s}`));
    if (no.length) lines.push('', `Listed as not supported: ${no.join(', ')}.`);
    lines.push('');
  }

  lines.push(...configLines(data, key, m));
  if (provider?.url) lines.push(`Provider docs, including credentials: ${provider.url}`);
  if (m.page_slug) lines.push(`Model page: https://models.litellm.ai/models/${m.page_slug}`);
  if (provider?.url || m.page_slug) lines.push('');
  lines.push('---', dataFooter(data));
  return text(lines.join('\n'));
}

function getModelTool(getData) {
  return {
    name: 'get_litellm_model',
    title: 'Get a LiteLLM model',
    description:
      'Look up one model in LiteLLM by name and return its provider, mode, context and output token limits, ' +
      'prices per 1M tokens (plus image, audio, video and other cost fields), supported features, deprecation date, ' +
      'and the exact config snippet for the LiteLLM proxy. Accepts the price-file key (gpt-4o) or the ' +
      'provider-prefixed form (openai/gpt-4o, vertex_ai/gemini-2.5-flash). ' + DATA_NOTE +
      ' Use get_litellm_model before writing a LiteLLM config or quoting a price, limit or capability; unknown names return ' +
      'close matches.',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string', minLength: 1, maxLength: 200, pattern: MODEL_RE,
          description: 'Model name, e.g. gpt-4o, anthropic/claude-sonnet-4-5, bedrock/anthropic.claude-3-haiku-20240307-v1:0',
        },
      },
      required: ['model'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async handler({model}) {
      const {data, error} = await loadData(getData);
      if (error) return error;
      const hit = resolveModel(data, model);
      if (hit) return renderModel(data, hit.key, model, hit.alternatives);
      const sug = suggest(indexFor(data).keys, model);
      return failure(
        `No model named \`${model}\` in LiteLLM's model price file.` +
          (sug.length
            ? ` Did you mean: ${sug.map((s) => `\`${s}\``).join(', ')}?`
            : ' Use find_litellm_models with a provider or query to browse the catalog.'),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// find_litellm_models

function findModels(data, args, today) {
  const {provider, mode, supports = [], max_input_cost_per_1m, min_context, query, include_deprecated = false} = args;
  const p = provider?.toLowerCase();
  const q = query?.toLowerCase();
  const rows = [];
  for (const [key, m] of Object.entries(data.models)) {
    if (!m.provider) continue; // alias-only rows duplicate their target
    if (p && m.provider !== p && routeOf(m.provider) !== p) continue;
    if (mode && m.mode !== mode) continue;
    if (q && !key.toLowerCase().includes(q)) continue;
    if (supports.some((s) => m.supports[s] !== true)) continue;
    const input = m.costs.input_cost_per_token;
    if (max_input_cost_per_1m != null && !(input != null && input * 1e6 <= max_input_cost_per_1m + 1e-9)) continue;
    if (min_context != null && !((m.limits.max_input_tokens ?? 0) >= min_context)) continue;
    if (!include_deprecated && m.deprecation_date && m.deprecation_date < today) continue;
    rows.push({key, m});
  }
  return rows;
}

function sortRows(rows, sort) {
  const cmpName = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const byNum = (get, dir) => (a, b) => {
    const x = get(a.m);
    const y = get(b.m);
    if (x == null || y == null) return x == null && y == null ? cmpName(a, b) : x == null ? 1 : -1;
    return (x - y) * dir || cmpName(a, b);
  };
  const fns = {
    name: cmpName,
    input_cost: byNum((m) => m.costs.input_cost_per_token, 1),
    output_cost: byNum((m) => m.costs.output_cost_per_token, 1),
    context: byNum((m) => m.limits.max_input_tokens, -1),
  };
  return rows.sort(fns[sort] || cmpName);
}

function findTool(getData, now) {
  return {
    name: 'find_litellm_models',
    title: 'Find LiteLLM models',
    description:
      'Filter the models LiteLLM knows about by provider, mode, supported features, maximum input price per 1M ' +
      'tokens, minimum context window, or a substring of the name, and return a compact table with input and ' +
      'output price per 1M tokens and context size, plus the total match count. Deprecated models are hidden ' +
      'unless include_deprecated is true. ' + DATA_NOTE +
      ' Use get_litellm_model before writing a config for any result.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string', minLength: 1, maxLength: 40, pattern: PROVIDER_PATTERN,
          description: 'LiteLLM provider, e.g. openai, anthropic, bedrock, vertex_ai, azure',
        },
        mode: {type: 'string', enum: dataSource.MODES, description: 'Model mode'},
        supports: {
          type: 'array', items: {type: 'string', enum: SUPPORTS}, maxItems: 10,
          description: 'Required capabilities (all must hold)',
        },
        max_input_cost_per_1m: {
          type: 'number', minimum: 0,
          description: 'Maximum input price in USD per 1M tokens; excludes models without a per-token input price',
        },
        min_context: {type: 'integer', minimum: 0, description: 'Minimum max_input_tokens'},
        query: {
          type: 'string', minLength: 1, maxLength: 100, pattern: MODEL_RE,
          description: 'Case-insensitive substring of the model name',
        },
        include_deprecated: {type: 'boolean', default: false, description: 'Include models past their deprecation date'},
        sort: {
          type: 'string', enum: SORTS, default: 'name',
          description: 'name, input_cost (cheapest first), output_cost (cheapest first), or context (largest first)',
        },
        limit: {type: 'integer', minimum: 1, maximum: 50, default: 20, description: 'Rows to return'},
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async handler(args = {}) {
      const {data, error} = await loadData(getData);
      if (error) return error;
      const today = new Date(now()).toISOString().slice(0, 10);
      const sort = args.sort || 'name';
      const rows = sortRows(findModels(data, args, today), sort);
      const shown = rows.slice(0, args.limit || 20);
      const lines = [];
      if (!rows.length) {
        lines.push('No models match these filters.');
        const {routes} = indexFor(data);
        if (args.provider && !routes.has(args.provider.toLowerCase())) {
          const sug = suggest([...routes.keys()], args.provider);
          if (sug.length) lines.push(`Known providers like that: ${sug.join(', ')}.`);
        }
      } else {
        lines.push(
          `${rows.length} model${rows.length === 1 ? '' : 's'} match; showing ${shown.length}, sorted by ${sort}.`, '',
          '| Model | Provider | Mode | Input $/1M | Output $/1M | Context |', '| --- | --- | --- | --- | --- | --- |',
        );
        const per1m = (v) => (v != null ? usd(v * 1e6) : '-');
        for (const {key, m} of shown) {
          const ctx = m.limits.max_input_tokens != null ? int(m.limits.max_input_tokens) : '-';
          lines.push(`| ${key} | ${m.provider} | ${m.mode || '-'} | ${per1m(m.costs.input_cost_per_token)} | ${per1m(m.costs.output_cost_per_token)} | ${ctx} |`);
        }
        if (shown.some(({m}) => m.costs.input_cost_per_token == null || m.costs.output_cost_per_token == null)) {
          lines.push('', 'A "-" price means the model is not priced per token; get_litellm_model shows its other cost fields.');
        }
      }
      lines.push('', '---', dataFooter(data));
      return text(lines.join('\n'));
    },
  };
}

// ---------------------------------------------------------------------------
// get_litellm_provider

function providerTool(getData, now) {
  return {
    name: 'get_litellm_provider',
    title: 'Get a LiteLLM provider',
    description:
      'Describe one LiteLLM provider: which endpoints (/chat/completions, /embeddings, /images/generations, ' +
      '/audio/transcriptions, /rerank, /batches and more) LiteLLM supports for it, how many models it has by mode, ' +
      'example model names, and its docs page. ' + DATA_NOTE +
      ' Endpoint support comes from provider_endpoints_support.json in the same repo. Use get_litellm_model before ' +
      'writing a config for a specific model.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string', minLength: 1, maxLength: 40, pattern: PROVIDER_PATTERN,
          description: 'LiteLLM provider slug, e.g. openai, anthropic, bedrock, vertex_ai, gemini, azure',
        },
      },
      required: ['provider'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async handler({provider}) {
      const {data, error} = await loadData(getData);
      if (error) return error;
      const {routes} = indexFor(data);
      const p = provider.toLowerCase();
      // Accept a price-file provider value (vertex_ai-anthropic_models) too.
      const slug = own(data.providers, p) || routes.has(p) ? p : routes.has(routeOf(p)) ? routeOf(p) : null;
      if (!slug) {
        const sug = suggest([...new Set([...Object.keys(data.providers), ...routes.keys()])], p);
        return failure(
          `No provider named \`${provider}\` in LiteLLM's provider data.` +
            (sug.length ? ` Did you mean: ${sug.map((s) => `\`${s}\``).join(', ')}?` : ''),
        );
      }
      const info = own(data.providers, slug) || {endpoints: {}};
      const keys = routes.get(slug) || [];
      const byMode = new Map();
      for (const k of keys) {
        const mode = data.models[k].mode || 'unspecified';
        byMode.set(mode, (byMode.get(mode) || 0) + 1);
      }
      const lines = [`# ${displayName(slug) || slug} (\`${slug}\`)`, ''];
      if (info.url) lines.push(`Docs: ${info.url}`, '');
      const eps = Object.entries(info.endpoints);
      const label = (k) => ENDPOINT_LABELS.get(k) || k;
      const yes = eps.filter(([, v]) => v).map(([k]) => label(k));
      const no = eps.filter(([, v]) => !v).map(([k]) => label(k));
      lines.push('## Endpoints through LiteLLM', '');
      if (eps.length) {
        lines.push(`Supported: ${yes.length ? yes.join(', ') : 'none listed'}.`);
        if (no.length) lines.push(`Not supported: ${no.join(', ')}.`);
      } else {
        lines.push('This provider is not listed in provider_endpoints_support.json.');
      }
      lines.push('', `## Models in the price file: ${keys.length}`, '');
      const modes = [...byMode].sort((a, b) => b[1] - a[1]);
      if (modes.length) lines.push('| Mode | Models |', '| --- | --- |', ...modes.map(([mo, n]) => `| ${mo} | ${n} |`), '');
      const today = new Date(now()).toISOString().slice(0, 10);
      const examples = keys
        .filter((k) => {
          const m = data.models[k];
          return (m.mode === 'chat' || m.mode === 'responses') && !(m.deprecation_date && m.deprecation_date < today);
        })
        .sort()
        .slice(0, 10);
      if (examples.length) {
        lines.push(`Example chat models: ${examples.map((k) => `\`${k}\``).join(', ')}.`, '');
        lines.push('Use find_litellm_models with this provider to filter the full list.', '');
      }
      lines.push('---', dataFooter(data));
      return text(lines.join('\n'));
    },
  };
}

// ---------------------------------------------------------------------------

function createTools({getData = dataSource.getData, now = Date.now} = {}) {
  const get = () => getData();
  return [getModelTool(get), findTool(get, now), providerTool(get, now)];
}

const tools = createTools();

module.exports = {tools, createTools, resolveModel, configModel, stripVariant, suggest, perMillionFactor, usd, SUPPORTS, SORTS, UNAVAILABLE};
