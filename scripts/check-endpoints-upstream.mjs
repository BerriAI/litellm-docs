// Warns when BerriAI/litellm serves an endpoint or a pass-through route that
// the Supported Endpoints page (src/data/endpoints.js) does not list.
//
// Two sources on BerriAI/litellm main:
// - provider_endpoints_support.json: the `endpoints` map of unified endpoints.
// - litellm/proxy/pass_through_endpoints/llm_passthrough_endpoints.py: the
//   provider pass-through route prefixes.
//
// This check only warns. It always exits 0, so a new upstream route or a
// GitHub outage never blocks a build or a PR. scripts/build.cjs runs it on
// Vercel deploys, and the docs-checks workflow runs it on pull requests.
//
//   node scripts/check-endpoints-upstream.mjs
import {get} from 'node:https';
import {ENDPOINTS, PASS_THROUGH} from '../src/data/endpoints.js';

const SUPPORT_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/provider_endpoints_support.json';
const PASSTHROUGH_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/litellm/proxy/pass_through_endpoints/llm_passthrough_endpoints.py';
const TIMEOUT_MS = 15000;

// Upstream endpoint keys whose name differs from the id in endpoints.js.
const ENDPOINT_ALIASES = {
  audio_transcription: 'audio_transcriptions',
  container: 'containers',
  generateContent: 'generate_content',
  moderation: 'moderations',
  response_api_compact: 'responses',
  systemone: 'decisions',
  text_to_speech: 'audio_speech',
  vector_stores_create: 'vector_stores',
  vector_stores_search: 'vector_stores',
};

// Routes in the pass-through file that are not provider pass-through pages:
// admin config routes, aliases of a listed prefix, and native endpoints that
// the page lists as cards.
const IGNORED_ROUTES = new Set([
  '/config',
  '/openai', // alias of /openai_passthrough
  '/vertex-ai', // alias of /vertex_ai
  '/eu.assemblyai', // EU host of /assemblyai
  '/backend-api', // Codex backend relay
  '/laya', // decision models, listed under /v1/decisions
  '/bespoke', // decision models, listed under /v1/decisions
  '/v1', // path suffixes such as "/v1/systemone" in helper code, not routes
]);

const inCI = Boolean(process.env.GITHUB_ACTIONS);
let warnings = 0;

function warn(message) {
  warnings += 1;
  if (inCI) console.log(`::warning title=Supported Endpoints::${message}`);
  else console.warn(`[endpoints] warning: ${message}`);
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = get(url, {headers: {'User-Agent': 'litellm-docs-endpoints-check'}}, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`${url} returned ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error(`${url} timed out`)));
  });
}

// The first path segment of each route, e.g. "/anthropic" for
// "/anthropic/{endpoint:path}" or "/deepgram" for "/deepgram/v1/listen".
const prefixOf = (route) => `/${route.split('/')[1]}`;

async function checkEndpoints() {
  const support = JSON.parse(await fetchText(SUPPORT_URL));
  const listed = new Set(ENDPOINTS.map((e) => e.id));
  for (const key of Object.keys(support.endpoints ?? {})) {
    const id = ENDPOINT_ALIASES[key] ?? key;
    if (!listed.has(id)) {
      warn(`BerriAI/litellm lists the "${key}" endpoint, but src/data/endpoints.js has no "${id}" entry. Add a card, or add the key to ENDPOINT_ALIASES in scripts/check-endpoints-upstream.mjs.`);
    }
  }
}

async function checkPassThrough() {
  const source = await fetchText(PASSTHROUGH_URL);
  // Route decorators and websocket registrations, e.g. "/anthropic/{endpoint:path}".
  const routes = new Set([...source.matchAll(/"(\/[a-z0-9_.-]+(?:\/[^"\s]*)?)"/gi)].map((m) => m[1]));
  const upstream = new Set(
    [...routes].filter((r) => /\{(endpoint|operation)[^}]*\}|\/v1\/listen$|\/live$|\/systemone$/.test(r)).map(prefixOf),
  );
  const listed = new Set(PASS_THROUGH.filter((p) => p.route).map((p) => prefixOf(p.route)));
  for (const prefix of [...upstream].sort()) {
    if (listed.has(prefix) || IGNORED_ROUTES.has(prefix)) continue;
    warn(`BerriAI/litellm has a "${prefix}" pass-through route, but PASS_THROUGH in src/data/endpoints.js does not list it. Add the provider with its route, or add the prefix to IGNORED_ROUTES in scripts/check-endpoints-upstream.mjs.`);
  }
}

for (const [name, check] of [['endpoints', checkEndpoints], ['pass-through routes', checkPassThrough]]) {
  try {
    await check();
  } catch (err) {
    console.warn(`[endpoints] Could not check ${name} against BerriAI/litellm: ${err.message}`);
  }
}

console.log(`[endpoints] Upstream check done with ${warnings} warning(s).`);
process.exit(0);
