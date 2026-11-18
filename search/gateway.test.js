const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createModelCaller} = require('./gateway');

const config = {baseUrl: 'https://gateway.example.com', apiKey: 'model-test-secret'};
const completion = (finish_reason, content, extra = {}) => Response.json({
  id: 'completion-test', model: 'actual-model', ...extra,
  choices: [{finish_reason, message: {content}}],
});

test('provider truncation fails without application token caps or retries', async () => {
  const requests = [];
  const call = createModelCaller({config, fetchImpl: async (_url, request) => {
    requests.push(request);
    return completion('length', 'Incomplete answer');
  }});
  await assert.rejects(call('Instructions', {question: 'Question'}, 25000),
    {name: 'GatewayResponseTruncated', message: 'Gateway response reached its token limit'});
  assert.equal(requests.length, 1);
  const body = JSON.parse(requests[0].body);
  for (const options of [body, ...body.fallbacks]) {
    assert.equal(options.max_tokens, undefined);
    assert.equal(options.max_completion_tokens, undefined);
  }
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

test('cancelled and invalid responses do not trigger completion retries', async () => {
  for (const response of [
    () => completion('length', config.apiKey),
    () => completion('stop', ''),
    () => new Response('bad gateway', {status: 502}),
    () => new Response('invalid json'),
    () => {throw new Error(`fetch failed with ${config.apiKey}`);},
  ]) {
    let calls = 0;
    const call = createModelCaller({config, fetchImpl: async () => {calls++; return response();}});
    await assert.rejects(call('Instructions', {}, 25000));
    assert.equal(calls, 1);
  }
  const controller = new AbortController();
  let calls = 0;
  const cancelled = createModelCaller({config, signal: controller.signal, fetchImpl: async () => {
    calls++; controller.abort(); return completion('length', 'Partial');
  }});
  await assert.rejects(cancelled('Instructions', {}, 25000));
  assert.equal(calls, 1);
});

const cloudflare = {cfAccessClientId: 'example-client-id', cfAccessClientSecret: 'example-client-secret'};

test('Cloudflare service authentication stays in upstream headers for research and streaming answers', async () => {
  const requests = [];
  const call = createModelCaller({config: {...config, ...cloudflare}, fetchImpl: async (url, request) => {
    requests.push(request);
    assert.equal(url, config.baseUrl + '/chat/completions');
    assert.equal(request.redirect, 'error');
    assert.equal(request.headers.Authorization, `Bearer ${config.apiKey}`);
    assert.equal(request.headers['CF-Access-Client-Id'], cloudflare.cfAccessClientId);
    assert.equal(request.headers['CF-Access-Client-Secret'], cloudflare.cfAccessClientSecret);
    for (const secret of [config.apiKey, ...Object.values(cloudflare)]) assert.ok(!request.body.includes(secret));
    return completion('stop', 'A complete answer');
  }});
  await call.turn([{role: 'user', content: 'Research question'}]);
  const deltas = [];
  await call.turn([{role: 'user', content: 'Answer question'}], {onDelta: delta => deltas.push(delta)});
  assert.equal(requests.length, 2);
  assert.equal(JSON.parse(requests[1].body).stream, true);
  assert.equal(deltas.join(''), 'A complete answer');
});

test('missing, partial, or unsafe gateway configuration fails before any request', () => {
  for (const overrides of [
    {baseUrl: undefined}, {baseUrl: 'not a URL'}, {baseUrl: 'http://gateway.example.com'},
    {baseUrl: 'https://user:password@gateway.example.com'},
    {baseUrl: 'https://gateway.example.com?key=example'}, {baseUrl: 'https://gateway.example.com#example'},
    {apiKey: undefined}, {apiKey: ''}, {apiKey: 'example\r\nInjected: value'},
    {cfAccessClientId: cloudflare.cfAccessClientId}, {cfAccessClientSecret: cloudflare.cfAccessClientSecret},
    {...cloudflare, cfAccessClientId: ''}, {...cloudflare, cfAccessClientSecret: ''},
    {...cloudflare, cfAccessClientSecret: 'example\nInjected: value'},
  ]) {
    assert.throws(() => createModelCaller({config: {...config, ...overrides},
      fetchImpl: () => assert.fail('Invalid configuration must not send credentials')}),
    {name: 'GatewayConfigurationError', message: 'Invalid gateway configuration'});
  }
});

test('gateways without Cloudflare retain bearer authentication without Access headers', async () => {
  const call = createModelCaller({config, fetchImpl: async (_url, request) => {
    assert.deepEqual(request.headers, {'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`});
    return completion('stop', 'Answer');
  }});
  assert.equal(await call('Instructions', {}, 25000), 'Answer');
});

test('Cloudflare denial and login responses stay generic and never retry another endpoint', async () => {
  for (const status of [302, 401, 403]) {
    let calls = 0;
    const call = createModelCaller({config: {...config, ...cloudflare}, fetchImpl: async (_url, request) => {
      calls++;
      assert.equal(request.redirect, 'error');
      return new Response(cloudflare.cfAccessClientSecret, {status, headers: {Location: 'https://login.example.com'}});
    }});
    await assert.rejects(call('Instructions', {}, 25000), {name: 'GatewayHTTPError', message: 'Gateway request failed'});
    assert.equal(calls, 1);
  }
});

test('gateway credentials cannot leak through completions or split stream deltas', async () => {
  const protectedConfig = {...config, ...cloudflare};
  for (const secret of [config.apiKey, ...Object.values(cloudflare)]) {
    const call = createModelCaller({config: protectedConfig,
      fetchImpl: async () => completion('stop', secret, {id: secret, model: secret})});
    await assert.rejects(call('Instructions', {}, 25000), {name: 'GatewayInvalidResponse'});
    const chunks = [secret.slice(0, 5), secret.slice(5)];
    const stream = chunks.map(content => `data: ${JSON.stringify({id: secret, model: secret, choices: [{index: 0, delta: {content}}]})}\n\n`).join('') +
      `data: ${JSON.stringify({choices: [{index: 0, delta: {}, finish_reason: 'stop'}]})}\n\ndata: [DONE]\n\n`;
    const deltas = [];
    const streamed = createModelCaller({config: protectedConfig,
      fetchImpl: async () => new Response(stream, {headers: {'Content-Type': 'text/event-stream'}})});
    await assert.rejects(streamed('Instructions', {}, 25000, delta => deltas.push(delta)), {name: 'GatewayInvalidResponse'});
    assert.equal(deltas.join(''), '');
  }
});
