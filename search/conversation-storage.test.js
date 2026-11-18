const {test} = require('node:test');
const assert = require('node:assert/strict');

test('saved conversations preserve the trace reference for follow-ups', async t => {
  const key = 'litellm-docs-ask-ai';
  const turns = [{question: 'How do I configure caching?', answer: 'Use Redis [1].',
    sources: [{id: 1, title: 'Caching', url: '/docs/proxy/caching'}]}];
  const traceContext = `${'a'.repeat(32)}.${'b'.repeat(16)}.${'c'.repeat(43)}`;
  const data = new Map([[key, JSON.stringify({open: true, turns, traceContext})]]);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else delete globalThis.window;
  });
  globalThis.window = {sessionStorage: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  }};
  const {readConversation, saveConversation} = await import('./conversation-storage.mjs');
  const restored = await readConversation();
  assert.deepEqual(restored, {open: true, turns, traceContext});
  await saveConversation(restored);
  const saved = JSON.parse(data.get(key));
  assert.deepEqual(saved.turns, turns);
  assert.equal(saved.traceContext, traceContext);
  assert.deepEqual(await readConversation(), restored);
});
