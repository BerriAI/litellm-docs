# Atlassian MCP server

Connect Atlassian's hosted remote MCP server through the LiteLLM MCP Gateway for Jira issues, Confluence pages, and Compass components.

Atlassian hosts and updates the server, so there is nothing to deploy. LiteLLM puts centralized auth, access control, and observability in front of it.

## When should you use this server

- Let an agent triage, create, or update Jira issues without a bespoke Jira integration
- Give an agent Confluence context: summarize a page, find the doc behind a decision, draft a new one
- Expose Jira and Confluence to a team under one gateway key instead of distributing Atlassian tokens

## Key features

- One server covers Jira, Confluence, and Compass, including tools that link items across products
- Hosted by Atlassian and open to all Atlassian Cloud customers with no special signup
- Per-user auth: tools respect the signed-in user's existing product permissions, so an agent cannot open a project or space that person cannot

## Authentication

- **Method:** OAuth 2.1 with user tokens, using dynamic client registration. LiteLLM registers itself, so there is no client ID or secret to create or rotate
- **Atlassian site:** Atlassian Cloud only. Server and Data Center deployments are not covered

## Endpoint

**Remote MCP server:**

```
https://mcp.atlassian.com/v1/mcp
```

---

## Connect via LiteLLM MCP Gateway

:::info
Atlassian supports [dynamic client registration](https://datatracker.ietf.org/doc/html/rfc7591), so registration is the whole setup. There is no OAuth app to create first, unlike [Slack](./slack.md).
:::

### Step 1: Register the server in LiteLLM

1. In the LiteLLM UI, navigate to **MCP Servers** and click **+ Add New MCP Server**.
2. Set:

   | Field | Value |
   |---|---|
   | **Name** | `atlassian_mcp` |
   | **Server URL** | `https://mcp.atlassian.com/v1/mcp` |
   | **Transport** | HTTP |
   | **Authentication** | OAuth |
   | **OAuth flow type** | Interactive (PKCE) |
   | **Client ID / Client Secret** | Leave blank |

3. Click **Create MCP Server**, then open the **MCP Tools** tab to confirm the connection. The first listing sends you through Atlassian sign-in and site selection.

Or declare it in config instead of the UI:

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  atlassian_mcp:
    url: "https://mcp.atlassian.com/v1/mcp"
    transport: "http"
    description: "Jira, Confluence, and Compass"
    auth_type: oauth2
    oauth2_flow: authorization_code
```

`oauth2_flow: authorization_code` selects the interactive per-user flow and is required; the proxy refuses to start on an `auth_type: oauth2` server that omits it.

:::warning Leave the client credentials out
Do not add `client_id`, `client_secret`, or `token_url`. Those switch the server to a machine-to-machine identity shared by every caller, so Jira changes get attributed to one service account instead of the person who asked for them. Dynamic registration makes them unnecessary.
:::

### Step 2: Check the OAuth callback origin

If LiteLLM runs behind a TLS-terminating ingress, set `PROXY_BASE_URL` to the origin users see in their address bar so the OAuth callback validates:

```
PROXY_BASE_URL=https://llm.example.com
```

A mismatch surfaces as `400 Bad Request` with `{"detail":"invalid_request"}` when you click **Connect**. See [Reverse proxy and ingress configuration](../mcp_oauth.md#reverse-proxy-and-ingress-configuration).

### Step 3: Connect from an agent

The gateway serves each server at `{proxy_base_url}/{server_name}/mcp`, so `atlassian_mcp` is reachable at `http://localhost:4000/atlassian_mcp/mcp`.

```json title="Claude Desktop / Cursor" showLineNumbers
{
  "mcpServers": {
    "atlassian": {
      "url": "http://localhost:4000/atlassian_mcp/mcp",
      "headers": {
        "x-litellm-api-key": "Bearer $LITELLM_API_KEY"
      }
    }
  }
}
```

For Claude Code, `claude mcp add --transport http atlassian http://localhost:4000/atlassian_mcp/mcp --header "x-litellm-api-key: Bearer $LITELLM_API_KEY"`.

The first call opens a browser to authorize and pick a site. LiteLLM stores and refreshes that user's token afterwards, so the authorization is a one-time step per user.

---

## Tools provided

:::info
Atlassian publishes its tool definitions at runtime through `tools/list`, so names and fields can change without notice. The **MCP Tools** tab in the LiteLLM UI lists exactly what your site exposes and is the source of truth. See Atlassian's [Remote MCP server documentation](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/) for upstream details.
:::

| Product | Coverage |
|---|---|
| Jira | Issue search, issue creation and updates, bulk issue creation |
| Confluence | Page reads and summaries, page creation, space navigation |
| Compass | Component creation, bulk component and custom-field import, dependency queries |
| Combined | Linking items across products, for example attaching a ticket to a page |

LiteLLM prefixes tool names with the server name, so `getJiraIssue` is exposed as `atlassian_mcp-getJiraIssue`; see [Tool naming](../mcp_rest_api.md#tool-naming). The tool surface here is large, so [MCP Tool Search](../mcp_tool_search.md) and [semantic filtering](../mcp_semantic_filter.md) are worth enabling to keep the model's tool list small enough to be useful.

---

## Notes

Access is granted per key and per team through `object_permission`, and call volume is capped per server with `mcp_rpm_limit`; both are covered in [MCP Permission Management](../mcp_control.md). Atlassian applies its own hourly quota, so a per-key cap keeps one runaway agent from consuming the whole site's budget.

Pass the LiteLLM API key as `x-litellm-api-key`, never as `Authorization`. Interactive OAuth needs the `Authorization` header free for Atlassian's token, and a client that occupies it blocks the flow and forwards your LiteLLM key upstream. Adding `x-litellm-mcp-debug: true` to a request returns masked diagnostics; a healthy call reports `x-mcp-debug-auth-resolution: oauth2-passthrough` against `https://mcp.atlassian.com/v1/mcp`. See [Debugging OAuth](../mcp_oauth.md#debugging-oauth) and the [MCP Troubleshooting Guide](../mcp_troubleshoot.md).

A session cannot switch Atlassian sites once authorized, so a user who picked the wrong site has to disconnect and reconnect the server. Known beta limits include constraints on bulk operations, manual configuration for some custom Jira fields, and partial support in a few clients.
