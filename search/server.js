const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createReadStream} = require('node:fs');
const {loadIndex} = require('./engine');
const {answerQuestion} = require('./answer');

const loopback = host => ['localhost', '127.0.0.1', '::1', '[::1]', '::ffff:127.0.0.1'].includes(host);
function allowAI(config) {
  if (config.publicAIEnabled === true) return true;
  try { return loopback(config.host || '127.0.0.1') && loopback(new URL(config.origin).hostname); }
  catch (_) { return false; }
}

function createHandler({index, documents, config, fetchImpl, now = Date.now}) {
  const clients = new Map();
  let windowStart = now(), globalCount = 0, active = 0;
  const buildDir = path.resolve(config.buildDir || 'build');
  const send = (res, status, body, extra = {}) => {
    if (res.destroyed) return;
    res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra});
    res.end(JSON.stringify(body));
  };
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { return send(res, 400, {error: 'Invalid URL'}); }
    if (pathname === '/api/docs/ask') {
      if (!allowAI(config)) return send(res, 503, {error: 'Public Ask AI is not enabled. Document search is still available.'});
      if (!config.publicAIEnabled && !loopback(req.socket.remoteAddress)) return send(res, 403, {error: 'Ask AI is available only on this computer.'});
      if (req.method !== 'POST') return send(res, 405, {error: 'Use POST'}, {Allow: 'POST'});
      if (req.headers.origin && req.headers.origin !== config.origin) return send(res, 403, {error: 'Origin not allowed'});
      if (!(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, {error: 'Use application/json'});
      if (now() - windowStart >= 60000) {clients.clear(); globalCount = 0; windowStart = now();}
      // Do not trust caller-supplied X-Forwarded-For. Put shared rate limits at the ingress for multiple replicas.
      const client = req.socket.remoteAddress || 'unknown';
      const count = clients.get(client) || 0;
      if (count >= 10 || globalCount >= 60 || active >= 4) return send(res, 429, {error: 'Too many questions. Please try again in a minute.'}, {'Retry-After': '60'});
      clients.set(client, count + 1); globalCount += 1; active += 1;
      const controller = new AbortController();
      const disconnected = () => {if (!res.writableEnded) controller.abort();};
      res.on('close', disconnected);
      try {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk.toString();
          if (Buffer.byteLength(raw) > 65536) return send(res, 413, {error: 'Question is too large'});
        }
        let body;
        try { body = JSON.parse(raw); } catch { return send(res, 400, {error: 'Invalid JSON'}); }
        const question = body?.question;
        if (typeof question !== 'string' || !question.trim() || question.length > 500) return send(res, 400, {error: 'Enter a question between 1 and 500 characters.'});
        const history = body.history ?? [];
        if (!Array.isArray(history) || history.length > 4 || history.some(turn =>
          !turn || typeof turn.question !== 'string' || !turn.question.trim() || turn.question.length > 500 ||
          typeof turn.answer !== 'string' || turn.answer.length > 3000) ||
          history.reduce((size, turn) => size + turn.question.length + turn.answer.length, 0) > 14000) {
          return send(res, 400, {error: 'Invalid conversation history. Start a new conversation and try again.'});
        }
        const conversation = history.map(({question, answer}) => ({question, answer}));
        const result = await answerQuestion({question: question.trim(), history: conversation, index, documents, config, signal: controller.signal, fetchImpl});
        return send(res, result.status, result.body);
      } catch (_) {
        return send(res, 502, {error: 'Ask AI is temporarily unavailable. Please try again or use document search.'});
      } finally { active -= 1; res.off('close', disconnected); }
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, {error: 'Method not allowed'});
    const requested = path.resolve(buildDir, `.${pathname}`);
    if (requested !== buildDir && !requested.startsWith(buildDir + path.sep)) return send(res, 404, {error: 'Not found'});
    for (const file of [requested, `${requested}.html`, path.join(requested, 'index.html')]) {
      try {
        const stat = await fs.stat(file);
        if (!stat.isFile()) continue;
        const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2'};
        res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache'});
        if (req.method === 'HEAD') return res.end();
        createReadStream(file).on('error', () => res.destroy()).pipe(res);
        return;
      } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') break; }
    }
    send(res, 404, {error: 'Not found'});
  };
}

async function start() {
  require('dotenv').config({path: '.env.local'});
  const port = Number(process.env.PORT || 3333);
  const buildDir = path.resolve(process.env.DOCS_BUILD_DIR || 'build');
  const baseUrl = process.env.DOCS_AI_BASE_URL;
  if (baseUrl && new URL(baseUrl).protocol !== 'https:') throw new Error('The AI gateway must use HTTPS');
  const config = {buildDir, baseUrl, host: process.env.HOST || '127.0.0.1', publicAIEnabled: process.env.DOCS_AI_PUBLIC_ENABLED === 'true', apiKey: process.env.DOCS_AI_API_KEY,
    model: process.env.DOCS_AI_MODEL, origin: process.env.DOCS_ORIGIN || `http://localhost:${port}`};
  const index = loadIndex(await fs.readFile(path.join(buildDir, 'search-index.json'), 'utf8'));
  const docs = JSON.parse(await fs.readFile(path.join(buildDir, 'search-documents.json'), 'utf8'));
  const server = http.createServer(createHandler({index, documents: new Map(docs.map(doc => [doc.id, doc])), config}));
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(port, config.host, () => console.log(`Docs search ready at http://localhost:${port}`));
}
if (require.main === module) start().catch(() => {console.error('Cannot start docs search. Build the docs and check the server configuration.'); process.exitCode = 1;});
module.exports = {createHandler, allowAI};
