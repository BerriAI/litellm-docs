const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createToolAnswerReader, parseToolAnswer} = require('./tool-answer');

for (const raw of [
  JSON.stringify({answer: 'Quotes "hello", slash /, backslash \\, newline\n, tab\t, 中文 café and 🙂 [3]'}),
  '{ "answer" : "Escaped \\u4e2d\\u6587 \\ud83d\\ude42 \\/ \\b \\f \\r" }',
  '{"\\u0061nswer":"Escaped key"}',
]) {
  test(`answer decoding survives every split: ${raw.slice(0, 30)}`, () => {
    const expected = parseToolAnswer(raw);
    for (let boundary = 0; boundary <= raw.length; boundary++) {
      const reader = createToolAnswerReader();
      let visible = reader.push(raw.slice(0, boundary));
      assert.ok(!/[\uD800-\uDBFF]$/.test(visible), 'Do not split surrogate pairs');
      visible += reader.push(raw.slice(boundary));
      const final = reader.finish();
      visible += final.slice(reader.emittedLength);
      assert.equal(visible, expected);
    }
    const reader = createToolAnswerReader();
    let visible = '';
    for (const char of raw.split('')) visible += reader.push(char);
    visible += reader.finish().slice(reader.emittedLength);
    assert.equal(visible, expected);
  });
}

test('invalid, duplicate, missing and truncated answer arguments fail validation', () => {
  for (const raw of ['null', '[]', '{}', '{"answer":7}', '{"answer":" "}',
    '{"answer":"ok","extra":true}', '{"answer":"old","answer":"new"}',
    '{"answer":"cut', '{"answer":"bad\\q"}', '{"answer":"bad\n"}',
    '{"answer":"bad\\u00xx"}', '{"answer":"ok"} trailing']) {
    const reader = createToolAnswerReader();
    assert.throws(() => {reader.push(raw); reader.finish();});
  }
});
