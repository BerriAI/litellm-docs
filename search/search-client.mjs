export class SearchSession {
  constructor(callbacks, {fetchImpl = fetch, timers = globalThis, searchBaseline, rerankUrl = '/api/rerank'} = {}) {
    this.callbacks = callbacks; this.fetch = (...args) => fetchImpl(...args); this.timers = timers;
    this.searchBaseline = searchBaseline; this.rerankUrl = rerankUrl;
    this.version = 0; this.cache = new Map();
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
      this.callbacks.onBaseline(cached.baseline, {final: false});
      this.callbacks.onRanked({...cached.ranked, cached: true, elapsedMs: 0, costUsd: 0});
      return;
    }
    this.controller = new AbortController();
    const signal = this.controller.signal;
    let baseline, baselineError;
    const post = async endpoint => {
      const response = await this.fetch(endpoint, {method: 'POST', signal, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({query, type})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Search failed.');
      return result;
    };
    let baselineDone;
    this.localTimer = this.timers.setTimeout(() => {
      baselineDone = (async () => this.searchBaseline ? this.searchBaseline(query, type, signal) : post('/api/search'))()
        .then(data => {baseline = data;})
        .catch(error => {baselineError = error;});
    }, immediate ? 0 : 250);
    this.rankTimer = this.timers.setTimeout(async () => {
      if (!current()) return;
      this.callbacks.onRanking();
      try {
        const ranked = await post(this.rerankUrl);
        await baselineDone;
        if (!current()) return;
        if (baseline) {
          if (this.cache.size >= 256) this.cache.delete(this.cache.keys().next().value);
          this.cache.set(key, {baseline, ranked, at: Date.now()});
          this.callbacks.onBaseline(baseline, {final: false});
        }
        this.callbacks.onRanked(ranked);
      } catch (error) {
        await baselineDone;
        if (!current() || signal.aborted) return;
        if (baseline) {
          this.callbacks.onBaseline(baseline);
          (this.callbacks.onRankError || this.callbacks.onError)(error.message);
        } else this.callbacks.onError(baselineError?.message || error.message);
      }
    }, immediate ? 0 : 450);
  }
  cancel() {
    this.version++;
    this.timers.clearTimeout(this.localTimer); this.timers.clearTimeout(this.rankTimer);
    this.controller?.abort();
  }
}
