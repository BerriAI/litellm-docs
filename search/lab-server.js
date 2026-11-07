const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createReranker} = require('./rerank');
const {loadCorpus} = require('./runtime');

function json(res, status, body) {
  if (res.destroyed) return;
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(JSON.stringify(body));
}
function createLabHandler({ranker, port, html, clientScript}) {
  const hosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
  let active = 0;
  return async (req, res) => {
    if (!hosts.has(req.headers.host) || (req.headers.origin && ![...hosts].some(host => req.headers.origin === `http://${host}`)) || req.headers['sec-fetch-site'] === 'cross-site') {
      return json(res, 403, {error: 'This experiment is available only on this computer.'});
    }
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY'});
      return res.end(html);
    }
    if (req.method === 'GET' && url.pathname === '/search-client.mjs') {
      res.writeHead(200, {'Content-Type': 'text/javascript', 'Cache-Control': 'no-store'});
      return res.end(clientScript);
    }
    if (req.method !== 'POST' || !['/api/search', '/api/rerank'].includes(url.pathname)) return json(res, 404, {error: 'Not found'});
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, {error: 'Use application/json'});
    if (active >= 4) return json(res, 429, {error: 'Search is busy. Try again in a moment.'});
    const controller = new AbortController();
    const disconnected = () => {if (!res.writableEnded) controller.abort();};
    res.on('close', disconnected);
    const deadline = setTimeout(() => controller.abort(), 15000);
    const stopReading = () => req.destroy();
    controller.signal.addEventListener('abort', stopReading, {once: true});
    active++;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4096) return json(res, 413, {error: 'Query is too large.'});
        chunks.push(chunk);
      }
      controller.signal.removeEventListener('abort', stopReading);
      let body;
      try {body = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {return json(res, 400, {error: 'Invalid JSON.'});}
      if (!body || Array.isArray(body) || Object.keys(body).some(key => !['query', 'type'].includes(key)) || typeof body.query !== 'string' || !body.query.trim() || body.query.length > 500 || !['all', 'docs', 'blog', 'release'].includes(body.type || 'all')) {
        return json(res, 400, {error: 'Enter a query of 1 to 500 characters and a valid content type.'});
      }
      const started = performance.now();
      if (url.pathname === '/api/search') {
        const results = ranker.candidates(body.query, body.type || 'all');
        return json(res, 200, {query: body.query, results, candidateCount: results.length, elapsedMs: Math.round(performance.now() - started)});
      }
      const result = await ranker.rerank(body.query, body.type || 'all', controller.signal);
      return json(res, 200, result);
    } catch (error) {
      return json(res, 502, {error: /^Jev returned/.test(error.message) ? error.message : 'Jev is unavailable. Current search results are still shown.'});
    } finally {
      clearTimeout(deadline); active--;
      controller.signal.removeEventListener('abort', stopReading);
      res.off('close', disconnected);
    }
  };
}
async function start() {
  require('dotenv').config({path: process.env.DOCS_AI_ENV_FILE || '.env.local', quiet: true});
  const port = Number(process.env.PORT || 3347);
  const corpusDir = path.resolve(process.env.DOCS_SEARCH_CORPUS || '.cache-loader/jev-search');
  const corpus = await loadCorpus(corpusDir);
  let pageStructure = {};
  try {pageStructure = JSON.parse(await fs.readFile(path.join(corpusDir, 'search-structure.json'), 'utf8')).pages;} catch (error) {if (error.code !== 'ENOENT') throw error;}
  const config = {apiKey: process.env.DOCS_AI_API_KEY, baseUrl: process.env.DOCS_AI_BASE_URL || 'https://gateway.litellm-sandbox.ai'};
  if (!config.apiKey) throw new Error('Set DOCS_AI_API_KEY in .env.local or specify DOCS_AI_ENV_FILE.');
  const ranker = createReranker({...corpus, pageStructure, config});
  const html = await fs.readFile(path.join(__dirname, 'lab.html'), 'utf8');
  const clientScript = await fs.readFile(path.join(__dirname, 'search-client.mjs'), 'utf8');
  const server = http.createServer(createLabHandler({ranker, port, html, clientScript}));
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  server.listen(port, '127.0.0.1', () => console.log(`Jev search playground: http://localhost:${port}`));
}
if (require.main === module) start().catch(error => {console.error(error.message); process.exitCode = 1;});
module.exports = {createLabHandler};
