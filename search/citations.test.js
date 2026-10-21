const {test} = require('node:test');
const assert = require('node:assert/strict');

test('citations exclude inline, fenced, and indented code, HTML, and authored links', async () => {
  const {mapCitations} = await import('./citations.mjs');
  const answer = 'Use `choices[0]` and ``array[1]``. [2]\n\n```python\nprint(response.choices[0])\n```\n\n    ids = [4]\n\n<div>\n[5]\n</div>\n\n[6](/docs/test)';
  const ids = [];
  const linked = mapCitations(answer, (id, text) => {ids.push(id); return `${text}(/docs/source)`;});
  assert.deepEqual(ids, [2]);
  assert.equal(linked, answer.replace('[2]', '[2](/docs/source)'));
});
