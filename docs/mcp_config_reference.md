# MCP Configuration Reference

This is the canonical decision reference for connecting to LiteLLM's MCP Gateway: which endpoint to use, which transport to configure, and how the two layers of authentication fit together. Use the linked guides for setup steps and provider-specific requirements

Endpoint examples use `http://localhost:4000` as the proxy base URL; substitute your own. Set `LITELLM_API_KEY` to a key with access to the selected MCP servers. Selecting a server by URL or header narrows existing access; it does not grant access. See [MCP access grants](./mcp_grant_access) for key and team setup

## Protocol version

The gateway and upstream MCP servers negotiate a protocol version during `initialize`. LiteLLM v1.101.0 (`18243cd7`) pins MCP SDK 1.28.1; a gateway initialization on that release negotiated `2025-11-25`. LiteLLM v1.103.0-rc.1 (`ccf5e8c9`) pins SDK 2.2.0. An SDK pin or negotiated version alone does not establish support for every optional protocol capability; inspect the `capabilities` returned by the endpoint you use

There is no supported per-server `spec_version` configuration field. The legacy delegated-auth discovery probe sends `2025-06-18`; that probe is separate from client and upstream SDK negotiation

## Two layers of authentication

Gateway and upstream authentication are configured separately. Keep their credentials separate

1. **Gateway authentication (client to LiteLLM).** Your LiteLLM virtual key. Send it in the `x-litellm-api-key` header (`x-litellm-api-key: Bearer <key>`). `Authorization: Bearer sk-...` also works, but for MCP traffic prefer `x-litellm-api-key` so the `Authorization` header stays free for OAuth tokens and upstream credentials. Use the dedicated header when sending a separate upstream bearer token
2. **Upstream authentication (LiteLLM to the MCP server).** Configured per server via `auth_type` (static keys, OAuth, SigV4, and so on), or supplied per request by the client via `x-mcp-{server_alias}-{header_name}` headers. See [Upstream auth matrix](#upstream-auth-matrix)

If you see your LiteLLM key arriving at the upstream MCP server (the debug headers show `SAME_AS_LITELLM_KEY`), you have put the LiteLLM key in `Authorization` on a server that forwards `Authorization` upstream. Move it to `x-litellm-api-key`. See [Debugging OAuth](./mcp_oauth#debugging-oauth)

## Endpoint matrix

| Endpoint | Protocol | Use when | Required headers | Server scope | Expected response |
|----------|----------|----------|------------------|--------------|-------------------|
| `/mcp` | MCP JSON-RPC (streamable HTTP) | A direct MCP client (Claude Desktop/Code, Cursor, MCP Inspector, FastMCP) should see every server the key can access | `x-litellm-api-key: Bearer sk-...`; optionally `x-mcp-servers: <name1>,<group1>` to narrow the set | All servers the key/team is permitted to use, optionally narrowed by `x-mcp-servers` | MCP `initialize` / `tools/list` / `tools/call` JSON-RPC responses; tool names are prefixed with the server alias (e.g. `github_mcp-search_issues`) |
| `/{server_name}/mcp` | MCP JSON-RPC (streamable HTTP) | A direct MCP client should see exactly one server (or a comma-separated list `/{name1,name2}/mcp`) | `x-litellm-api-key: Bearer sk-...` | The named server(s), toolset, or access group only | Same JSON-RPC responses, scoped to that server |
| `/toolset/{toolset_name}/mcp` | MCP JSON-RPC (streamable HTTP) | A direct MCP client should see exactly the tools in a [toolset](./mcp_toolsets) | `x-litellm-api-key: Bearer sk-...` | The named toolset | Same JSON-RPC responses, scoped to the toolset |
| `server_url: "litellm_proxy"` inside `tools` | LLM API (`/v1/responses` or `/v1/chat/completions`) | The LLM should discover and execute MCP tools during a completion. `litellm_proxy` is a literal sentinel, never a URL | `Authorization: Bearer sk-...` on the LLM request; per-server upstream creds via `x-mcp-...` headers or the tool's `headers` object | All permitted servers, or use `litellm_proxy/mcp/<server_alias>` for a server or toolset | Responses / Chat Completions output; `require_approval: "never"` enables execution of model-selected tools |
| `GET /v1/mcp/server` | REST | List configured servers and fetch a real `server_id` / `server_name` | `Authorization: Bearer sk-...` or `x-litellm-api-key: sk-...` | All servers visible to the key | JSON array of server objects |
| `GET /mcp-rest/tools/list` | REST | List tools over plain HTTP without an LLM or MCP client | Same as above | All accessible servers, or one with `?server_id=` | JSON object with `tools`, `error`, and `message`; see [MCP REST API](./mcp_rest_api) |
| `POST /mcp-rest/tools/call` | REST | Execute one known tool over plain HTTP | Same as above, plus `Content-Type: application/json` | The server named by the required `server_id` body field | JSON tool result; see [MCP REST API](./mcp_rest_api) for error shapes |

Selection rule in one sentence: MCP-speaking clients connect to `/mcp` (all permitted servers) or `/{server_name}/mcp` (one server); LLM-driven tool use inside `/v1/responses` or `/v1/chat/completions` uses the literal `server_url: "litellm_proxy"`; and scripted HTTP calls without an MCP client use `/mcp-rest/*`

Use `litellm_proxy` inside requests sent to LiteLLM's LLM API. The accepted aggregate form `litellm_proxy/mcp` has the same purpose; standardize new examples on `litellm_proxy`. For a server or toolset, use `litellm_proxy/mcp/<name>`. These selectors are not network URLs. When calling a hosted LLM API directly, supply a reachable `https://<proxy-host>/mcp` URL instead

A minimal direct-client request, useful as a smoke test:

```bash
curl -s -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-litellm-api-key: Bearer $LITELLM_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Expected: a JSON-RPC `result` whose `tools` array contains prefixed tool names from reachable servers the key can access. Inspect per-server outcomes in `result._meta` when an upstream returns no tools. A `401` means the gateway credential is wrong; a `404` on `/{server_name}/mcp` means the server name, toolset, or access group does not exist

## Transport matrix

`transport` describes how LiteLLM connects to the upstream MCP server. Clients always reach LiteLLM over streamable HTTP regardless of the upstream transport

When `transport` is omitted in `config.yaml`, the loader defaults to `http` (streamable HTTP). The management API create/update request models default to `sse`. Set `transport` explicitly in both entry points to avoid relying on different defaults

```yaml title="config.yaml: the three transports side by side" showLineNumbers
mcp_servers:
  # Streamable HTTP (default): url required
  deepwiki_mcp:
    url: "https://mcp.deepwiki.com/mcp"
    transport: "http"

  # SSE: url required, transport must be set explicitly
  legacy_mcp:
    url: "https://your-sse-server.example.com/sse"
    transport: "sse"

  # stdio: command required, url unused; LiteLLM launches the process
  everything_mcp:
    transport: "stdio"
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-everything@2026.8.31"]
```

| Transport | Required fields | When to use | Expected behavior |
|-----------|-----------------|-------------|-------------------|
| `http` (YAML default) | `url` | Any modern remote MCP server; this is the MCP streamable HTTP transport | LiteLLM POSTs JSON-RPC to `url` and streams responses |
| `sse` | `url`, `transport: "sse"` | Legacy servers that only expose an SSE endpoint | LiteLLM opens an SSE stream to `url` |
| `stdio` | `transport: "stdio"`, `command`; optional `args`, `env` | Local MCP servers launched as a subprocess on the proxy host | LiteLLM spawns `command` and speaks MCP over stdin/stdout. Per-request headers can be mapped into `env` with `${X-HEADER-NAME}` syntax; see [header-to-env forwarding](./mcp#passing-request-headers-to-stdio-env-vars) |

Replace the SSE URL with a running legacy SSE server. The stdio example requires Node.js and `npx` on the proxy host and launches the pinned demonstration server; it is a connectivity control. Use your own server command for production

In the UI (MCP Servers, Add New MCP Server) the same three transports appear as Streamable HTTP, SSE, and Standard Input/Output (stdio), and stdio config is pasted as JSON

## Upstream auth matrix

`auth_type` selects how LiteLLM authenticates to the upstream MCP server. The YAML below configures upstream credentials. Clients still authenticate to the gateway separately. Replace example endpoints, register the required OAuth client, and set each referenced secret in the proxy environment before starting it

```yaml title="config.yaml: upstream auth side by side" showLineNumbers
mcp_servers:
  # 1. none: server needs no credentials
  open_server:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "none"

  # 2. Static API key: sent as X-API-Key
  api_key_server:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "api_key"
    auth_value: os.environ/MCP_API_KEY          # -> X-API-Key: <value>

  # 3. Static bearer token: sent as Authorization: Bearer
  bearer_server:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "bearer_token"
    auth_value: os.environ/MCP_BEARER_TOKEN     # -> Authorization: Bearer <value>

  # 4. Interactive OAuth (PKCE): each user signs in via browser
  oauth_interactive_server:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "oauth2"
    oauth2_flow: "authorization_code"
    client_id: os.environ/OAUTH_CLIENT_ID
    client_secret: os.environ/OAUTH_CLIENT_SECRET

  # 5. M2M OAuth (client_credentials): LiteLLM fetches and refreshes the token
  oauth_m2m_server:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "oauth2"
    oauth2_flow: "client_credentials"
    client_id: os.environ/M2M_CLIENT_ID
    client_secret: os.environ/M2M_CLIENT_SECRET
    token_url: "https://auth.example.com/oauth/token"
    scopes: ["tool.read", "tool.write"]

  # 6. OBO / delegated (RFC 8693 token exchange): user's token exchanged per request
  obo_server:
    url: "https://mcp.example.com/mcp"
    transport: "http"
    auth_type: "oauth2_token_exchange"
    token_exchange_endpoint: "https://auth.example.com/oauth/token"
    client_id: os.environ/OBO_CLIENT_ID
    client_secret: os.environ/OBO_CLIENT_SECRET
    audience: "https://mcp.example.com"
```

| `auth_type` | Header LiteLLM sends upstream | Credential source | Use when | Setup guide |
|-------------|-------------------------------|-------------------|----------|-----------|
| `none` (or omitted) | No auth header generated from `auth_type` | n/a | Open or network-protected servers | |
| `api_key` | `X-API-Key: <auth_value>` | `auth_value` | Server expects a key header | |
| `bearer_token` | `Authorization: Bearer <auth_value>` | `auth_value` | Server expects a static bearer token | |
| `basic` | `Authorization: Basic <base64(auth_value)>` | `auth_value` as raw `username:password` | Server uses HTTP Basic | |
| `authorization` | `Authorization: <auth_value>` verbatim | `auth_value` | Server needs a nonstandard scheme | |
| `token` | `Authorization: token <auth_value>` | `auth_value` | GitHub-style token scheme | |
| `oauth2` + `oauth2_flow: authorization_code` | `Authorization: Bearer <per-user token>` | Interactive PKCE sign-in per user | Human users must consent individually | [MCP OAuth](./mcp_oauth#interactive-oauth-pkce) |
| `oauth2` + `oauth2_flow: client_credentials` | `Authorization: Bearer <M2M token>` | LiteLLM fetches, caches, refreshes | Backend services, no human in the loop | [MCP OAuth M2M](./mcp_oauth#machine-to-machine-m2m-auth) |
| `oauth2_token_exchange` | `Authorization: Bearer <exchanged token>` | Caller token exchanged using RFC 8693 or the Entra OBO profile | On-behalf-of / delegated access | [MCP OBO Auth](./mcp_obo_auth) |
| `oauth2_id_jag` | `Authorization: Bearer <ID-JAG assertion-derived token>` | Okta ID-JAG two-leg exchange | Okta AI agent token exchange | [MCP ID-JAG](./mcp_id_jag) |
| `true_passthrough` / `oauth_delegate` | The caller's own token, forwarded | Client request | Upstream must see the end user's token untouched | [MCP OAuth Passthrough](./mcp_oauth_passthrough) |
| `aws_sigv4` | Per-request SigV4 signature | AWS credentials or boto3 chain | AWS Bedrock AgentCore servers | [MCP AWS SigV4](./mcp_aws_sigv4) |

`auth_type: oauth2` requires an explicit `oauth2_flow`; missing or invalid values prevent YAML startup. Use `authorization_code` for per-user consent or `client_credentials` for a service identity. Omit the interactive client ID/secret only when the upstream supports dynamic client registration; see [interactive setup and redirects](./mcp_oauth#interactive-oauth-pkce)

For a token on a different header, reuse [`upstream_token_header`](./mcp_oauth#sending-the-token-on-a-different-header) alongside `static_headers`. For Microsoft Entra ID, follow the existing [`token_exchange_profile: entra_obo` guide](./mcp_obo_auth#microsoft-entra-id-azure-ad). Gateway admission, upstream token exchange, and server access grants are separate requirements

For complete static credential inputs, see [non-OAuth authentication](./mcp_authentication). The header column describes the managed SSE/HTTP transport path. The OpenAPI-tool path emits `Authorization: ApiKey <value>` instead of `X-API-Key` for `auth_type: api_key`

Two more ways to send upstream credentials that do not involve `auth_type`:

- **Static headers**: `static_headers: {X-API-Key: "...", X-Custom: "..."}` on the server config attaches fixed headers to every upstream request
- **Client-supplied per-server headers**: clients send `x-mcp-{server_alias}-{header_name}` (e.g. `x-mcp-github_mcp-authorization: Bearer gho_...`) and LiteLLM forwards `{header_name}` to that server only. This is the supported client-side credential mechanism

### Deprecated: `x-mcp-auth`

The global `x-mcp-auth` header (one credential broadcast to every MCP server on the request) is deprecated. Replace it with the per-server form `x-mcp-{server_alias}-{header_name}`, which scopes each credential to one server. `x-mcp-auth` still works today (its header name can be renamed via `mcp_client_side_auth_header_name` in `general_settings` or the `LITELLM_MCP_CLIENT_SIDE_AUTH_HEADER_NAME` env var), but new setups should not use it

## Common client configs

For Cursor, use a network URL and match the credential header to the configured `github_mcp` alias. Replace the key and token placeholders. For Claude Code, use the [CLI setup guide](./tutorials/claude_mcp)

```json title="Cursor mcpServers entry" showLineNumbers
{
  "mcpServers": {
    "github": {
      "url": "http://localhost:4000/github_mcp/mcp",
      "headers": {
        "x-litellm-api-key": "Bearer sk-1234",
        "x-mcp-github_mcp-authorization": "Bearer gho_your_token"
      }
    }
  }
}
```

LLM-driven tool use on the proxy's Responses API (note `server_url` is the literal string `litellm_proxy`):

```bash title="Responses API with MCP tools" showLineNumbers
curl -s http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "{{openai_large}}",
    "input": "Run available tools",
    "tools": [{
      "type": "mcp",
      "server_label": "litellm",
      "server_url": "litellm_proxy",
      "require_approval": "never",
      "headers": {"x-mcp-github_mcp-authorization": "Bearer gho_your_token"}
    }],
    "tool_choice": "required"
  }'
```

Scripted REST calls can reuse `deepwiki_mcp` from the HTTP example above. First discover the server and tool, then call it. Use the returned `server_id` if your server has a different name or alias

```bash title="MCP REST API" showLineNumbers
curl -sS http://localhost:4000/v1/mcp/server \
  -H "Authorization: Bearer $LITELLM_API_KEY"

curl -sS 'http://localhost:4000/mcp-rest/tools/list?server_id=deepwiki_mcp' \
  -H "Authorization: Bearer $LITELLM_API_KEY"

curl -sS -X POST http://localhost:4000/mcp-rest/tools/call \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"server_id":"deepwiki_mcp","name":"read_wiki_structure","arguments":{"repoName":"BerriAI/litellm"}}'
```

Expect a tool result containing the repository's wiki structure. Omitting `server_id` returns `400 missing_parameter`, even if the tool name is prefixed. Use `{}` for tools without arguments; do not pass `null`

## Related docs

- [MCP Overview](./mcp): adding servers via UI or config.yaml, full field reference
- [Using your MCP](./mcp_usage): Responses API, Cursor, and SDK walkthroughs
- [MCP REST API](./mcp_rest_api): `/mcp-rest/*` request/response details and error shapes
- [MCP Permission Management](./mcp_control): `allowed_tools` / `disallowed_tools`, per-key tool permissions, and pinning a server's tool list and descriptions (`pinned_tools`, `POST` / `DELETE /v1/mcp/server/{server_id}/pin`)
- [MCP Guardrails](./mcp_guardrail): `pre_mcp_call` guardrails on tool arguments and on upstream tool descriptions at discovery
- [MCP OAuth](./mcp_oauth), [MCP OBO Auth](./mcp_obo_auth), [MCP OAuth Passthrough](./mcp_oauth_passthrough), [MCP AWS SigV4](./mcp_aws_sigv4)
- [MCP Troubleshooting](./mcp_troubleshoot): debug headers and hop-by-hop isolation
