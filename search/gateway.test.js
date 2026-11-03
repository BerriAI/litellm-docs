const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createModelCaller} = require('./gateway');
const {getTracing} = require('./tracing');
const {OTLPTraceExporter} = require('@opentelemetry/exporter-trace-otlp-proto');

const config = {baseUrl: 'https://gateway.example.com', apiKey: 'model-test-secret'};
const completion = (finish_reason, content, extra = {}) => Response.json({
  id: 'completion-test', model: 'actual-model', ...extra,
  choices: [{finish_reason, message: {content}}],
});

test('provider truncation retains the request ID, usage, finish reason, and safe error without app token caps', async t => {
  const spans = [];
  t.mock.method(OTLPTraceExporter.prototype, 'export', (batch, callback) => {spans.push(...batch); callback({code: 0});});
  const traced = {...config, tracing: {key: 'tracing-test-secret', endpoint: 'https://tracing.example.com/v1/traces'}};
  const tracing = getTracing(traced), requests = [];
  const call = createModelCaller({config: traced, fetchImpl: async (_url, request) => {
    requests.push(request);
    return completion('length', 'Incomplete answer', {
      usage: {prompt_tokens: 6768, completion_tokens: 1800, completion_tokens_details: {reasoning_tokens: 1277}},
    });
  }});
  try {
    await assert.rejects(call('Instructions', {question: 'Question'}, 25000, 'answer'), {name: 'GatewayResponseTruncated'});
    assert.equal(requests.length, 1);
    const body = JSON.parse(requests[0].body);
    for (const options of [body, ...body.fallbacks]) {
      assert.equal(options.max_tokens, undefined);
      assert.equal(options.max_completion_tokens, undefined);
    }
    await tracing.flush();
    assert.equal(spans.length, 1);
    assert.equal(spans[0].attributes['gen_ai.response.id'], 'completion-test');
    assert.equal(spans[0].attributes['gen_ai.response.model'], 'actual-model');
    assert.equal(spans[0].attributes['gen_ai.usage.output_tokens'], 1800);
    assert.equal(spans[0].attributes['gen_ai.usage.reasoning.output_tokens'], 1277);
    assert.deepEqual(spans[0].attributes['gen_ai.response.finish_reasons'], ['length']);
    assert.equal(spans[0].attributes['output.value'], 'Incomplete answer');
    assert.equal(spans[0].attributes['error.type'], 'GatewayResponseTruncated');
    assert.equal(spans[0].status.message, 'Gateway response reached its token limit');
    assert.equal(spans[0].attributes['gen_ai.request.max_tokens'], undefined);
    assert.equal(spans[0].status.code, 2);
  } finally { await tracing.shutdown(); }
});

test('large successful completions have no answer character or response byte cap', async () => {
  const answer = 'Detailed answer. '.repeat(10000);
  const call = createModelCaller({config, fetchImpl: async () => completion('stop', answer)});
  assert.equal(await call('Instructions', {}, 25000), answer);
});

test('provider context-limit codes become safe errors without exposing the provider message', async () => {
  for (const error of [{code: 'context_length_exceeded'}, {type: 'ContextWindowExceededError'}]) {
    const call = createModelCaller({config, fetchImpl: async () => Response.json({error: {...error, message: config.apiKey}}, {status: 400})});
    await assert.rejects(call('Instructions', {}, 25000), {name: 'GatewayContextWindowExceeded', message: 'Conversation exceeds the model context window'});
  }
});

test('reasoning-only truncation remains a diagnosed error', async () => {
  const call = createModelCaller({config, fetchImpl: async () => completion('length', null)});
  await assert.rejects(call('Instructions', {}, 10000), {name: 'GatewayResponseTruncated'});
});

test('cancelled and invalid responses do not trigger completion retries or capture unsafe content', async t => {
  const spans = [];
  t.mock.method(OTLPTraceExporter.prototype, 'export', (batch, callback) => {spans.push(...batch); callback({code: 0});});
  const traced = {...config, tracing: {key: 'another-tracing-secret', endpoint: 'https://tracing.example.com/v1/traces'}};
  const tracing = getTracing(traced);
  try {
    for (const response of [
      () => completion('length', config.apiKey),
      () => completion('stop', ''),
      () => new Response('bad gateway', {status: 502}),
      () => new Response('invalid json'),
      () => {throw new Error(`fetch failed with ${config.apiKey}`);},
    ]) {
      let calls = 0;
      const call = createModelCaller({config: traced, fetchImpl: async () => {calls++; return response();}});
      await assert.rejects(call('Instructions', {}, 25000));
      assert.equal(calls, 1);
    }
    const controller = new AbortController();
    let calls = 0;
    const cancelled = createModelCaller({config: traced, signal: controller.signal, fetchImpl: async () => {
      calls++; controller.abort(); return completion('length', 'Partial');
    }});
    await assert.rejects(cancelled('Instructions', {}, 25000));
    assert.equal(calls, 1);
    await tracing.flush();
    assert.ok(!JSON.stringify(spans.map(span => ({attributes: span.attributes, status: span.status}))).includes(config.apiKey));
    assert.equal(spans[0].attributes['output.value'], undefined);
    assert.equal(spans[4].status.message, 'Error');
  } finally { await tracing.shutdown(); }
});
