const test = require('node:test');
const assert = require('node:assert/strict');

async function fixture() {
  const {SearchAnalytics} = await import('./search-analytics.mjs');
  let clock = 0, next = 0;
  const events = [];
  const analytics = new SearchAnalytics({capture: (event, props) => events.push({event, props}), now: () => clock, id: () => String(++next)});
  return {analytics, events, tick: ms => {clock += ms;}, find: suffix => events.filter(e => e.event === `docs_search_${suffix}`)};
}
const result = {url: '/docs/sso', title: 'SSO', originalRank: 19, relevance: .8, type: 'docs'};

test('search impressions and keyboard selections share IDs, ranks, timing, and cost', async () => {
  const {analytics: a, tick, find} = await fixture();
  a.open('search', 'keyboard'); a.start('  ENTRA  ', 'docs'); tick(450); a.requested(); tick(600);
  const id = a.ready({results: [result], model: 'jev', rankingVersion: 'intent-v2', elapsedMs: 550, costUsd: .005,
    clientMetrics: {cache_source: 'none', debounce_ms: 450, request_ms: 600}, timingsMs: {retrieval: 15, evidence: 35, gateway: 500, ordering: 0}}, 'jev');
  tick(16); a.shown(id, 25); a.shown(id, 25); tick(200); a.select(0, 'keyboard'); a.close(); a.close();
  assert.equal(find('results_shown').length, 1);
  const shown = find('results_shown')[0].props, selected = find('result_selected')[0].props;
  assert.equal(shown.query, 'entra'); assert.equal(shown.time_to_results_ms, 1066);
  assert.equal(shown.render_ms, 16); assert.equal(shown.gateway_ms, 500); assert.equal(shown.cost_usd, .005);
  assert.equal(selected.search_id, shown.search_id); assert.equal(selected.search_session_id, shown.search_session_id);
  assert.equal(selected.rank, 1); assert.equal(selected.original_rank, 19); assert.equal(selected.rank_change, 18);
  assert.equal(selected.results_to_selection_ms, 200); assert.equal(selected.method, 'keyboard');
  assert.equal(find('finished')[0].props.selected, true); assert.equal(find('closed').length, 1);
});

test('typing before debounce emits no query events and changes end only attempted searches', async () => {
  const {analytics: a, find} = await fixture();
  a.open(); a.start('e', 'all'); a.start('en', 'all'); a.start('entra', 'all');
  assert.equal(find('finished').length, 0); a.requested();
  a.start('entra', 'docs'); a.requested(); a.start('saml', 'docs'); a.requested(); a.finish('ask_ai');
  assert.deepEqual(find('finished').map(e => e.props.reason), ['filter_changed', 'query_changed', 'ask_ai']);
  assert.ok(find('finished').every(e => e.props.results_shown === false));
});

test('pagination captures only newly displayed results and stale renders are ignored', async () => {
  const {analytics: a, find} = await fixture();
  a.open(); a.start('sso', 'all');
  const id = a.ready({results: Array.from({length: 60}, (_, i) => ({...result, url: `/docs/${i}`, originalRank: 60 - i}))}, 'jev');
  a.shown(id, 25); a.shown(id, 50); a.shown(id, 50);
  assert.equal(find('results_shown')[0].props.impressions.length, 25);
  assert.equal(find('results_expanded').length, 1);
  assert.equal(find('results_expanded')[0].props.impressions[0].rank, 26);
  a.start('other', 'all'); a.shown(id, 60);
  assert.equal(find('results_expanded').length, 1);
});

test('zero results, fallbacks, errors, and no-selection exits remain distinct', async () => {
  const {analytics: a, find} = await fixture();
  a.open(); a.start('missing', 'docs');
  const id = a.ready({results: [], clientMetrics: {fallback_status: 503, cache_source: 'none'}}, 'local');
  a.shown(id, 25); a.shown(id, 25); a.close('page_exit');
  assert.equal(find('results_shown').length, 1);
  assert.equal(find('results_shown')[0].props.no_results, true);
  assert.equal(find('results_shown')[0].props.ranking, 'local');
  assert.equal(find('results_shown')[0].props.fallback_status, 503);
  assert.equal(find('finished')[0].props.selected, false);
  a.open(); a.start('unavailable', 'docs'); a.failed({fallback_status: 502}); a.close();
  assert.equal(find('failed').length, 1); assert.equal(find('finished').at(-1).props.ranking, 'failed');
});

test('browser cache hits do not attribute previous model timing or cost to the new search', async () => {
  const {analytics: a, find} = await fixture();
  a.open(); a.start('entra', 'all');
  a.shown(a.ready({results: [result], costUsd: 0, elapsedMs: 0,
    clientMetrics: {cache_source: 'browser'}, timingsMs: {gateway: 900}}, 'jev'), 25);
  const props = find('results_shown')[0].props;
  assert.equal(props.gateway_ms, 0); assert.equal(props.cost_usd, 0); assert.equal(props.cache_source, 'browser');
});

test('context cutoffs distinguish omitted results from errors on a new request or cache hit', async () => {
  const {analytics: a, find} = await fixture();
  a.open();
  for (const cache_source of ['none', 'server', 'browser']) {
    a.start('entra', 'all');
    a.shown(a.ready({results: [result], candidateCount: 100, contextLimited: true, omittedCandidateCount: 99,
      contextLimitErrors: 3, clientMetrics: {cache_source}}, 'jev'), 25);
  }
  const events = find('results_shown').map(e => e.props);
  assert.ok(events.every(e => e.context_limited && e.omitted_candidate_count === 99 && e.candidate_count === 100 && e.result_count === 1));
  assert.deepEqual(events.map(e => e.context_limit_errors), [3, 0, 0]);
});

test('analytics redact common credentials and email addresses without recording error text', async () => {
  const {analytics: a, events} = await fixture();
  a.open(); a.start('owner@example.com sk-abcdefghijklm Bearer private-secret', 'all'); a.requested();
  a.failed({fallback_status: 502}); a.close();
  const payload = JSON.stringify(events);
  assert.doesNotMatch(payload, /owner@example.com|abcdefghijklm|private-secret/);
  assert.match(payload, /query_redacted":true/);
});

test('a failed analytics SDK never interrupts search interactions', async () => {
  const {SearchAnalytics} = await import('./search-analytics.mjs');
  const a = new SearchAnalytics({capture: () => {throw new Error('blocked');}, id: () => 'id'});
  a.open(); a.start('entra', 'all'); a.requested();
  a.shown(a.ready({results: [result]}, 'jev'), 25); a.select(0, 'mouse'); a.close();
});
