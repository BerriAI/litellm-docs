// A stateless MCP server over Streamable HTTP, answering every POST with one
// JSON response. The docs server has no sessions, server-initiated messages,
// or streaming, so it implements the few methods it needs instead of pulling
// in the SDK and its HTTP stack: initialize, ping, tools/list and tools/call.
//
// Security model: read-only public data, no cookies, no sessions. Any Origin
// is accepted, as the OpenAI and Claude docs servers do, and CORS is open so
// browser clients such as the MCP Inspector can connect. There is no ambient
// credential for another site to ride on, so nothing is gained by blocking.

const {readBody} = require('../search/api');
const {validate, assertSupported} = require('./schema');

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_BODY_BYTES = 65536;
// 2025-03-26 allows JSON-RPC batches; later versions removed them.
const MAX_BATCH = 20;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Max-Age': '86400',
};
// A hard ceiling on one tool result; tools keep well under it on their own.
const MAX_RESULT_CHARS = 100000;
const TOOL_TIMEOUT_MS = 15000;

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

function json(res, status, body, extra = {}) {
  if (res.destroyed || res.headersSent) return;
  const headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...CORS, ...extra};
  if (body === undefined) {
    res.writeHead(status, headers);
    res.end();
    return;
  }
  res.writeHead(status, {'Content-Type': 'application/json', ...headers});
  res.end(JSON.stringify(body));
}

const rpcError = (id, code, message) => ({jsonrpc: '2.0', id: id ?? null, error: {code, message}});
const validId = (id) => typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));
const short = (value) => String(value).slice(0, 80);

function capContent(result) {
  let used = 0;
  const content = (result.content || []).map((part) => {
    if (part.type !== 'text') return part;
    const room = Math.max(0, MAX_RESULT_CHARS - used);
    used += Math.min(part.text.length, room);
    return part.text.length <= room ? part : {...part, text: `${part.text.slice(0, room)}\n\n[Truncated at ${MAX_RESULT_CHARS} characters]`};
  });
  return {...result, content};
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  })]).finally(() => clearTimeout(timer));
}

function createMcpHandler({serverInfo, instructions, tools, log = (entry) => console.log(JSON.stringify(entry))}) {
  const byName = new Map();
  for (const tool of tools) {
    if (!/^[a-z][a-z0-9_]{2,63}$/.test(tool.name)) throw new Error(`Invalid tool name: ${tool.name}`);
    if (byName.has(tool.name)) throw new Error(`Duplicate tool: ${tool.name}`);
    if (typeof tool.description !== 'string' || typeof tool.handler !== 'function') throw new Error(`Incomplete tool: ${tool.name}`);
    assertSupported(tool.inputSchema, tool.name);
    byName.set(tool.name, tool);
  }
  const listing = {tools: tools.map(({name, title, description, inputSchema, annotations}) =>
    ({name, ...(title ? {title} : {}), description, inputSchema, ...(annotations ? {annotations} : {})}))};

  async function callTool(params) {
    const tool = byName.get(params.name);
    if (!tool) return {error: [INVALID_PARAMS, `Unknown tool: ${short(params.name)}`]};
    const args = params.arguments ?? {};
    const checked = validate(tool.inputSchema, args);
    if (checked.error) {
      return {result: {content: [{type: 'text', text: `Invalid input: ${checked.error}.`}], isError: true}, tool: tool.name, status: 'invalid'};
    }
    try {
      const result = await withTimeout(Promise.resolve().then(() => tool.handler(checked.value)), TOOL_TIMEOUT_MS);
      return {result: capContent(result), tool: tool.name, status: result.isError ? 'tool_error' : 'ok'};
    } catch (error) {
      log({event: 'mcp_tool_failed', tool: tool.name, error: String(error?.message || error).slice(0, 200)});
      return {result: {content: [{type: 'text', text: 'This tool is temporarily unavailable. Try again shortly.'}], isError: true},
        tool: tool.name, status: 'failed'};
    }
  }

  async function dispatch(message) {
    const {id, method, params = {}} = message;
    if (params === null || typeof params !== 'object' || Array.isArray(params)) return {error: [INVALID_PARAMS, 'params must be an object']};
    switch (method) {
      case 'initialize': {
        const requested = params.protocolVersion;
        const protocolVersion = PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0];
        return {result: {protocolVersion, capabilities: {tools: {listChanged: false}}, serverInfo, instructions}};
      }
      case 'ping':
        return {result: {}};
      case 'tools/list':
        return {result: listing};
      case 'tools/call':
        if (typeof params.name !== 'string') return {error: [INVALID_PARAMS, 'params.name must be a string']};
        if (params.arguments !== undefined && (params.arguments === null || typeof params.arguments !== 'object' || Array.isArray(params.arguments))) {
          return {error: [INVALID_PARAMS, 'params.arguments must be an object']};
        }
        return callTool(params);
      default:
        return {error: [METHOD_NOT_FOUND, `Method not found: ${short(method)}`]};
    }
  }

  // One JSON-RPC message in, one response object out (null for notifications
  // and client responses, which need no reply).
  async function answer(message, started) {
    if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0') {
      return rpcError(null, INVALID_REQUEST, 'Invalid JSON-RPC 2.0 message');
    }
    if (message.id === undefined || message.method === undefined) return null;
    if (!validId(message.id) || typeof message.method !== 'string') {
      return rpcError(validId(message.id) ? message.id : null, INVALID_REQUEST, 'Invalid JSON-RPC request');
    }
    let outcome;
    try {
      outcome = await dispatch(message);
    } catch (error) {
      log({event: 'mcp_failed', method: short(message.method), error: String(error?.message || error).slice(0, 200)});
      outcome = {error: [INTERNAL_ERROR, 'Internal error']};
    }
    const body = outcome.error
      ? rpcError(message.id, outcome.error[0], outcome.error[1])
      : {jsonrpc: '2.0', id: message.id, result: outcome.result};
    // Tool arguments are never logged: queries can carry pasted secrets.
    log({event: 'mcp_request', method: short(message.method), tool: outcome.tool, status: outcome.status ?? (outcome.error ? 'rpc_error' : 'ok'),
      bytes: Buffer.byteLength(JSON.stringify(body)), ms: Date.now() - started});
    return body;
  }

  return async function handle(req, res) {
    const started = Date.now();
    if (req.method === 'OPTIONS') return json(res, 204);
    if (req.method !== 'POST') {
      return json(res, 405, rpcError(null, INVALID_REQUEST, 'Use POST. This MCP server is stateless and has no event stream.'), {Allow: 'POST, OPTIONS'});
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
      return json(res, 415, rpcError(null, INVALID_REQUEST, 'Use Content-Type: application/json'));
    }
    const version = req.headers['mcp-protocol-version'];
    if (version !== undefined && !PROTOCOL_VERSIONS.includes(version)) {
      return json(res, 400, rpcError(null, INVALID_REQUEST, `Unsupported MCP-Protocol-Version. Supported: ${PROTOCOL_VERSIONS.join(', ')}`));
    }
    if (Number(req.headers['content-length']) > MAX_BODY_BYTES) return json(res, 413, rpcError(null, INVALID_REQUEST, 'Request is too large'));
    const parsed = await readBody(req, AbortSignal.timeout(5000), MAX_BODY_BYTES);
    if (parsed.error) {
      return json(res, parsed.status, rpcError(null, parsed.status === 400 ? PARSE_ERROR : INVALID_REQUEST, parsed.error));
    }
    const message = parsed.body;
    if (Array.isArray(message)) {
      if (!message.length || message.length > MAX_BATCH) {
        return json(res, 400, rpcError(null, INVALID_REQUEST, `Send 1 to ${MAX_BATCH} messages in a batch`));
      }
      const replies = (await Promise.all(message.map((m) => answer(m, started)))).filter(Boolean);
      return replies.length ? json(res, 200, replies) : json(res, 202);
    }
    const reply = await answer(message, started);
    if (!reply) return json(res, 202);
    return json(res, reply.error?.code === INVALID_REQUEST ? 400 : 200, reply);
  };
}

module.exports = {createMcpHandler, PROTOCOL_VERSIONS, MAX_RESULT_CHARS};
