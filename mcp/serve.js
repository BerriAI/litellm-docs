// Runs the docs MCP server locally against an existing build:
//   npm run build && npm run mcp:serve
//   claude mcp add --transport http litellm-docs-local http://127.0.0.1:4317/mcp
const http = require('node:http');
const {createServer} = require('./server');

const port = Number(process.env.PORT || 4317);
const handler = createServer();
http.createServer((req, res) => {
  if (!['/mcp', '/mcp/'].includes(new URL(req.url, 'http://localhost').pathname)) {
    res.writeHead(404).end();
    return;
  }
  handler(req, res);
}).listen(port, '127.0.0.1', () => console.log(`LiteLLM docs MCP server on http://127.0.0.1:${port}/mcp`));
