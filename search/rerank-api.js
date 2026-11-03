const {createReranker} = require('./rerank');
const {allowAI, send, readBody, loopback} = require('./api');
const {validSearchBody} = require('./keyword-api');
const MAX_BODY_BYTES = 16384;

function createRerankHandler(options) {
  const {config, now = Date.now} = options;
  const ranker = createReranker(options);
  const clients = new Map();
  let windowStart = now(), globalCount = 0, active = 0;
  return async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, {error: 'Use POST'}, {Allow: 'POST'});
    if (!config.apiKey || !allowAI({...config, publicAIEnabled: config.publicRerankEnabled})) {
      return send(res, 503, {error: 'Search reranking is not enabled. Local search is still available.'});
    }
    if (!config.publicRerankEnabled && (!loopback(req.socket.remoteAddress) || req.headers.host !== new URL(config.origin).host)) {
      return send(res, 403, {error: 'Search reranking is available only on this computer.'});
    }
    if ((req.headers.origin && req.headers.origin !== config.origin) || req.headers['sec-fetch-site'] === 'cross-site') {
      return send(res, 403, {error: 'Origin not allowed'});
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(res, 415, {error: 'Use application/json'});
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) return send(res, 413, {error: 'Query is too large'});
    if (now() - windowStart >= 60000) {clients.clear(); globalCount = 0; windowStart = now();}
    const client = req.socket.remoteAddress || 'unknown';
    const count = clients.get(client) || 0;
    if (count >= 30 || globalCount >= 120 || active >= 4) {
      return send(res, 429, {error: 'Search reranking is busy. Local results are still available.'}, {'Retry-After': '60'});
    }
    clients.set(client, count + 1); globalCount++; active++;
    const controller = new AbortController();
    const disconnected = () => {if (!res.writableEnded) controller.abort();};
    res.on('close', disconnected);
    try {
      const parsed = await readBody(req, AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]), MAX_BODY_BYTES);
      if (parsed.error) return send(res, parsed.status, {error: parsed.error});
      if (!validSearchBody(parsed.body)) return send(res, 400, {error: 'Send a query of 1 to 500 characters and a valid content type.'});
      const {query, type = 'all'} = parsed.body;
      const result = await ranker.rerank(query, type, controller.signal);
      return send(res, 200, result);
    } catch {
      return send(res, 502, {error: 'Search reranking is unavailable. Local results are still available.'});
    } finally {active--; res.off('close', disconnected);}
  };
}

module.exports = {createRerankHandler, validSearchBody};
