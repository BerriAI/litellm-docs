const {createHmac, randomUUID, timingSafeEqual} = require('node:crypto');

const MAX_BYTES = 512 * 1024;
const MAX_QUESTION = 16000;
const WINDOW_MS = 60000;
const VISITOR_SECONDS = 86400;

function inputError(body) {
  if (body.question.length > MAX_QUESTION) return 'Keep your question under 16,000 characters. Include the relevant error or configuration excerpt.';
  if (body.history?.some(turn => turn.question.length > MAX_QUESTION)) return 'This conversation is too large. Start a new conversation with the relevant context.';
}

// The cookie identifies an anonymous visitor, not an account or trusted caller.
function visitorIdentity(req, config, now = Date.now()) {
  const secure = new URL(config.origin).protocol === 'https:';
  const name = secure ? '__Host-docs-ai' : 'docs-ai-local';
  const sign = value => createHmac('sha256', config.apiKey).update(`docs-ai/visitor/v1:${value}`).digest('base64url');
  const token = typeof req.headers.cookie === 'string' ? req.headers.cookie.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) : undefined;
  if (token && /^[a-f0-9-]{36}\.\d{10}\.[A-Za-z0-9_-]{43}$/.test(token)) {
    const [id, expires, signature] = token.split('.');
    if (Number(expires) > now / 1000 && Number(expires) <= now / 1000 + VISITOR_SECONDS &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${id}.${expires}`)))) return {id};
  }
  const id = randomUUID(), value = `${id}.${Math.floor(now / 1000) + VISITOR_SECONDS}`;
  return {id, cookie: `${name}=${value}.${sign(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${VISITOR_SECONDS}${secure ? '; Secure' : ''}`};
}

function createVisitorLimiter({now = Date.now, env = process.env, checkRateLimit, warn = console.warn} = {}) {
  const visitors = new Map();
  let lastWarning = -Infinity;
  return async id => {
    const time = now();
    for (const [key, bucket] of visitors) if (!bucket.active && time - bucket.started >= WINDOW_MS) visitors.delete(key);
    let bucket = visitors.get(id);
    if (!bucket) {
      if (visitors.size >= 4096) {
        const oldest = [...visitors].find(([, value]) => !value.active);
        if (oldest) visitors.delete(oldest[0]);
        else return {retryAfter: 3};
      }
      bucket = {started: time, count: 0, active: 0};
      visitors.set(id, bucket);
    }
    if (time - bucket.started >= WINDOW_MS) {bucket.started = time; bucket.count = 0;}
    if (bucket.count >= 20) return {retryAfter: Math.max(1, Math.ceil((bucket.started + WINDOW_MS - time) / 1000))};
    if (bucket.active >= 3) return {retryAfter: 3};
    bucket.count++; bucket.active++;
    let released = false;
    const release = () => {if (!released) {released = true; bucket.active--;}};
    if (env.VERCEL === '1') {
      try {
        // Only deployment configuration determines the SDK destination. Never
        // forward cookies, credentials, prompts, or caller-provided hosts.
        const host = env.VERCEL_PROJECT_PRODUCTION_URL;
        if (!host || !/^[a-zA-Z0-9.-]+$/.test(host)) throw new Error('Missing firewall host');
        const check = checkRateLimit || require('@vercel/firewall').checkRateLimit;
        const result = await check('docs-ai-visitor', {rateLimitKey: id, headers: new Headers({host}), timeout: 1000});
        if (result.rateLimited) {release(); return {retryAfter: 60};}
        if (result.error) throw new Error('Shared limit unavailable');
      } catch {
        // Keep Docs available during a shared-check outage. Local capacity,
        // the edge IP backstop, and the gateway budget remain independent.
        if (time - lastWarning >= WINDOW_MS) {
          lastWarning = time;
          warn('Docs AI shared visitor limit unavailable; local limits remain active.');
        }
      }
    }
    return {release};
  };
}

module.exports = {MAX_BYTES, MAX_QUESTION, inputError, visitorIdentity, createVisitorLimiter};
