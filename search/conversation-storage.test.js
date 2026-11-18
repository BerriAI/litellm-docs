const {test} = require('node:test');
const assert = require('node:assert/strict');

test('saved conversations survive tracing removal without persisting legacy trace context', async t => {
  const key = 'litellm-docs-ask-ai';
  const turns = [{question: 'How do I configure caching?', answer: 'Use Redis [1].',
    sources: [{id: 1, title: 'Caching', url: '/docs/proxy/caching'}]}];
  const data = new Map([[key, JSON.stringify({open: true, turns, traceContext: 'legacy-trace-reference'})]]);
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
  assert.deepEqual(restored, {open: true, turns});
  await saveConversation({...restored, traceContext: 'legacy-trace-reference'});
  const saved = JSON.parse(data.get(key));
  assert.deepEqual(saved.turns, turns);
  assert.equal(saved.traceContext, undefined);
  assert.deepEqual(await readConversation(), restored);
});
