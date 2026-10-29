const test = require('node:test');
const assert = require('node:assert/strict');
const {mdxToMarkdown} = require('./llms');
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
