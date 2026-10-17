// Events describe observed interactions, not proof that a search solved a task.
export function redactQuery(query) {
  return query.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b(?:sk|pk|ghp|github_pat|xox[baprs])[-_][\w-]{10,}\b/g, '[token]')
    .replace(/\bbearer\s+\S+/gi, 'Bearer [token]');
}

export class SearchAnalytics {
  constructor({capture, now = () => performance.now(), id = () => crypto.randomUUID()}) {
    this.capture = capture; this.now = now; this.id = id;
  }
  emit(event, props = {}) {
    try {this.capture(`docs_search_${event}`, {schema_version: 1, search_session_id: this.sessionId, ...props});}
    catch { /* Analytics must never affect search or navigation. */ }
  }
  open(mode = 'search', source = 'button') {
    this.sessionId = this.id(); this.openedAt = this.now();
    this.emit('opened', {mode, source});
  }
  start(query, type) {
    query = query.trim().replace(/\s+/g, ' ').toLowerCase();
    this.finish(this.current?.type !== type ? 'filter_changed' : 'query_changed');
    if (!query) return;
    const safe = redactQuery(query.slice(0, 500));
    this.current = {id: this.id(), query: safe, queryLength: query.length, redacted: safe !== query,
      type, startedAt: this.now(), active: false, shown: 0, selected: false};
  }
  props() {
    const c = this.current;
    return c ? {search_id: c.id, query: c.query, query_length: c.queryLength, query_redacted: c.redacted,
      content_type: c.type, ...c.metrics} : {};
  }
  requested() {
    if (!this.current) return;
    this.current.active = true;
    this.emit('requested', this.props());
  }
  ready(data, source) {
    const c = this.current;
    if (!c) return null;
    c.active = true; c.results = data.results; c.readyAt = this.now();
    const cache = data.clientMetrics?.cache_source || 'none';
    c.metrics = {ranking: data.ranking || source, ranking_version: data.rankingVersion || (source === 'local' ? 'lexical-v4' : null),
      model: data.model || null, candidate_count: data.candidateCount ?? data.results.length,
      context_limited: data.contextLimited ?? false, omitted_candidate_count: data.omittedCandidateCount ?? 0,
      context_limit_errors: cache === 'none' ? data.contextLimitErrors ?? 0 : 0,
      result_count: data.results.length, server_ms: data.elapsedMs ?? null,
      cost_usd: data.costUsd ?? null, ...data.clientMetrics,
      retrieval_ms: cache === 'browser' ? 0 : data.timingsMs?.retrieval ?? null,
      evidence_ms: cache === 'browser' ? 0 : data.timingsMs?.evidence ?? null,
      gateway_ms: cache === 'browser' ? 0 : data.timingsMs?.gateway ?? null,
      ordering_ms: cache === 'browser' ? 0 : data.timingsMs?.ordering ?? null,
      time_to_ready_ms: c.readyAt - c.startedAt};
    return c.id;
  }
  shown(searchId, visibleCount) {
    const c = this.current;
    if (!c || c.id !== searchId || !c.results) return;
    const count = Math.min(visibleCount, c.results.length);
    if (c.shownAt !== undefined && count <= c.shown) return;
    const first = c.shownAt === undefined;
    const impressions = c.results.slice(c.shown, count).map((result, i) => ({
      url: result.url, rank: c.shown + i + 1, original_rank: result.originalRank ?? c.shown + i + 1,
      score: result.relevance ?? null, type: result.type,
    }));
    if (first) c.shownAt = this.now();
    c.metrics.time_to_results_ms = c.shownAt - c.startedAt;
    c.metrics.render_ms = c.shownAt - c.readyAt;
    this.emit(first ? 'results_shown' : 'results_expanded', {...this.props(),
      displayed_count: count, previous_displayed_count: c.shown, no_results: !c.results.length, impressions});
    c.shown = count;
  }
  select(index, method) {
    const c = this.current, result = c?.results?.[index];
    if (!result) return;
    c.selected = true;
    this.emit('result_selected', {...this.props(), url: result.url, rank: index + 1,
      original_rank: result.originalRank ?? index + 1, rank_change: (result.originalRank ?? index + 1) - index - 1,
      score: result.relevance ?? null, method, result_type: result.type,
      time_to_selection_ms: this.now() - c.startedAt,
      results_to_selection_ms: c.shownAt === undefined ? null : this.now() - c.shownAt});
  }
  failed(metrics = {}) {
    if (!this.current) return;
    this.current.active = true; this.current.metrics = {...metrics, ranking: 'failed'};
    this.emit('failed', {...this.props(), elapsed_ms: this.now() - this.current.startedAt});
  }
  finish(reason) {
    const c = this.current;
    if (!c) return;
    if (c.active) this.emit('finished', {...this.props(), reason, selected: c.selected,
      results_shown: c.shownAt !== undefined, displayed_count: c.shown, elapsed_ms: this.now() - c.startedAt});
    this.current = null;
  }
  close(reason = 'closed') {
    this.finish(reason);
    if (this.sessionId) this.emit('closed', {reason, duration_ms: this.now() - this.openedAt});
    this.sessionId = null;
  }
}
