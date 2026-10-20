import {createHash} from 'node:crypto';
import {FIELD_LIMITS, WORKSHOP_DATES, buildWorkshopSubmission} from '../blog/cloud-agent-workshop/signup-payload.mjs';

const MAX_BODY_BYTES = 16384;
const HANDOFF_ORIGINS = new Set(['https://handoff.litellm.ai', 'https://litellm-handoff.onrender.com', 'https://litellm-workshop-directions.ishaan196385.chatgpt.site']);
const HANDOFF_DATES = 'October 26–November 9, 2026';
const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.it', 'hotmail.es', 'hotmail.ca', 'hotmail.com.au', 'hotmail.co.jp',
  'outlook.com', 'outlook.co.uk', 'outlook.fr', 'outlook.de', 'outlook.it', 'outlook.es', 'outlook.com.au', 'outlook.jp',
  'live.com', 'live.co.uk', 'live.fr', 'live.de', 'live.it', 'live.nl', 'live.ca', 'live.com.au', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.in', 'yahoo.co.jp', 'yahoo.fr', 'yahoo.de', 'yahoo.it', 'yahoo.es', 'yahoo.ca',
  'yahoo.com.au', 'yahoo.com.br', 'yahoo.com.mx', 'yahoo.com.sg', 'yahoo.com.hk', 'yahoo.co.id', 'yahoo.com.tw', 'yahoo.co.kr', 'ymail.com', 'rocketmail.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'aim.com',
  'proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me', 'fastmail.com', 'fastmail.fm', 'hey.com', 'mail.com', 'email.com',
  'gmx.com', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch',
];
const ALLOWED_FIELDS = [...Object.keys(FIELD_LIMITS), 'submissionId', 'source'];
const loopback = host => ['localhost', '127.0.0.1', '::1', '[::1]', '::ffff:127.0.0.1'].includes(host);

function isPersonalEmail(email) {
  const domain = email.trim().toLowerCase().split('@').pop().replace(/\.+$/, '');
  return PERSONAL_EMAIL_DOMAINS.some(personal => domain === personal || domain.endsWith(`.${personal}`));
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers});
  res.end(JSON.stringify(body));
}

function allowedOrigin(req, env) {
  const raw = req.headers.origin;
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    if (url.origin !== raw) return null;
    const origins = new Set(['https://docs.litellm.ai']);
    if (env.DOCS_ORIGIN) origins.add(new URL(env.DOCS_ORIGIN).origin);
    for (const value of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
      if (value) origins.add(new URL(`https://${value}`).origin);
    }
    // HANDOFF submits to this docs endpoint; only these exact sites may use CORS.
    const allowedHost = [...origins].some(value => new URL(value).host === req.headers.host);
    if (HANDOFF_ORIGINS.has(raw) && allowedHost) return raw;
    if (url.host !== req.headers.host || req.headers['sec-fetch-site'] === 'cross-site') return null;
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
      ['LinkedIn', payload.linkedin], ['Goals', payload.workflow],
      ...(payload.deploymentTimeline ? [['Deployment timeline', payload.deploymentTimeline]] : []),
      ['On-site interest', payload.onsiteInterest],
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
    ...(values.deploymentTimeline ? {deploymentTimeline: values.deploymentTimeline} : {}),
    submissionId: values.submissionId,
    workshop: 'Build a self-hosted cloud agent',
    dates: HANDOFF_ORIGINS.has(origin) ? HANDOFF_DATES : WORKSHOP_DATES,
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
    if (!['POST', 'OPTIONS'].includes(req.method)) return send(res, 405, {error: 'Use POST.'}, {Allow: 'POST, OPTIONS'});
    const origin = allowedOrigin(req, env);
    if (!origin) return send(res, 403, {error: 'Origin not allowed.'});
    const cors = HANDOFF_ORIGINS.has(origin) ? {'Access-Control-Allow-Origin': origin, Vary: 'Origin'} : {};
    const reply = (status, body, headers = {}) => send(res, status, body, {...cors, ...headers});
    if (req.method === 'OPTIONS') {
      const requestedHeaders = String(req.headers['access-control-request-headers'] || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
      if (req.headers['access-control-request-method'] !== 'POST' || requestedHeaders.some(value => value !== 'content-type')) {
        return reply(403, {error: 'Preflight not allowed.'});
      }
      return reply(204, undefined, {'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600'});
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return reply(415, {error: 'Use application/json.'});
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) return reply(413, {error: 'Request is too large.'});
    const destination = hookUrl(env.WORKSHOP_ZAPIER_WEBHOOK_URL);
    if (!destination) return reply(503, {error: 'Workshop signup is temporarily unavailable.'});
    if (now() - windowStart >= 60000) { attempts.clear(); windowStart = now(); count = 0; }
    if (count >= 60 || active >= 8) return reply(429, {error: 'Please try again in a minute.'}, {'Retry-After': '60'});
    count += 1;
    active += 1;
    try {
      const parsed = await readBody(req);
      if (parsed.status) return reply(parsed.status, {error: 'Invalid signup request.'});
      let payload;
      try { payload = payloadFor(parsed.body, origin); } catch { /* Validation errors never reach Zapier. */ }
      if (!payload) return reply(400, {error: 'Please check your workshop signup details.'});
      if (HANDOFF_ORIGINS.has(origin) && isPersonalEmail(payload.email)) {
        return reply(400, {code: 'WORK_EMAIL_REQUIRED', error: 'Enter your work email address. Personal email addresses are not accepted.'});
      }
      const key = createHash('sha256').update(payload.email.toLowerCase()).digest('hex');
      const emailAttempts = attempts.get(key) || 0;
      if (emailAttempts >= 5) return reply(429, {error: 'Please try again in a minute.'}, {'Retry-After': '60'});
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
      return reply(200, {ok: true, submissionId: payload.submissionId});
    } catch {
      return reply(502, {error: 'We could not confirm your signup. Please try again.'});
    } finally { active -= 1; }
  };
}
