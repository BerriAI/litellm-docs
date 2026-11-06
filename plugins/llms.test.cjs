const test = require('node:test');
const assert = require('node:assert/strict');
const {mdxToMarkdown, endpointIndexMarkdown, passThroughIndexMarkdown, setEndpointIndex} = require('./llms');
const remarkRawMarkdown = require('../src/remark/raw-markdown');

test('version badges become plain text in the markdown export', () => {
  const page = [
    '# Reasoning',
    '',
    '<SinceVersion v="1.63.0" />',
    '',
    'Set it to keep IDs out. <SinceVersion v="v1.87.0" />',
    '',
    "| Versions | <SinceVersion v={'1.63.8'} /> |",
    '',
    'Requires the SDK 1.1.0 {/* keep-version-note */}',
    '',
    'Needs Python 3.11 or later. {/* keep-python-version: the integration needs it */}',
    '',
    '<SinceVersion />',
    '',
    '```jsx',
    '<SinceVersion v="1.85.0" />',
    '{/* keep-version-note */}',
    '```',
  ].join('\n');
  assert.equal(
    mdxToMarkdown(page),
    [
      '# Reasoning',
      '',
      'Available in LiteLLM v1.63.0 and later.',
      '',
      'Set it to keep IDs out. (since LiteLLM v1.87.0)',
      '',
      '| Versions | (since LiteLLM v1.63.8) |',
      '',
      'Requires the SDK 1.1.0',
      '',
      'Needs Python 3.11 or later.',
      '',
      '```jsx',
      '<SinceVersion v="1.85.0" />',
      '{/* keep-version-note */}',
      '```',
      '',
    ].join('\n'),
  );
});

test('copy page gives the same version text as the markdown export', () => {
  const page = [
    '# Reasoning',
    '',
    '<SinceVersion v="1.63.0" />',
    '',
    'Set it to keep IDs out. <SinceVersion v="v1.87.0" />',
    '',
    'Requires the SDK 1.1.0 {/* keep-version-note */}',
    '',
    'Needs Python 3.11 or later. {/* keep-python-version: the integration needs it */}',
  ].join('\n');
  const file = {value: page, data: {}};
  remarkRawMarkdown()(null, file);
  assert.equal(
    Buffer.from(file.data.frontMatter.rawMarkdownB64, 'base64').toString(),
    [
      '# Reasoning',
      '',
      'Available in LiteLLM v1.63.0 and later.',
      '',
      'Set it to keep IDs out. (since LiteLLM v1.87.0)',
      '',
      'Requires the SDK 1.1.0',
      '',
      'Needs Python 3.11 or later.',
    ].join('\n'),
  );
});

test('endpoint catalog and flow become markdown in the export', () => {
  const byId = new Map([
    ['completion/input', {permalink: '/docs/completion/input'}],
    ['pass_through/intro', {permalink: '/docs/pass_through/intro'}],
    ['pass_through/anthropic_completion', {permalink: '/docs/pass_through/anthropic_completion'}],
  ]);
  const md = endpointIndexMarkdown(
    {
      CATEGORIES: [{id: 'chat', label: 'Chat and responses', blurb: 'Send messages to a model.'}],
      ENDPOINTS: [
        {id: 'chat_completions', name: 'Chat Completions', method: 'POST', path: '/v1/chat/completions', description: 'Chat with any model.', category: 'chat', doc: 'completion/input'},
      ],
      PASS_THROUGH: [{label: 'Anthropic', doc: 'pass_through/anthropic_completion'}],
      PASS_THROUGH_INTRO: 'pass_through/intro',
    },
    byId,
  );
  assert.match(md, /### Chat and responses/);
  assert.match(md, /- \[Chat Completions\]\(https:\/\/docs\.litellm\.ai\/docs\/completion\/input\.md\) \(`POST \/v1\/chat\/completions`\): Chat with any model\./);
  const pass = passThroughIndexMarkdown({PASS_THROUGH: [{label: 'Anthropic', doc: 'pass_through/anthropic_completion'}]}, byId);
  assert.match(pass, /- \[Anthropic\]\(https:\/\/docs\.litellm\.ai\/docs\/pass_through\/anthropic_completion\.md\)/);
  setEndpointIndex(md);
  const out = mdxToMarkdown('# Supported Endpoints\n\n<EndpointPaths />\n\n## All endpoints {#all-endpoints}\n\n<EndpointCatalog />\n');
  assert.match(out, /- Translated: /);
  assert.match(out, /### Chat and responses/);
  assert.doesNotMatch(out, /<Endpoint/);
});
