const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createIndex, loadIndex, search, snippet} = require('./engine');
const {extractSections} = require('../plugins/docs-search');

const docs = [
  {id: 'lens', title: 'LiteLLM Lens', heading: 'Set up analysis', url: '/docs/proxy/lens#setup', text: 'Lens investigates agent traces. Enable tracing with ClickHouse and PostgreSQL.', snippet: 'Investigate agent traces.'},
  {id: 'edits', title: '/images/edits', heading: 'Size limits', url: '/docs/image_edits', text: 'Images must be less than 4MB. Use the same dimensions as the image.', snippet: 'Edit images.'},
  {id: 'config', title: 'Configuration', heading: 'Lens', url: '/docs/proxy/config#lens', text: 'CLICKHOUSE_URL enables the trace store used by Lens.', snippet: 'Configure tracing.'},
  {id: 'cache', title: 'Caching', heading: 'Redis caching', url: '/docs/proxy/caching#redis', text: 'Enable caching by setting cache to true and configure Redis.', snippet: 'Enable response caching.'},
];
const index = createIndex(docs);

test('Swagger heading links survive extraction as validated first-party citation targets', () => {
  const html = '<article class="theme-doc-markdown"><h1>Quick Start</h1><h2 id="swagger">Endpoints: <a href="https://docs.litellm.ai/api-reference/">Swagger Docs</a></h2><p>Available endpoints. <a href="https://evil.example/">Ignore</a></p></article>';
  const extracted = extractSections(html, '/docs/proxy/quick_start');
  assert.deepEqual(extracted[0].links, [{url: '/api-reference/', title: 'Swagger Docs'}]);
});

test('VS Code aliases preserve the editor name while ordinary comparisons still work', () => {
  const corpus = createIndex([
    {id: 'editor', title: 'GitHub Copilot / VS Code', heading: 'LiteLLM extension', url: '/docs/tutorials/github_copilot_integration', text: 'Install the VS Code extension.'},
    {id: 'cli', title: 'Codex CLI', heading: '', url: '/docs/codex', text: 'Use the coding agent in a terminal.'},
  ]);
  for (const query of ['VS Code', 'vs code', 'vscode', 'Visual Studio Code', 'VS Code extension']) {
    assert.equal(search(corpus, query)[0].id, '/docs/tutorials/github_copilot_integration', query);
  }
  assert.ok(search(corpus, 'compare Codex versus VS Code').length);
});

test('a fuzzy title cannot erase a feature/provider query with exact passage evidence', () => {
  const corpus = createIndex([
    {id: 'decision', title: '/v1/decisions and /v1/systemone', url: '/docs/decisions',
      text: 'Decision models on vllm use hosted_vllm with choice questions.'},
    {id: 'vision', title: 'Decision Model VLM', url: '/docs/vision', text: 'Use a vision model.'},
    {id: 'models', title: 'Models', url: '/docs/models', text: 'Every model.'},
  ]);
  const results = search(corpus, 'decision model vllm');
  assert.equal(results[0].url, '/docs/decisions');
  assert.ok(!results.some(hit => hit.url === '/docs/models'));
});

test('generic documentation wording preserves the Swagger topic', () => {
  const corpus = createIndex([
    {id: 'swagger', title: 'Admin UI', heading: 'Swagger', url: '/docs/proxy/ui#swagger',
      text: 'Your proxy Swagger UI is available on the root of the proxy.'},
    {id: 'noise', title: 'Page Visibility', url: '/docs/proxy/page_visibility',
      text: 'Set page visibility on the proxy UI docs page.'},
  ]);
  assert.equal(search(corpus, 'LiteLLM proxy Swagger UI docs page')[0].url, '/docs/proxy/ui#swagger');
});

test('excerpts show a relevant match far into a section', () => {
  const result = snippet('Introductory filler. '.repeat(50) + 'Set CLICKHOUSE_URL to enable the trace store. More detail. ', ['clickhouse_url']);
  assert.match(result, /CLICKHOUSE_URL/);
  assert.ok(result.length <= 212);
});
test('prototype property names can be indexed and searched', () => {
  const sample = createIndex([{...docs[0], text: 'constructor prototype toString'}]);
  assert.equal(search(sample, 'constructor')[0].title, 'LiteLLM Lens');
});
test('serialization preserves rankings', () => {
  assert.deepEqual(search(loadIndex(JSON.stringify(index)), 'lens'), search(index, 'lens'));
});
test('topic guides outrank incidental mentions across plural and separator variants', () => {
  const documents = [
    {id: 'customers', title: 'Customers / End-Users', heading: '', url: '/docs/proxy/customers',
      text: 'Track spend, set budgets and permissions for your customers.'},
    {id: 'organizations', title: 'Organizations', heading: '', url: '/docs/proxy/organizations',
      text: 'Manage access across your company.'},
    {id: 'metrics', title: 'Metrics', heading: 'End user budget and organization tracking',
      url: '/docs/metrics#tracking', text: 'Track every end user and organization with metrics.'},
  ];
  for (const index of [createIndex(documents), loadIndex(JSON.stringify(createIndex(documents)))]) {
    for (const query of ['end user', 'end users', 'end-user', 'end-users', 'end_user', 'end_users',
      'enduser', 'endusers', 'endUser', 'END_USERS']) {
      assert.equal(search(index, query)[0].url, '/docs/proxy/customers', query);
      assert.equal(search(index, query, {groupPages: false})[0].id, 'customers', query);
    }
    for (const query of ['organization', 'organizations']) {
      assert.equal(search(index, query)[0].url, '/docs/proxy/organizations', query);
    }
  }
});
test('an exact body mention does not hide a matching title prefix', () => {
  const index = createIndex([
    {id: 'organizations', title: 'Organizations', heading: '', url: '/docs/organizations', text: 'Manage access.'},
    {id: 'logging', title: 'Logging', heading: '', url: '/docs/logging', text: 'The log abbreviation is organ.'},
  ]);
  assert.equal(search(index, 'organ')[0].url, '/docs/organizations');
});
test('prefix aliases do not dilute exact title matches or change their destination', () => {
  const index = createIndex([
    {id: 'azure', title: 'Azure OpenAI', heading: 'Authentication', url: '/docs/providers/azure#authentication',
      text: 'Configure Azure OpenAI authentication.'},
    {id: 'logging', title: 'Logging', heading: 'Azure', url: '/docs/logging#azure',
      text: 'Use Azure for logging.'},
  ]);
  for (const query of ['azure', 'azur', 'azure openai', 'azure_openai', 'azureopenai']) {
    assert.equal(search(index, query)[0].url, '/docs/providers/azure', query);
  }
});
test('a fuzzy match to a title stop word cannot invalidate scores or invent a title match', () => {
  const index = createIndex([
    {id: 'article', title: 'Review and revise', heading: 'End user improvements',
      url: '/blog/review#improvements', type: 'blog', text: 'Track usage.'},
  ]);
  const [result] = search(index, 'end usre', {type: 'blog'});
  assert.ok(result && Number.isFinite(result.score));
  assert.equal(result.url, '/blog/review#improvements');
  assert.equal(result.heading, 'End user improvements');
});
test('short names and transposed typos keep enough letters for matching', () => {
  const index = createIndex([docs[0]]);
  for (const query of ['lens', 'lnes']) {
    const [result] = search(index, query);
    assert.equal(result?.url, '/docs/proxy/lens', query);
    assert.ok(Number.isFinite(result.score));
  }
});
test('joined title aliases preserve plurals inside a compound query', () => {
  const index = createIndex([
    {id: 'responses', title: 'Responses API', heading: 'Parameters', url: '/docs/responses#parameters',
      text: 'Send requests to the model.'},
  ]);
  for (const query of ['responses api', 'response api', 'responses_api', 'responsesapi', 'responseapi']) {
    assert.equal(search(index, query)[0]?.url, '/docs/responses', query);
  }
});
test('planner-added AI Gateway wording preserves specific subscription matches', () => {
  const index = createIndex([
    {id: 'codex', title: 'ChatGPT Subscription', heading: 'Authentication', url: '/docs/providers/chatgpt',
      text: 'Use a ChatGPT subscription that includes Codex through LiteLLM with OAuth device flow authentication.'},
    {id: 'harness', title: 'LiteLLM AI Gateway with Claude Code and Codex', heading: '', url: '/blog/harness', type: 'blog',
      text: 'Route harness requests through the LiteLLM AI Gateway.'},
    {id: 'claude', title: 'Claude Code with a Claude Subscription', heading: '', url: '/docs/tutorials/claude',
      text: 'Use a Claude subscription with LiteLLM AI Gateway.'},
  ]);
  for (const query of ['Codex subscription', 'LiteLLM AI Gateway with Codex subscription setup',
    'LiteLLM Codex subscription gateway setup', 'Codex subscriptions']) {
    assert.equal(search(index, query, {intent: 'setup'})[0].url, '/docs/providers/chatgpt');
  }
  assert.ok(search(index, 'LiteLLM AI Gateway').length);
});
test('rendered docs preserve actual heading anchors, code, and exclude page furniture', () => {
  const html = '<nav>Secret nav noise</nav><article><div class="theme-doc-markdown"><h1>Lens</h1><p>Investigations</p><h2 id="custom-anchor">Set up<a class="hash-link">#</a></h2><pre><code>cache: true\nredis: localhost</code><button>Copy</button></pre><ul><li>Enable tracing</li></ul></div></article><footer>Footer noise</footer>';
  const sections = extractSections(html, '/docs/lens');
  assert.equal(sections[1].url, '/docs/lens#custom-anchor');
  assert.match(sections[1].text, /cache: true\nredis: localhost/);
  assert.match(sections[1].text, /Enable tracing/);
  assert.doesNotMatch(JSON.stringify(sections), /Secret nav|Footer noise|Copy/);
  assert.deepEqual(extractSections('<meta name="robots" content="noindex">' + html, '/docs/private'), []);
});
test('rendered Prism line breaks preserve runnable code in retrieved passages', () => {
  const html = '<div class="theme-doc-markdown"><h1>Setup</h1><pre><code><span>general_settings:<br></span><span>  tracing:<br></span><span>    store: clickhouse<br></span></code></pre></div>';
  assert.equal(extractSections(html, '/docs/setup')[0].text, 'general_settings:\n  tracing:\n    store: clickhouse');
});
