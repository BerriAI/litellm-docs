export class KeywordSearchSession {
  constructor(callbacks, {fetchImpl = fetch, searchUrl = '/api/docs/search', now = () => performance.now()} = {}) {
    this.callbacks = callbacks; this.fetch = (...args) => fetchImpl(...args);
    this.searchUrl = searchUrl; this.now = now; this.version = 0;
  }
  search(query, type = 'all') {
    this.cancel();
    query = query.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!query) return;
    const version = this.version;
    this.controller = new AbortController();
    const signal = this.controller.signal;
    const current = () => version === this.version && !signal.aborted;
    const started = this.now();
    const metrics = () => ({cache_source: 'none', debounce_ms: 0, request_ms: this.now() - started});
    this.callbacks.onRequest();
    (async () => {
      try {
        const response = await this.fetch(this.searchUrl, {method: 'POST', signal, cache: 'no-store',
          headers: {'Content-Type': 'application/json'}, body: JSON.stringify({query, type})});
        const data = await response.json();
        if (!current()) return;
        if (!response.ok) throw new Error(data.error || 'Search is unavailable. Please try again.');
        const timing = response.headers.get('Server-Timing')?.match(/corpus;dur=([\d.]+)/);
        this.callbacks.onResults({...data, clientMetrics: {...metrics(), corpus_load_ms: timing ? Number(timing[1]) : null}});
      } catch (error) {
        if (current()) this.callbacks.onError(error.message, metrics());
      }
    })();
  }
  cancel() {
    this.version++;
    this.controller?.abort();
  }
}
