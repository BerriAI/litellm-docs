export class SearchSession {
  constructor(callbacks, {fetchImpl = fetch, timers = globalThis, searchBaseline, rerankUrl = '/api/rerank', now = () => performance.now()} = {}) {
    this.callbacks = callbacks; this.fetch = (...args) => fetchImpl(...args); this.timers = timers;
    this.searchBaseline = searchBaseline; this.rerankUrl = rerankUrl;
    this.version = 0; this.cache = new Map();
    this.now = now;
  }
  search(query, type = 'all', immediate = false) {
    this.cancel();
    query = query.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!query) return;
    const version = this.version;
    const current = () => version === this.version;
    const key = JSON.stringify([query, type]);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < 15 * 60 * 1000) {
      if (cached.baseline) this.callbacks.onBaseline(cached.baseline, {final: false});
      this.callbacks.onRanked({...cached.ranked, cached: true, elapsedMs: 0, costUsd: 0,
        clientMetrics: {cache_source: 'browser', debounce_ms: 0, request_ms: 0, corpus_load_ms: 0}});
      return;
    }
    this.controller = new AbortController();
    const signal = this.controller.signal;
    let baseline, baselineError, baselineMs, requestMs, corpusLoadMs;
    const started = this.now();
    const post = async endpoint => {
      const response = await this.fetch(endpoint, {method: 'POST', signal, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({query, type})});
      const result = await response.json();
      if (!response.ok) throw Object.assign(new Error(result.error || 'Search failed.'), {status: response.status});
      if (endpoint === this.rerankUrl) {
        const timing = response.headers.get('Server-Timing')?.match(/corpus;dur=([\d.]+)/);
        corpusLoadMs = timing ? Number(timing[1]) : null;
      }
      return result;
    };
    let baselineDone;
    this.localTimer = this.timers.setTimeout(() => {
      const localStarted = this.now();
      baselineDone = (async () => this.searchBaseline ? this.searchBaseline(query, type, signal) : post('/api/search'))()
        .then(data => {baseline = data; baselineMs = this.now() - localStarted;})
        .catch(error => {baselineError = error;});
    }, immediate ? 0 : 250);
    this.rankTimer = this.timers.setTimeout(async () => {
      if (!current()) return;
      this.callbacks.onRanking();
      const requestStarted = this.now();
      const metrics = (cacheSource = 'none') => ({cache_source: cacheSource, debounce_ms: requestStarted - started,
        request_ms: requestMs, baseline_ms: baselineMs ?? null, corpus_load_ms: corpusLoadMs ?? null});
      try {
        const ranked = await post(this.rerankUrl);
        requestMs = this.now() - requestStarted;
        if (!current()) return;
        if (this.cache.size >= 256) this.cache.delete(this.cache.keys().next().value);
        const entry = {baseline, ranked, at: Date.now()};
        this.cache.set(key, entry);
        if (baseline) this.callbacks.onBaseline(baseline, {final: false});
        // The server's final order does not depend on downloading the browser index.
        this.callbacks.onRanked({...ranked, clientMetrics: metrics(ranked.cached ? 'server' : 'none')});
        if (!baseline) baselineDone?.then(() => {
          if (!baseline) return;
          entry.baseline = baseline;
          if (current()) this.callbacks.onBaseline(baseline, {final: false});
        });
      } catch (error) {
        requestMs = this.now() - requestStarted;
        await baselineDone;
        if (!current() || signal.aborted) return;
        if (baseline) {
          this.callbacks.onBaseline({...baseline, clientMetrics: {...metrics(), fallback_status: error.status || 'network'}});
          (this.callbacks.onRankError || this.callbacks.onError)(error.message);
        } else this.callbacks.onError(baselineError?.message || error.message, {...metrics(), fallback_status: error.status || 'network'});
      }
    }, immediate ? 0 : 450);
  }
  cancel() {
    this.version++;
    this.timers.clearTimeout(this.localTimer); this.timers.clearTimeout(this.rankTimer);
    this.controller?.abort();
  }
}
