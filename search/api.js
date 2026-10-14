const {answerQuestion} = require('./answer');

const MAX_BODY_BYTES = 16384;
const loopback = host => ['localhost', '127.0.0.1', '::1', '[::1]', '::ffff:127.0.0.1'].includes(host);
function allowAI(config) {
  if (config.publicAIEnabled === true) return true;
  try { return loopback(config.host || '127.0.0.1') && loopback(new URL(config.origin).hostname); }
  catch { return false; }
}
function send(res, status, body, extra = {}) {
  if (res.destroyed) return;
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...extra});
  res.end(JSON.stringify(body));
}
const fieldsAre = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every(key => fields.includes(key));
const validQuestion = question => typeof question === 'string' && question.trim().length > 0 && question.length <= 500;
function validBody(body) {
  return fieldsAre(body, ['question', 'history', 'traceContext']) && validQuestion(body.question) &&
    (body.traceContext === undefined || (typeof body.traceContext === 'string' &&
      /^[a-f0-9]{32}\.[a-f0-9]{16}\.[A-Za-z0-9_-]{43}$/.test(body.traceContext))) &&
    (body.history === undefined || (Array.isArray(body.history) && body.history.length <= 4 &&
      body.history.every(turn => fieldsAre(turn, ['question']) && validQuestion(turn.question))));
}
async function readBody(req, signal) {
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return {status: 413, error: 'Question is too large'};
    try { return {body: JSON.parse(raw)}; } catch { return {status: 400, error: 'Invalid JSON'}; }
  }
  const chunks = [];
  let size = 0;
  const stop = () => req.destroy();
  signal.addEventListener('abort', stop, {once: true});
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) return {status: 413, error: 'Question is too large'};
      chunks.push(chunk);
    }
    try { return {body: JSON.parse(Buffer.concat(chunks).toString('utf8'))}; }
    catch { return {status: 400, error: 'Invalid JSON'}; }
  } finally { signal.removeEventListener('abort', stop); }
}
function createAskHandler({index, documents, config, fetchImpl, now = Date.now}) {
  const clients = new Map();
  let windowStart = now(), globalCount = 0, active = 0;
  return async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, {error: 'Use POST'}, {Allow: 'POST'});
    if (!allowAI(config)) return send(res, 503, {error: 'Ask AI is not enabled. Document search is still available.'});
    if (!config.publicAIEnabled && (!loopback(req.socket.remoteAddress) || req.headers.host !== new URL(config.origin).host)) {
      return send(res, 403, {error: 'Ask AI is available only on this computer.'});
    }
    if ((req.headers.origin && req.headers.origin !== config.origin) || req.headers['sec-fetch-site'] === 'cross-site') {
      return send(res, 403, {error: 'Origin not allowed'});
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(res, 415, {error: 'Use application/json'});
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) return send(res, 413, {error: 'Question is too large'});
    if (now() - windowStart >= 60000) {clients.clear(); globalCount = 0; windowStart = now();}
    const client = req.socket.remoteAddress || 'unknown';
    const count = clients.get(client) || 0;
    if (count >= 10 || globalCount >= 60 || active >= 4) {
      return send(res, 429, {error: 'Too many questions. Please try again in a minute.'}, {'Retry-After': '60'});
    }
    clients.set(client, count + 1); globalCount += 1; active += 1;
    const controller = new AbortController();
    const disconnected = () => {if (!res.writableEnded) controller.abort();};
    res.on('close', disconnected);
    try {
      const parsed = await readBody(req, AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]));
      if (parsed.error) return send(res, parsed.status, {error: parsed.error});
      if (!validBody(parsed.body)) return send(res, 400, {error: 'Send a question of 1 to 500 characters and up to four previous questions.'});
      const {question, history = [], traceContext} = parsed.body;
      const result = await answerQuestion({question: question.trim(), history, index, documents, config,
        traceContext, onTraceContext: value => res.setHeader('X-Docs-Trace-Context', value),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50000)]), fetchImpl});
      return send(res, result.status, result.body);
    } catch {
      return send(res, 502, {error: 'Ask AI is temporarily unavailable. Please try again or use document search.'});
    } finally { active -= 1; res.off('close', disconnected); }
  };
}
module.exports = {createAskHandler, allowAI, send, validBody};
