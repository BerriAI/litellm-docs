const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const remarkDocsModels = require('../src/remark/docs-models');
const defaults = require('../docs-models.json');

test('ChatGPT Python, YAML and inline examples use shared defaults', () => {
  const source = fs.readFileSync(path.join(__dirname, '../docs/providers/chatgpt.md'), 'utf8');
  const rendered = remarkDocsModels.substitute(source);
  assert.match(source, /chatgpt\/\{\{chatgpt\}\}/);
  assert.match(source, /chatgpt\/\{\{chatgpt_small\}\}/);
  assert.ok(rendered.includes('chatgpt/' + defaults.chatgpt));
  assert.ok(rendered.includes('chatgpt/' + defaults.chatgpt_small));
  assert.doesNotMatch(rendered, /\{\{chatgpt|gpt-5\.3|gpt-5\.4/);
});

test('remark plugin fills code, inline code and MDX expressions', () => {
  const tree = {type: 'root', children: [
    {type: 'code', value: 'model: chatgpt/{{chatgpt}}'},
    {type: 'paragraph', children: [{type: 'inlineCode', value: 'chatgpt/{{chatgpt_small}}'}]},
    {type: 'mdxFlowExpression', value: '{chatgpt}'},
  ]};
  remarkDocsModels()(tree);
  assert.equal(tree.children[0].value, 'model: chatgpt/' + defaults.chatgpt);
  assert.equal(tree.children[1].children[0].value, 'chatgpt/' + defaults.chatgpt_small);
  assert.deepEqual(tree.children[2], {type: 'paragraph', children: [{type: 'text', value: defaults.chatgpt}]});
});

test('copy-as-markdown includes resolved ChatGPT defaults', () => {
  const rawMarkdown = require('../src/remark/raw-markdown');
  const vfile = {value: 'model: chatgpt/{{chatgpt}}', data: {}};
  rawMarkdown()({}, vfile);
  assert.equal(Buffer.from(vfile.data.frontMatter.rawMarkdownB64, 'base64').toString(), 'model: chatgpt/' + defaults.chatgpt);
});

test('unrelated prompt placeholders are not expanded', () => {
  assert.equal(remarkDocsModels.substitute('{{user_input}}'), '{{user_input}}');
});
