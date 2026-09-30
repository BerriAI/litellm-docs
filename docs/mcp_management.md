# Built-in Management MCP

Connect an MCP client directly to LiteLLM to manage keys, teams, users, models, access groups, and budgets through the proxy's existing management APIs

:::note Availability

This opt-in feature requires a build containing [LiteLLM PR #42634](https://github.com/BerriAI/litellm/pull/42634)

:::

## Enable the endpoint

Add the flag to your existing proxy configuration and restart the proxy:

```yaml title="config.yaml"
general_settings:
  enable_management_mcp: true
```

The endpoint is disabled by default. Both `/litellm-management/mcp` and `/litellm-management/mcp/` return HTTP 404 when disabled

## Connect your MCP client

Configure a remote MCP connection with these settings:

| Setting | Value |
| --- | --- |
| URL | `https://your-litellm-host/litellm-management/mcp` |
| Transport | Streamable HTTP |
| Credential header | `Authorization: Bearer <your-litellm-key>` |

The endpoint also accepts `x-litellm-api-key`. If your deployment sets `general_settings.litellm_key_header_name`, use that configured header with `Bearer <your-litellm-key>`. Keep credentials in your client's secret storage. No external MCP server registration is required, and this endpoint is separate from the aggregate `/mcp` endpoint

The client initializes the connection and discovers the generated tools with `tools/list`. Tool names come from OpenAPI operation IDs. Inputs use `path`, `query`, and `body` sections as declared by each tool's schema

For example, the parameters of a `tools/call` request to read a team are:

```json
{
  "name": "team_info_team_info_get",
  "arguments": {
    "query": {
      "team_id": "your-team-id"
    }
  }
}
```

Use the names and schemas returned by `tools/list` for your proxy version

## Permissions

The agent acts as the identity associated with its configured LiteLLM credential. A dashboard login does not automatically authenticate the MCP client

Proxy admins and non-admin users can connect, subject to existing credential and deployment restrictions. Each tool call runs with the caller's credential through the corresponding REST endpoint, which enforces its existing role, ownership, and resource permissions. Seeing a tool in the catalog does not grant permission to execute it

If a key has `allowed_routes`, it must permit both the management MCP endpoint and the underlying REST route. For example, these entries allow the connection and key information requests, subject to the caller's normal key-information permissions:

```json
{
  "allowed_routes": ["management_mcp_routes", "/key/info"]
}
```

The `mcp_routes` group alone does not permit this management endpoint. Existing deployment controls such as disabled management endpoints and configured admin-only routes still apply

## Responses and limitations

Tools return the REST response data. This includes intentionally returned secrets, such as a newly generated virtual key, which become visible to the MCP client and agent. Store or share these results accordingly

REST failures are returned as MCP tool errors. Calls have a 30-second deadline and a 1 MiB REST response limit. If a mutation times out or its result cannot be returned, inspect the resource's current state before retrying

The catalog is generated at startup. Streaming, binary uploads/downloads, inference, passthrough, authentication callbacks, UI/public routes, MCP transport endpoints, and mutations without a declared JSON request body are excluded. Restart after changes that affect the catalog

Native MCP clients normally omit `Origin`. A client that sends it must use an origin explicitly listed in the proxy's `LITELLM_CORS_ORIGINS` setting; the wildcard `*` does not authorize origins for this endpoint

Built-in dashboard registration, sharing controls, and curated workflows are follow-up work
