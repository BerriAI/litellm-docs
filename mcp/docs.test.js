const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createDocsTools, parseDocUrl} = require('./docs');
const {headingIndex} = require('../plugins/mcp-manifest');

// A tiny build directory: two pages, nav, an OpenAPI spec, and a secret file
// next to it that must never be readable.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-docs-'));
const build = path.join(dir, 'build');
const write = (rel, data) => {
  fs.mkdirSync(path.dirname(path.join(build, rel)), {recursive: true});
  fs.writeFileSync(path.join(build, rel), data);
};
const long = `# Config\n\nIntro text.\n\n## General settings\n\n${'general line\n'.repeat(4000)}\n## Router settings\n\nrouter text\n`;
const short = '---\ntitle: "Logging"\n---\n# Logging\n\nLog to many places.\n\n## Langfuse\n\nSet LANGFUSE_PUBLIC_KEY.\n\n## Datadog\n\nSet DD_API_KEY.\n';
write('docs/proxy/config_settings.md', long);
write('docs/proxy/logging.md', short);
write('mcp-pages.json', JSON.stringify({version: 1, pages: [
  {url: '/docs/proxy/config_settings', md: 'docs/proxy/config_settings.md', title: 'Config', type: 'docs', length: long.length, headings: headingIndex(long)},
  {url: '/docs/proxy/logging', md: 'docs/proxy/logging.md', title: 'Logging', type: 'docs', length: short.length, headings: headingIndex(short)},
]}));
write('mcp-nav.json', JSON.stringify({version: 1, sidebars: {tutorialSidebar: [
  {title: 'Proxy', items: [{title: 'Logging', url: '/docs/proxy/logging', items: [{title: 'Langfuse', url: '/docs/proxy/logging#langfuse'}]}, {title: 'Config', url: '/docs/proxy/config_settings'}]},
  {title: 'SDK', items: [{title: 'Logging', items: [{title: 'Callbacks', url: '/docs/observability/callbacks'}]}]},
]}}));
write('openapi.json', JSON.stringify({openapi: '3.1.0', paths: {
  '/v1/chat/completions': {post: {operationId: 'chat_completion', tags: ['chat'], summary: 'Chat',
    requestBody: {content: {'application/json': {schema: {$ref: '#/components/schemas/ChatRequest'}}}}, responses: {200: {description: 'OK'}}}},
  '/key/generate': {post: {operationId: 'generate_key', tags: ['keys'], summary: 'Make a key', parameters: [{name: 'x', in: 'header', required: true, schema: {type: 'string'}}], responses: {200: {description: 'OK'}}}},
}, components: {schemas: {ChatRequest: {type: 'object', properties: {model: {type: 'string'}}}}}}));
fs.writeFileSync(path.join(dir, 'secret.md'), 'TOP SECRET');

const tools = Object.fromEntries(createDocsTools({buildDir: build}).map((t) => [t.name, t]));
const call = (name, args) => tools[name].handler(args);
const out = (result) => result.content[0].text;

test('URLs, paths, .md links and fragments resolve to permalinks on docs.litellm.ai only', () => {
  assert.deepEqual(parseDocUrl('https://docs.litellm.ai/docs/proxy/logging.md#langfuse').fragment, 'langfuse');
  assert.ok(parseDocUrl('proxy/logging').candidates.includes('/docs/proxy/logging'));
  assert.ok(parseDocUrl('/docs/proxy/logging/').candidates.includes('/docs/proxy/logging'));
  assert.match(parseDocUrl('https://evil.example/docs/proxy/logging').error, /Only/);
  assert.equal(parseDocUrl('/api-reference/#/chat/chat_completion').api, '/api-reference/#/chat/chat_completion');
});

test('get_litellm_doc reads a page, a section, and refuses anything off the index', async () => {
  const page = out(await call('get_litellm_doc', {url: '/docs/proxy/logging'}));
  assert.match(page, /^Source: https:\/\/docs\.litellm\.ai\/docs\/proxy\/logging\n/);
  assert.match(page, /DD_API_KEY/);
  const section = out(await call('get_litellm_doc', {url: 'https://docs.litellm.ai/docs/proxy/logging#langfuse'}));
  assert.match(section, /LANGFUSE_PUBLIC_KEY/);
  assert.doesNotMatch(section, /DD_API_KEY/);
  assert.match(out(await call('get_litellm_doc', {url: '/docs/proxy/logging', section: 'Datadog'})), /DD_API_KEY/);
  assert.equal((await call('get_litellm_doc', {url: '/docs/proxy/logging', section: 'nope'})).isError, true);
  for (const url of ['../secret', '/docs/../../secret', '%2e%2e/secret.md', '/docs/proxy/..%2f..%2f..%2fsecret', 'file:///etc/passwd', '/mcp-pages.json']) {
    const result = await call('get_litellm_doc', {url});
    assert.equal(result.isError, true, url);
    assert.doesNotMatch(out(result), /TOP SECRET/, url);
  }
});

test('long pages return their introduction and outline, then read in sections or parts', async () => {
  const overview = out(await call('get_litellm_doc', {url: '/docs/proxy/config_settings'}));
  assert.match(overview, /Intro text/);
  assert.match(overview, /- General settings \(section: "general-settings"/);
  assert.ok(overview.length < 10000);
  const part = out(await call('get_litellm_doc', {url: '/docs/proxy/config_settings', section: 'general-settings'}));
  const next = Number(/offset=(\d+)/.exec(part)[1]);
  assert.ok(part.length <= 41000 && next > 0);
  assert.match(part, /Call again with section="general-settings" and offset=\d+/);
  const rest = out(await call('get_litellm_doc', {url: '/docs/proxy/config_settings', section: 'general-settings', offset: next}));
  assert.equal((await call('get_litellm_doc', {url: '/docs/proxy/logging', offset: 999999})).isError, true);
  assert.doesNotMatch(rest, /Router settings/);
  const router = out(await call('get_litellm_doc', {url: '/docs/proxy/config_settings', section: 'router-settings'}));
  assert.match(router, /router text/);
});

test('navigation lists sections and finds subtrees by path, title or URL', async () => {
  // The top level is one level deep whatever depth is asked for.
  assert.match(out(await call('get_litellm_docs_navigation', {depth: 4})), /## Docs\n\n- Proxy \(2 more\)\n- SDK \(1 more\)$/);
  // A title used twice resolves to the shallowest match and names the other.
  const logging = out(await call('get_litellm_docs_navigation', {section: 'Logging', depth: 1}));
  assert.match(logging, /^Proxy > Logging \(https:\/\/docs\.litellm\.ai\/docs\/proxy\/logging\)/);
  assert.match(logging, /Other sections with this title: "SDK > Logging"/);
  assert.match(out(await call('get_litellm_docs_navigation', {section: 'SDK > Logging', depth: 1})), /Callbacks/);
  assert.match(out(await call('get_litellm_docs_navigation', {section: 'Proxy > Logging', depth: 2})), /Langfuse/);
  assert.match(out(await call('get_litellm_docs_navigation', {section: 'https://docs.litellm.ai/docs/proxy/logging', depth: 1})), /Langfuse/);
  assert.equal((await call('get_litellm_docs_navigation', {section: 'Nothing', depth: 2})).isError, true);
});

test('API endpoints resolve by method and path, operationId, or reference URL', async () => {
  const chat = out(await call('get_litellm_api_endpoint', {endpoint: 'POST /v1/chat/completions'}));
  assert.match(chat, /## POST \/v1\/chat\/completions/);
  assert.match(chat, /#\/components\/schemas\/ChatRequest/);
  assert.match(out(await call('get_litellm_api_endpoint', {endpoint: 'generate_key'})), /`x` \(header, required, string\)/);
  assert.match(out(await call('get_litellm_api_endpoint', {endpoint: 'https://docs.litellm.ai/api-reference/#/keys/generate_key'})), /Make a key/);
  const missing = await call('get_litellm_api_endpoint', {endpoint: '/chat'});
  assert.equal(missing.isError, true);
  assert.match(out(missing), /POST \/v1\/chat\/completions/);
});
