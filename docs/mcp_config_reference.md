# MCP Configuration Reference

This is the canonical decision reference for connecting to LiteLLM's MCP Gateway: which endpoint to use, which transport to configure, and how the two layers of authentication fit together. Other MCP docs link here instead of restating these rules; if an example elsewhere disagrees with this page, this page wins

All claims on this page are verified against the current LiteLLM implementation. Endpoint examples use `http://localhost:4000` as the proxy base URL; substitute your own

## Protocol version

The LiteLLM MCP Gateway speaks the MCP protocol version bundled with its MCP SDK and negotiates the final version with each client during `initialize`, as the MCP spec requires. Starting in LiteLLM v1.80.18 the gateway's latest supported protocol version is `2025-11-25`

There is no per-server `spec_version` configuration field. Older docs described one defaulting to `2025-06-18`; that field no longer exists, and you do not need to (and cannot) pin a protocol version per MCP server. Version negotiation with upstream MCP servers is likewise handled automatically by the SDK

## Two layers of authentication

Every MCP request through LiteLLM involves up to two independent credentials. Conflating them is the single most common misconfiguration

1. **Gateway authentication (client to LiteLLM).** Your LiteLLM virtual key. Send it in the `x-litellm-api-key` header (`x-litellm-api-key: Bearer sk-...`). `Authorization: Bearer sk-...` also works, but for MCP traffic prefer `x-litellm-api-key` so the `Authorization` header stays free for OAuth tokens and upstream credentials. When both headers are present, `x-litellm-api-key` wins
2. **Upstream authentication (LiteLLM to the MCP server).** Configured per server via `auth_type` (static keys, OAuth, SigV4, and so on), or supplied per request by the client via `x-mcp-{server_alias}-{header_name}` headers. See [Upstream auth matrix](#upstream-auth-matrix)

If you see your LiteLLM key arriving at the upstream MCP server (the debug headers show `SAME_AS_LITELLM_KEY`), you have put the LiteLLM key in `Authorization` on a server that forwards `Authorization` upstream. Move it to `x-litellm-api-key`. See [Debugging OAuth](./mcp_oauth#debugging-oauth)

## Endpoint matrix

| Endpoint | Protocol | Use when | Required headers | Server scope | Expected response |
|----------|----------|----------|------------------|--------------|-------------------|
| `/mcp` | MCP JSON-RPC (streamable HTTP) | A direct MCP client (Claude Desktop/Code, Cursor, MCP Inspector, FastMCP) should see every server the key can access | `x-litellm-api-key: Bearer sk-...`; optionally `x-mcp-servers: <name1>,<group1>` to narrow the set | All servers the key/team is permitted to use, optionally narrowed by `x-mcp-servers` | MCP `initialize` / `tools/list` / `tools/call` JSON-RPC responses; tool names are prefixed with the server alias (e.g. `github_mcp-search_issues`) |
| `/{server_name}/mcp` | MCP JSON-RPC (streamable HTTP) | A direct MCP client should see exactly one server (or a comma-separated list `/{name1,name2}/mcp`) | `x-litellm-api-key: Bearer sk-...` | The named server(s), toolset, or access group only | Same JSON-RPC responses, scoped to that server |
| `/toolset/{toolset_name}/mcp` | MCP JSON-RPC (streamable HTTP) | A direct MCP client should see exactly the tools in a [toolset](./mcp_toolsets) | `x-litellm-api-key: Bearer sk-...` | The named toolset | Same JSON-RPC responses, scoped to the toolset |
| `server_url: "litellm_proxy"` inside `tools` | LLM API (`/v1/responses` or `/v1/chat/completions`) | The LLM should discover and execute MCP tools during a completion. `litellm_proxy` is a literal sentinel, never a URL | `Authorization: Bearer sk-...` on the LLM request; per-server upstream creds via `x-mcp-...` headers or the tool's `headers` object | All servers the key can access; narrow with `x-mcp-servers` or suffix a server name (`litellm_proxy/mcp/<server_name>`) | A normal Responses / Chat Completions payload with tool calls executed when `require_approval: "never"` |
| `GET /v1/mcp/server` | REST | List configured servers and fetch a real `server_id` / `server_name` | `Authorization: Bearer sk-...` or `x-litellm-api-key: sk-...` | All servers visible to the key | JSON array of server objects |
| `GET /mcp-rest/tools/list` | REST | List tools over plain HTTP without an LLM or MCP client | Same as above | All accessible servers, or one with `?server_id=` | JSON list of tools; see [MCP REST API](./mcp_rest_api) |
| `POST /mcp-rest/tools/call` | REST | Execute one known tool over plain HTTP | Same as above, plus `Content-Type: application/json` | The server named by the required `server_id` body field | JSON tool result; see [MCP REST API](./mcp_rest_api) for error shapes |

Selection rule in one sentence: MCP-speaking clients connect to `/mcp` (all permitted servers) or `/{server_name}/mcp` (one server); LLM-driven tool use inside `/v1/responses` or `/v1/chat/completions` uses the literal `server_url: "litellm_proxy"`; and scripted HTTP calls without an MCP client use `/mcp-rest/*`

A minimal direct-client request, useful as a smoke test:

```bash
curl -s -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-litellm-api-key: Bearer sk-1234" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Expected: a JSON-RPC `result` whose `tools` array contains the prefixed tool names of every server the key can access. A `401` means the gateway credential is wrong; a `404` on `/{server_name}/mcp` means the server name, toolset, or access group does not exist

## Transport matrix

`transport` describes how LiteLLM connects to the upstream MCP server. Clients always reach LiteLLM over streamable HTTP regardless of the upstream transport

When `transport` is omitted in `config.yaml`, it defaults to `http` (streamable HTTP)

```yaml title="config.yaml: the three transports side by side" showLineNumbers
mcp_servers:
  # Streamable HTTP (default): url required
  deepwiki_mcp:
    url: "https://mcp.deepwiki.com/mcp"
    transport: "http"        # may be omitted; http is the default

  # SSE: url required, transport must be set explicitly
  zapier_mcp:
    url: "https://actions.zapier.com/mcp/sk-xxxxxxx/sse"
    transport: "sse"

  # stdio: command required, url unused; LiteLLM launches the process
  circleci_mcp:
    transport: "stdio"
    command: "npx"
    args: ["-y", "@circleci/mcp-server-circleci"]
    env:
      CIRCLECI_TOKEN: os.environ/CIRCLECI_TOKEN
```

| Transport | Required fields | When to use | Expected behavior |
|-----------|-----------------|-------------|-------------------|
| `http` (default) | `url` | Any modern remote MCP server; this is the MCP streamable HTTP transport | LiteLLM POSTs JSON-RPC to `url` and streams responses |
| `sse` | `url`, `transport: "sse"` | Legacy servers that only expose an SSE endpoint | LiteLLM opens an SSE stream to `url` |
| `stdio` | `transport: "stdio"`, `command`; optional `args`, `env` | Local MCP servers launched as a subprocess on the proxy host | LiteLLM spawns `command` and speaks MCP over stdin/stdout. Per-request headers can be mapped into `env` with `${X-HEADER-NAME}` syntax; see [header-to-env forwarding](./mcp#passing-request-headers-to-stdio-env-vars) |

In the UI (MCP Servers, Add New MCP Server) the same three transports appear as Streamable HTTP, SSE, and Standard Input/Output (stdio), and stdio config is pasted as JSON

## Upstream auth matrix

`auth_type` selects how LiteLLM authenticates to the upstream MCP server. Gateway auth (your LiteLLM key) is identical in every row and is omitted from the YAML for brevity

```yaml title="config.yaml: upstream auth side by side" showLineNumbers
mcp_servers:
  # 1. none: server needs no credentials
  open_server:
    url: "https://mcp.example.com/mcp"
    auth_type: "none"

  # 2. Static API key: sent as X-API-Key
  api_key_server:
    url: "https://mcp.example.com/mcp"
    auth_type: "api_key"
    auth_value: os.environ/MCP_API_KEY          # -> X-API-Key: <value>

  # 3. Static bearer token: sent as Authorization: Bearer
  bearer_server:
    url: "https://mcp.example.com/mcp"
    auth_type: "bearer_token"
    auth_value: os.environ/MCP_BEARER_TOKEN     # -> Authorization: Bearer <value>

  # 4. Interactive OAuth (PKCE): each user signs in via browser
  oauth_interactive_server:
    url: "https://api.githubcopilot.com/mcp"
    auth_type: "oauth2"
    oauth2_flow: "authorization_code"
    client_id: os.environ/OAUTH_CLIENT_ID       # omit both to rely on
    client_secret: os.environ/OAUTH_CLIENT_SECRET  # dynamic client registration

  # 5. M2M OAuth (client_credentials): LiteLLM fetches and refreshes the token
  oauth_m2m_server:
    url: "https://mcp.example.com/mcp"
    auth_type: "oauth2"
    oauth2_flow: "client_credentials"
    client_id: os.environ/M2M_CLIENT_ID
    client_secret: os.environ/M2M_CLIENT_SECRET
    token_url: "https://auth.example.com/oauth/token"
    scopes: ["tool.read", "tool.write"]

  # 6. OBO / delegated (RFC 8693 token exchange): user's token exchanged per request
  obo_server:
    url: "https://mcp.example.com/mcp"
    auth_type: "oauth2_token_exchange"
    token_exchange_endpoint: "https://auth.example.com/oauth/token"
    client_id: os.environ/OBO_CLIENT_ID
    client_secret: os.environ/OBO_CLIENT_SECRET
    audience: "https://mcp.example.com"
```

| `auth_type` | Header LiteLLM sends upstream | Credential source | Use when | Deep dive |
|-------------|-------------------------------|-------------------|----------|-----------|
| `none` (or omitted) | No auth header | n/a | Open or network-protected servers | |
| `api_key` | `X-API-Key: <auth_value>` | `auth_value` | Server expects a key header | |
| `bearer_token` | `Authorization: Bearer <auth_value>` | `auth_value` | Server expects a static bearer token | |
| `basic` | `Authorization: Basic <auth_value>` | `auth_value` (base64 `user:pass`) | Server uses HTTP Basic | |
| `authorization` | `Authorization: <auth_value>` verbatim | `auth_value` | Server needs a nonstandard scheme | |
| `token` | `Authorization: token <auth_value>` | `auth_value` | GitHub-style token scheme | |
| `oauth2` + `oauth2_flow: authorization_code` | `Authorization: Bearer <per-user token>` | Interactive PKCE sign-in per user | Human users must consent individually | [MCP OAuth](./mcp_oauth#interactive-oauth-pkce) |
| `oauth2` + `oauth2_flow: client_credentials` | `Authorization: Bearer <M2M token>` | LiteLLM fetches, caches, refreshes | Backend services, no human in the loop | [MCP OAuth M2M](./mcp_oauth#machine-to-machine-m2m-auth) |
| `oauth2_token_exchange` | `Authorization: Bearer <exchanged token>` | RFC 8693 exchange of the caller's JWT | On-behalf-of / delegated access | [MCP OBO Auth](./mcp_obo_auth) |
| `oauth2_id_jag` | `Authorization: Bearer <ID-JAG assertion-derived token>` | Okta ID-JAG two-leg exchange | Okta AI agent token exchange | |
| `true_passthrough` / `oauth_delegate` | The caller's own token, forwarded | Client request | Upstream must see the end user's token untouched | [MCP OAuth Passthrough](./mcp_oauth_passthrough) |
| `aws_sigv4` | Per-request SigV4 signature | AWS credentials or boto3 chain | AWS Bedrock AgentCore servers | [MCP AWS SigV4](./mcp_aws_sigv4) |

The header column describes the managed SSE/HTTP transport path. The OpenAPI-tool path emits `Authorization: ApiKey <value>` instead of `X-API-Key` for `auth_type: api_key`

Two more ways to send upstream credentials that do not involve `auth_type`:

- **Static headers**: `static_headers: {X-API-Key: "...", X-Custom: "..."}` on the server config attaches fixed headers to every upstream request
- **Client-supplied per-server headers**: clients send `x-mcp-{server_alias}-{header_name}` (e.g. `x-mcp-github-authorization: Bearer gho_...`) and LiteLLM forwards `{header_name}` to that server only. This is the supported client-side credential mechanism

### Deprecated: `x-mcp-auth`

The global `x-mcp-auth` header (one credential broadcast to every MCP server on the request) is deprecated. Replace it with the per-server form `x-mcp-{server_alias}-{header_name}`, which scopes each credential to one server. `x-mcp-auth` still works today (its header name can be renamed via `mcp_client_side_auth_header_name` in `general_settings` or the `LITELLM_MCP_CLIENT_SIDE_AUTH_HEADER_NAME` env var), but new setups should not use it

## Common client configs, verified shapes

Direct MCP client (Cursor, Claude Desktop/Code), one server:

```json title="Cursor / Claude mcpServers entry" showLineNumbers
{
  "mcpServers": {
    "github": {
      "url": "http://localhost:4000/github_mcp/mcp",
      "headers": {
        "x-litellm-api-key": "Bearer sk-1234",
        "x-mcp-github-authorization": "Bearer gho_your_token"
      }
    }
  }
}
```

LLM-driven tool use on the proxy's Responses API (note `server_url` is the literal string `litellm_proxy`):

```bash title="Responses API with MCP tools" showLineNumbers
curl -s http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "gpt-5",
    "input": "Run available tools",
    "tools": [{
      "type": "mcp",
      "server_label": "litellm",
      "server_url": "litellm_proxy",
      "require_approval": "never",
      "headers": {"x-mcp-github-authorization": "Bearer gho_your_token"}
    }],
    "tool_choice": "required"
  }'
```

Scripted REST call without an MCP client:

```bash title="MCP REST API" showLineNumbers
curl -s -X POST http://localhost:4000/mcp-rest/tools/call \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{"server_id": "github_mcp", "name": "github_mcp-search_issues", "arguments": {"query": "is:open"}}'
```

## Related docs

- [MCP Overview](./mcp): adding servers via UI or config.yaml, full field reference
- [Using your MCP](./mcp_usage): Responses API, Cursor, and SDK walkthroughs
- [MCP REST API](./mcp_rest_api): `/mcp-rest/*` request/response details and error shapes
- [MCP OAuth](./mcp_oauth), [MCP OBO Auth](./mcp_obo_auth), [MCP OAuth Passthrough](./mcp_oauth_passthrough), [MCP AWS SigV4](./mcp_aws_sigv4)
- [MCP Troubleshooting](./mcp_troubleshoot): debug headers and hop-by-hop isolation
