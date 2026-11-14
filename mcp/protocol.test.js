const test = require('node:test');
const assert = require('node:assert/strict');
const {Readable} = require('node:stream');
const {createMcpHandler, PROTOCOL_VERSIONS} = require('./protocol');
const {validate, assertSupported} = require('./schema');

function request(handler, {method = 'POST', headers = {}, body} = {}) {
  const raw = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []);
  req.method = method;
  req.headers = {'content-type': 'application/json', ...headers};
  return new Promise((resolve) => {
    const res = {
      headersSent: false, destroyed: false, statusCode: 0, headers: {},
      writeHead(status, h) {this.statusCode = status; this.headers = h || {}; this.headersSent = true; return this;},
      end(data) {resolve({status: this.statusCode, headers: this.headers, body: data ? JSON.parse(data) : undefined});},
    };
    handler(req, res);
  });
}

const echo = {
  name: 'echo_text',
  description: 'Echo.',
  inputSchema: {type: 'object', additionalProperties: false, required: ['value'], properties: {
    value: {type: 'string', maxLength: 10}, times: {type: 'integer', minimum: 1, maximum: 3, default: 1},
  }},
  annotations: {readOnlyHint: true},
  handler: ({value, times}) => ({content: [{type: 'text', text: value.repeat(times)}]}),
};
const huge = {name: 'huge_text', description: 'Big.', inputSchema: {type: 'object', additionalProperties: false, properties: {}},
  handler: () => ({content: [{type: 'text', text: 'x'.repeat(250000)}]})};
const broken = {name: 'broken_tool', description: 'Fails.', inputSchema: {type: 'object', additionalProperties: false, properties: {}},
  handler: () => {throw new Error('secret detail');}};

const logs = [];
const handler = createMcpHandler({serverInfo: {name: 't', version: '1'}, instructions: 'Use it.', tools: [echo, huge, broken], log: (e) => logs.push(e)});
const rpc = (method, params, id = 1) => request(handler, {body: {jsonrpc: '2.0', id, method, params}});

test('initialize negotiates the protocol version and returns instructions', async () => {
  const known = await rpc('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'c', version: '1'}});
  assert.equal(known.status, 200);
  assert.equal(known.body.result.protocolVersion, '2025-06-18');
  assert.equal(known.body.result.instructions, 'Use it.');
  assert.deepEqual(known.body.result.capabilities, {tools: {listChanged: false}});
  const unknown = await rpc('initialize', {protocolVersion: '1999-01-01'});
  assert.equal(unknown.body.result.protocolVersion, PROTOCOL_VERSIONS[0]);
});

test('tools/list exposes names, schemas and annotations but not handlers', async () => {
  const {body} = await rpc('tools/list');
  assert.deepEqual(body.result.tools.map((t) => t.name), ['echo_text', 'huge_text', 'broken_tool']);
  assert.equal(body.result.tools[0].annotations.readOnlyHint, true);
  assert.equal(body.result.tools[0].handler, undefined);
});

test('tools/call validates input, fills defaults, and reports bad input as a tool error', async () => {
  const ok = await rpc('tools/call', {name: 'echo_text', arguments: {value: 'ab', times: 2}});
  assert.equal(ok.body.result.content[0].text, 'abab');
  const defaulted = await rpc('tools/call', {name: 'echo_text', arguments: {value: 'ab'}});
  assert.equal(defaulted.body.result.content[0].text, 'ab');
  for (const args of [{}, {value: 'x'.repeat(11)}, {value: 'a', extra: 1}, {value: 'a', times: 9}, {value: 'a', times: 1.5}]) {
    const bad = await rpc('tools/call', {name: 'echo_text', arguments: args});
    assert.equal(bad.body.result.isError, true, JSON.stringify(args));
  }
  const unknown = await rpc('tools/call', {name: 'nope', arguments: {}});
  assert.equal(unknown.body.error.code, -32602);
});

test('tool results are capped and tool failures do not leak details', async () => {
  const big = await rpc('tools/call', {name: 'huge_text'});
  assert.ok(big.body.result.content[0].text.length < 100100);
  assert.match(big.body.result.content[0].text, /Truncated/);
  const failed = await rpc('tools/call', {name: 'broken_tool'});
  assert.equal(failed.body.result.isError, true);
  assert.doesNotMatch(JSON.stringify(failed.body), /secret detail/);
});

test('arguments are never logged', async () => {
  logs.length = 0;
  await rpc('tools/call', {name: 'echo_text', arguments: {value: 'sk-secret'}});
  assert.doesNotMatch(JSON.stringify(logs), /sk-secret/);
  assert.equal(logs.at(-1).tool, 'echo_text');
  await rpc('x'.repeat(5000));
  assert.ok(logs.at(-1).method.length <= 80);
});

test('transport rules: POST only, JSON only, batches, notifications get 202', async () => {
  assert.equal((await request(handler, {method: 'GET'})).status, 405);
  assert.equal((await request(handler, {method: 'DELETE'})).status, 405);
  assert.equal((await request(handler, {headers: {'content-type': 'text/plain'}, body: '{}'})).status, 415);
  assert.equal((await request(handler, {body: '{nope'})).body.error.code, -32700);
  const batch = await request(handler, {body: [{jsonrpc: '2.0', id: 1, method: 'ping'}, {jsonrpc: '2.0', method: 'notifications/initialized'}, {jsonrpc: '2.0', id: 2, method: 'tools/list'}]});
  assert.deepEqual(batch.body.map((r) => r.id), [1, 2]);
  assert.equal((await request(handler, {body: [{jsonrpc: '2.0', method: 'notifications/initialized'}]})).status, 202);
  assert.equal((await request(handler, {body: []})).status, 400);
  assert.equal((await request(handler, {body: {jsonrpc: '2.0', method: 'notifications/initialized'}})).status, 202);
  assert.equal((await request(handler, {headers: {'mcp-protocol-version': '1999-01-01'}, body: {jsonrpc: '2.0', id: 1, method: 'ping'}})).status, 400);
  assert.equal((await request(handler, {body: 'x'.repeat(70000)})).status, 413);
  assert.equal((await rpc('resources/list')).body.error.code, -32601);
  // Any Origin is accepted, and browser clients get open CORS.
  const cross = await request(handler, {headers: {origin: 'https://example.com'}, body: {jsonrpc: '2.0', id: 1, method: 'ping'}});
  assert.equal(cross.status, 200);
  assert.equal(cross.headers['Access-Control-Allow-Origin'], '*');
  const preflight = await request(handler, {method: 'OPTIONS'});
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers['Access-Control-Allow-Headers'], /MCP-Protocol-Version/);
});

test('schemas with keywords the validator does not enforce are rejected', () => {
  assert.throws(() => assertSupported({type: 'object', additionalProperties: false, properties: {a: {type: 'string', format: 'uri'}}}), /format/);
  assert.throws(() => assertSupported({type: 'object', properties: {}}), /additionalProperties/);
  assert.deepEqual(validate({type: 'array', items: {type: 'string', enum: ['a']}, maxItems: 2}, ['a']), {value: ['a']});
  assert.match(validate({type: 'array', items: {type: 'string', enum: ['a']}, maxItems: 2}, ['a', 'a', 'a']).error, /at most 2/);
});
