import {createHash} from 'node:crypto';
import {FIELD_LIMITS, WORKSHOP_DATES, buildWorkshopSubmission} from '../blog/cloud-agent-workshop/signup-payload.mjs';

const MAX_BODY_BYTES = 16384;
const ALLOWED_FIELDS = [...Object.keys(FIELD_LIMITS), 'submissionId', 'source'];
const loopback = host => ['localhost', '127.0.0.1', '::1', '[::1]', '::ffff:127.0.0.1'].includes(host);

function send(res, status, body, headers = {}) {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers});
  res.end(JSON.stringify(body));
}

function allowedOrigin(req, env) {
  const raw = req.headers.origin;
  if (typeof raw !== 'string' || req.headers['sec-fetch-site'] === 'cross-site') return null;
  try {
    const url = new URL(raw);
    if (url.origin !== raw || url.host !== req.headers.host) return null;
    const origins = new Set(['https://docs.litellm.ai']);
    if (env.DOCS_ORIGIN) origins.add(new URL(env.DOCS_ORIGIN).origin);
    for (const value of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
      if (value) origins.add(new URL(`https://${value}`).origin);
    }
    if (url.protocol === 'https:' && origins.has(raw)) return raw;
    if (env.VERCEL !== '1' && url.protocol === 'http:' && loopback(url.hostname) && loopback(req.socket?.remoteAddress)) return raw;
  } catch { /* Invalid origins are rejected. */ }
  return null;
}

function hookUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'hooks.zapier.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/hooks\/catch\/[^/]+\/[^/]+\/?$/.test(url.pathname)) return url.href;
  } catch { /* Missing or invalid server configuration fails closed. */ }
  return null;
}

async function readBody(req) {
  let body;
  try { body = req.body; } catch { return {status: 400}; }
  if (body !== undefined) {
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return {status: 413};
    try { return {body: JSON.parse(raw)}; } catch { return {status: 400}; }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > MAX_BODY_BYTES) return {status: 413};
    chunks.push(Buffer.from(chunk));
  }
  try { return {body: JSON.parse(Buffer.concat(chunks).toString('utf8'))}; } catch { return {status: 400}; }
}

function slackMessageFor(payload) {
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return [
    '*New cloud agent workshop signup*',
    `${payload.workshop} · ${payload.dates} · ${payload.format}`,
    '',
    ...[
      ['Name', payload.name], ['Work email', payload.email], ['Company', payload.company],
      ['LinkedIn', payload.linkedin], ['Goals', payload.workflow], ['On-site interest', payload.onsiteInterest],
      ['Source', payload.source], ['Submission ID', payload.submissionId],
    ].map(([label, value]) => `*${label}:* ${escape(value)}`),
  ].join('\n');
}

function payloadFor(body, origin) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !ALLOWED_FIELDS.includes(key))) return null;
  if (Object.entries(body).some(([, value]) => typeof value !== 'string')) return null;
  const values = buildWorkshopSubmission(body, {submissionId: body.submissionId});
  if (typeof body.source !== 'string' || body.source.length > 1000) return null;
  const source = new URL(body.source);
  if (source.origin !== origin || source.username || source.password) return null;
  source.search = '';
  source.hash = '';
  const payload = {
    event: 'cloud_agent_workshop_signup',
    name: values.name,
    email: values.email,
    company: values.company,
    linkedin: values.linkedin,
    workflow: values.workflow,
    onsiteInterest: values.onsiteInterest || 'Not specified',
    submissionId: values.submissionId,
    workshop: 'Build a self-hosted cloud agent',
    dates: WORKSHOP_DATES,
    format: 'Remote · 2 weeks',
    source: source.href,
  };
  return {...payload, slackMessage: slackMessageFor(payload)};
}

export function createWorkshopSignupHandler({env = process.env, fetchImpl = fetch, now = Date.now, timeoutMs = 8000} = {}) {
  // Best-effort, bounded per-instance limits; no PII is kept in the counters.
  const attempts = new Map();
  let windowStart = now(), count = 0, active = 0;
  return async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, {error: 'Use POST.'}, {Allow: 'POST'});
    const origin = allowedOrigin(req, env);
    if (!origin) return send(res, 403, {error: 'Origin not allowed.'});
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(res, 415, {error: 'Use application/json.'});
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) return send(res, 413, {error: 'Request is too large.'});
    const destination = hookUrl(env.WORKSHOP_ZAPIER_WEBHOOK_URL);
    if (!destination) return send(res, 503, {error: 'Workshop signup is temporarily unavailable.'});
    if (now() - windowStart >= 60000) { attempts.clear(); windowStart = now(); count = 0; }
    if (count >= 60 || active >= 8) return send(res, 429, {error: 'Please try again in a minute.'}, {'Retry-After': '60'});
    count += 1;
    active += 1;
    try {
      const parsed = await readBody(req);
      if (parsed.status) return send(res, parsed.status, {error: 'Invalid signup request.'});
      let payload;
      try { payload = payloadFor(parsed.body, origin); } catch { /* Validation errors never reach Zapier. */ }
      if (!payload) return send(res, 400, {error: 'Please check your workshop signup details.'});
      const key = createHash('sha256').update(payload.email.toLowerCase()).digest('hex');
      const emailAttempts = attempts.get(key) || 0;
      if (emailAttempts >= 5) return send(res, 429, {error: 'Please try again in a minute.'}, {'Retry-After': '60'});
      attempts.set(key, emailAttempts + 1);
      const response = await fetchImpl(destination, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error('Upstream rejected signup.');
      const result = await response.json();
      // This endpoint uses Catch Hook, never its silent variant. Only Zapier's
      // explicit receipt is confirmation; a 200 HTML page or empty body is not.
      if (result?.status !== 'success' || result?.success === false || result?.ok === false || result?.error || Number(result?.code) >= 400) throw new Error('Upstream rejected signup.');
      return send(res, 200, {ok: true, submissionId: payload.submissionId});
    } catch {
      return send(res, 502, {error: 'We could not confirm your signup. Please try again.'});
    } finally { active -= 1; }
  };
}
