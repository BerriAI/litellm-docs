const {search} = require('./engine');
const {send, readBody} = require('./api');
const MAX_BODY_BYTES = 16384;

function validSearchBody(body) {
  return body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).every(key => ['query', 'type'].includes(key)) &&
    typeof body.query === 'string' && body.query.trim().length > 0 && body.query.length <= 500 &&
    (body.type === undefined || ['all', 'docs', 'blog', 'release'].includes(body.type));
}

function createKeywordSearchHandler({index, getIndex = () => index, config, now = () => performance.now()}) {
  let active = 0;
  return async (req, res) => {
    if (req.aborted || res.destroyed) return;
    if (req.method !== 'POST') return send(res, 405, {error: 'Use POST'}, {Allow: 'POST'});
    if ((req.headers.origin && req.headers.origin !== config.origin) || req.headers['sec-fetch-site'] === 'cross-site') {
      return send(res, 403, {error: 'Origin not allowed'});
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(res, 415, {error: 'Use application/json'});
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) return send(res, 413, {error: 'Query is too large'});
    // Only streaming body reads take a slot. Vercel can supply an already
    // parsed body, and waiting for the shared index must not exhaust the limit.
    const readingBody = req.body === undefined;
    if (readingBody && active >= 4) return send(res, 429, {error: 'Search is busy. Please try again.'}, {'Retry-After': '1'});
    const controller = new AbortController();
    const disconnected = () => {if (!res.writableEnded) controller.abort();};
    res.on('close', disconnected);
    try {
      let parsed;
      if (readingBody) active++;
      try {
        parsed = await readBody(req, AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]), MAX_BODY_BYTES);
      } finally {
        if (readingBody) active--;
      }
      if (controller.signal.aborted || req.aborted || res.destroyed) return;
      if (parsed.error) return send(res, parsed.status, {error: parsed.error});
      if (!validSearchBody(parsed.body)) return send(res, 400, {error: 'Send a query of 1 to 500 characters and a valid content type.'});
      const corpusStarted = now();
      const readyIndex = await getIndex();
      if (controller.signal.aborted || req.aborted || res.destroyed) return;
      res.setHeader('Server-Timing', `corpus;dur=${(now() - corpusStarted).toFixed(1)}`);
      const query = parsed.body.query.trim().replace(/\s+/g, ' ').toLowerCase();
      const type = parsed.body.type || 'all';
      const started = now();
      const results = search(readyIndex, query, {type, limit: 100});
      const elapsedMs = now() - started;
      return send(res, 200, {query, type, results, candidateCount: results.length,
        ranking: 'lexical', rankingVersion: 'lexical-v4', cached: false, costUsd: 0,
        timingsMs: {retrieval: elapsedMs}, elapsedMs});
    } catch {
      return send(res, 503, {error: 'Search is unavailable. Please try again.'});
    } finally {
      res.off('close', disconnected);
    }
  };
}
module.exports = {createKeywordSearchHandler, validSearchBody};
