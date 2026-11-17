// The LiteLLM docs MCP server, served at https://docs.litellm.ai/mcp.
// See mcp/server.js for the tools and mcp/protocol.js for the transport.

const {createServer} = require('../mcp/server');

let handler;
module.exports = async (req, res) => {
  handler ||= createServer();
  try {
    return await handler(req, res);
  } catch (error) {
    if (res.headersSent || res.destroyed) return;
    // Vercel's lazy body parser throws a 400 on malformed JSON; anything else
    // is ours.
    const badJson = error?.statusCode === 400 || error instanceof SyntaxError;
    if (!badJson) console.warn(JSON.stringify({event: 'mcp_unhandled', error: String(error?.message || error).slice(0, 200)}));
    res.writeHead(badJson ? 400 : 500, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*'});
    res.end(JSON.stringify({jsonrpc: '2.0', id: null, error: badJson ? {code: -32700, message: 'Invalid JSON'} : {code: -32603, message: 'Internal error'}}));
  }
};
