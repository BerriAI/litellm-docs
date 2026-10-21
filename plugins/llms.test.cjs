const test = require('node:test');
const assert = require('node:assert/strict');
const {mdxToMarkdown} = require('./llms');

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
    '<SinceVersion />',
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
    ].join('\n'),
  );
});
