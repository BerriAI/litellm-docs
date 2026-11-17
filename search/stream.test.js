const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {createModelCaller} = require('./gateway');
const {createAskHandler} = require('./api');
const {createIndex} = require('./engine');
const {getTracing} = require('./tracing');
const {OTLPTraceExporter} = require('@opentelemetry/exporter-trace-otlp-proto');

const config = {apiKey: 'stream-test-secret', baseUrl: 'https://gateway.example.com', publicAIEnabled: true, origin: 'https://docs.example.com'};
const encoder = new TextEncoder();
const frame = data => `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;
const chunk = (delta, finish_reason = null, extra = {}) => ({id: 'stream-id', model: 'actual-model', choices: [{index: 0, delta, finish_reason}], ...extra});
function streamResponse(text, size = 1) {
  const bytes = encoder.encode(text);
  return new Response(new ReadableStream({start(controller) {
    for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
    controller.close();
  }}), {headers: {'Content-Type': 'text/event-stream'}});
}

test('SSE framing handles split UTF-8, CRLF, comments and multiline data', async () => {
  const {readEvents} = await import('./stream.mjs');
  const response = streamResponse(': keepalive\r\nevent: answer-delta\r\ndata: 中文\r\ndata: café\r\n\r\nevent: done\ndata: {}\n\n');
  const events = [];
  for await (const event of readEvents(response.body)) events.push(event);
  assert.deepEqual(events, [{event: 'answer-delta', data: '中文\ncafé'}, {event: 'done', data: '{}'}]);
});

test('gateway emits answer text before upstream completion and keeps uncapped requests', async () => {
  let upstream, finish, early;
  const earlyDelta = new Promise(resolve => {early = resolve;});
  const call = createModelCaller({config, fetchImpl: async (_url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.stream, true);
    assert.deepEqual(body.stream_options, {include_usage: true});
    assert.equal(body.max_tokens, undefined); assert.equal(body.max_completion_tokens, undefined);
    return new Response(new ReadableStream({start(controller) {upstream = controller;}}), {headers: {'Content-Type': 'text/event-stream'}});
  }});
  let complete = false, received = '';
  const pending = call.turn([{role: 'user', content: 'Question'}], {onDelta: text => {received += text; early();}})
    .then(result => {complete = true; return result;});
  while (!upstream) await new Promise(resolve => setImmediate(resolve));
  upstream.enqueue(encoder.encode(frame(chunk({content: 'This first sentence arrives before the model finishes. '}))));
  await earlyDelta;
  assert.equal(complete, false); assert.ok(received.startsWith('This first sentence'));
  upstream.enqueue(encoder.encode(frame(chunk({content: 'Done.'}, 'stop')) + frame('[DONE]'))); upstream.close();
  const result = await pending;
  assert.equal(result.content, received);
});

test('reasoning deltas are not displayed in the final answer stream', async () => {
  const content = frame(chunk({reasoning_content: 'private reasoning'})) +
    frame(chunk({content: 'Final answer'}, 'stop')) + frame('[DONE]');
  let visible = '';
  const call = createModelCaller({config, fetchImpl: async () => streamResponse(content, 3)});
  await call.turn([], {onDelta: text => {visible += text;}});
  assert.equal(visible, 'Final answer');
});

test('truncated, incomplete, malformed and error streams cannot become completed answers', async () => {
  for (const content of [
    frame(chunk({content: 'partial'}, 'length')) + frame('[DONE]'),
    frame(chunk({content: 'partial'}, 'stop')),
    frame(chunk({content: 'partial'})) + frame('[DONE]'),
    frame('{broken') + frame('[DONE]'),
    frame({error: {message: 'provider error'}}),
  ]) {
    const call = createModelCaller({config, fetchImpl: async () => streamResponse(content)});
    await assert.rejects(call.turn([], {onDelta() {}}));
  }
});

test('configured credentials split across deltas never reach the browser', async () => {
  const content = frame(chunk({content: 'Answer: stream-test-'})) + frame(chunk({content: 'secret'}, 'stop')) + frame('[DONE]');
  let visible = '';
  const call = createModelCaller({config, fetchImpl: async () => streamResponse(content)});
  await assert.rejects(call.turn([], {onDelta: text => {visible += text;}}), {name: 'GatewayInvalidResponse'});
  assert.ok(!visible.includes(config.apiKey));
  assert.ok(!visible.includes('stream-test-'));
});

test('browser requires a done event and preserves citation numbering in the final result', async () => {
  const {readAnswer} = await import('./stream.mjs');
  const events = [];
  const completed = 'event: answer-delta\ndata: {"text":"Answer [7]"}\n\nevent: done\ndata: {"answer":"Answer [7]","sources":[{"id":7,"url":"/docs/decisions"}]}\n\n';
  const result = await readAnswer(streamResponse(completed), (event, data) => events.push({event, data}));
  assert.equal(events[0].data.text, 'Answer [7]');
  assert.equal(result.answer, 'Answer [7]');
  await assert.rejects(readAnswer(streamResponse('event: answer-delta\ndata: {"text":"partial"}\n\n'), () => {}), /interrupted/);
  await assert.rejects(readAnswer(streamResponse('event: error\ndata: {"error":"Please retry"}\n\n'), () => {}), /Please retry/);
});

test('streaming API sends terminal errors after partial output instead of a second HTTP response', async () => {
  const index = createIndex([{id: 'a', title: 'Test', url: '/docs/test', text: 'Test'}]);
  const handler = createAskHandler({index, documents: new Map(), config,
    fetchImpl: async (_url, request) => JSON.parse(request.body).tools
      ? Response.json({choices: [{finish_reason: 'tool_calls', message: {content: null, tool_calls: [{id: 'finish', type: 'function', function: {name: 'finish_research', arguments: '{}'}}]}}]})
      : streamResponse(frame(chunk({content: 'Some provisional output that arrives before a failure.'}))) });
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}`, {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'text/event-stream'}, body: JSON.stringify({question: 'Test'})});
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-transform/);
    const text = await response.text();
    assert.match(text, /event: answer-delta/); assert.match(text, /event: error/);
    assert.ok(!text.includes('event: done'));
  } finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
});

test('cancelling the browser stream aborts the active upstream call', async () => {
  let aborted;
  const upstreamAborted = new Promise(resolve => {aborted = resolve;});
  const handler = createAskHandler({index: createIndex([]), documents: new Map(), config, fetchImpl: async (_url, request) => {
    await new Promise((resolve, reject) => request.signal.addEventListener('abort', () => {aborted(); reject(request.signal.reason);}, {once: true}));
  }});
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}`, {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'text/event-stream'}, body: JSON.stringify({question: 'Test'})});
    await response.body.cancel();
    await Promise.race([upstreamAborted, new Promise((_, reject) => setTimeout(() => reject(new Error('Upstream did not abort')), 2000).unref())]);
  } finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
});

test('malformed browser events produce a retryable error', async () => {
  const {readAnswer} = await import('./stream.mjs');
  for (const [event, data] of [['answer-delta', '{bad'], ['sources', 'null'], ['sources', '{}'], ['answer-delta', '{"text":7}']]) {
    await assert.rejects(readAnswer(streamResponse(`event: ${event}\ndata: ${data}\n\n`), () => assert.fail('Invalid data delivered')), /Invalid answer response/);
  }
});

test('an interrupted upstream stream retains safe partial text in its trace', async t => {
  const spans = [];
  t.mock.method(OTLPTraceExporter.prototype, 'export', (batch, callback) => {spans.push(...batch); callback({code: 0});});
  const traced = {...config, tracing: {key: 'stream-tracing-test-secret', endpoint: 'https://tracing.example.com/v1/traces'}};
  const tracing = getTracing(traced);
  try {
    const call = createModelCaller({config: traced, fetchImpl: async () => streamResponse(frame(chunk({content: 'Partial answer'})))});
    await assert.rejects(call.turn([], {onDelta() {}}), {name: 'GatewayStreamInterrupted'});
    await tracing.flush();
    assert.equal(spans[0].attributes['output.value'], 'Partial answer');
    assert.equal(spans[0].attributes['gen_ai.response.id'], 'stream-id');
    assert.equal(spans[0].attributes['error.type'], 'GatewayStreamInterrupted');
  } finally {await tracing.shutdown();}
});

test('streaming API finishes with validated sources and a done event', async () => {
  const doc = {id: 'a', title: 'Test', url: '/docs/test', text: 'Test guidance'};
  let calls = 0;
  const handler = createAskHandler({index: createIndex([doc]), documents: new Map([[doc.id, doc]]), config,
    fetchImpl: async () => {
      calls++;
      if (calls > 3) return streamResponse(frame(chunk({content: 'Test guidance [1]'}, 'stop')) + frame('[DONE]'));
      const name = calls === 1 ? 'search_docs' : calls === 2 ? 'read_docs' : 'finish_research';
      const args = calls === 1 ? {queries: ['Test']} : calls === 2 ? {passage_ids: ['a']} : {};
      return Response.json({choices: [{finish_reason: 'tool_calls', message: {content: 'Private preamble that must never reach the user',
        tool_calls: [{id: `tool-${calls}`, type: 'function', function: {name, arguments: JSON.stringify(args)}}]}}]});
    }});
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}`, {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'text/event-stream'}, body: JSON.stringify({question: 'Test'})});
    const {readAnswer} = await import('./stream.mjs'), events = [];
    const result = await readAnswer(response, (event, data) => events.push({event, data}));
    assert.equal(calls, 4);
    assert.ok(!events.some(({event}) => event === 'answer-start'));
    assert.ok(!JSON.stringify(events).includes('Private preamble'));
    assert.ok(!JSON.stringify(events).includes('passage_ids'));
    assert.equal(result.answer, 'Test guidance [1]');
    assert.equal(result.sources[0].url, '/docs/test');
    assert.ok(events.some(({event}) => event === 'sources'));
    assert.equal(events.filter(({event}) => event === 'answer-delta').map(({data}) => data.text).join(''), result.answer);
  } finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
});
