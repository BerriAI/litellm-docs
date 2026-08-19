import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Atlassian MCP server

> Connect Atlassian's hosted remote MCP server through the LiteLLM MCP Gateway for Jira issues, Confluence pages, and Compass components.

Atlassian hosts and updates the server, so there is nothing to deploy or run yourself. LiteLLM adds centralized auth, access control by key and team, cost tracking per tool call, and one audit trail across every MCP server you expose.

## When should you use this server

- Let an agent triage, file, or update Jira issues without leaving the conversation
- Pull Confluence pages in as context, or write findings back as a new page
- Trace ownership and dependencies through Compass components

## Key features

- One server spans Jira, Jira Service Management, Confluence, Bitbucket, and Compass, so a single registration reaches all of them
- Hosted by Atlassian over Streamable HTTP; Cloud only, with no support for Server or Data Center
- Dynamic client registration, so LiteLLM negotiates the OAuth client and there is no client ID or secret to manage

Atlassian ships this as the **Rovo MCP Server**, which is the name to search for in their documentation.

## Authentication

- **Method:** OAuth 2.1 with user tokens, respecting each caller's existing Atlassian permissions. An agent cannot open a Jira project or Confluence space its user cannot already open.
- **Atlassian app:** None to create. Atlassian supports [dynamic client registration](https://datatracker.ietf.org/doc/html/rfc7591), and the server is open to all Atlassian Cloud customers with no separate signup.
- **Alternative:** Atlassian also offers API token authentication, which an organization admin must first enable under Atlassian Administration. Tool coverage differs between the two methods, so check Atlassian's supported-tools page if a product you expect is missing.

## Endpoint

**Remote MCP server:**

```
https://mcp.atlassian.com/v1/mcp/authv2
```

Atlassian documents `authv2` for manually configured clients, which is what LiteLLM is. The older `https://mcp.atlassian.com/v1/mcp` form is still live and still handed out by Atlassian's one-click installers, so you may see it in existing setups; prefer `authv2` for new ones.

***

## Connect via LiteLLM MCP Gateway

:::warning Leave the client credentials out
Do not set `client_id`, `client_secret`, or `token_url` on this server. Those switch it to a machine-to-machine identity shared by every caller, so Jira changes get attributed to one service account instead of the person who asked for them. Atlassian's dynamic registration makes them unnecessary.
:::

### Step 1: Register the server in LiteLLM

<Tabs>
<TabItem value="ui" label="LiteLLM UI">

Navigate to **MCP Servers**, click **+ Add New MCP Server**, and set:

| Field | Value |
|---|---|
| **Server Name** | `atlassian_mcp` |
| **Transport** | HTTP |
| **Server URL** | `https://mcp.atlassian.com/v1/mcp/authv2` |
| **Authentication** | OAuth |
| **OAuth flow type** | Interactive (PKCE) |
| **Client ID / Client Secret** | Leave blank |

Click **Create MCP Server**, then open the server's **MCP Tools** tab to confirm the connection. The first listing sends you through Atlassian sign-in and site selection.

</TabItem>
<TabItem value="config" label="config.yaml">

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  atlassian_mcp:
    url: "https://mcp.atlassian.com/v1/mcp/authv2"
    transport: "http"
    description: "Jira, Confluence, and Compass"
    auth_type: oauth2
    oauth2_flow: authorization_code
```

`oauth2_flow: authorization_code` selects the interactive per-user flow and is required; the proxy refuses to start on an `auth_type: oauth2` server that omits it. Storing MCP servers also needs `store_model_in_db: true`, covered in [Prerequisites](../mcp.md#prerequisites).

</TabItem>
</Tabs>

### Step 2: Set the proxy's public origin

If LiteLLM runs behind a TLS-terminating ingress, set `PROXY_BASE_URL` to the origin users see in their address bar so the OAuth callback validates:

```bash
PROXY_BASE_URL=https://llm.example.com
```

A mismatch surfaces as `400 Bad Request` with `{"detail":"invalid_request"}` when you click **Connect**. Full rules are in [Reverse proxy and ingress configuration](../mcp_oauth.md#reverse-proxy-and-ingress-configuration).

### Step 3: Connect from an agent

The gateway serves each server at `http://localhost:4000/{server_name}/mcp`, so `atlassian_mcp` is reachable at `http://localhost:4000/atlassian_mcp/mcp`.

<Tabs>
<TabItem value="cursor" label="Claude Desktop / Cursor">

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

</TabItem>
<TabItem value="claude-code" label="Claude Code">

```bash showLineNumbers
claude mcp add --transport http atlassian http://localhost:4000/atlassian_mcp/mcp \
  --header "x-litellm-api-key: Bearer $LITELLM_API_KEY"
```

</TabItem>
</Tabs>

The first call opens a browser to authorize and pick a site. LiteLLM stores that user's token and refreshes it afterwards, so subsequent sessions connect without prompting.

***

## Tools provided

:::info
Atlassian publishes its tool definitions at runtime through `tools/list`, so names and fields can change without notice. The **MCP Tools** tab in the LiteLLM UI is the source of truth for what your site exposes; it lists the live tools and lets you call one with test arguments. See Atlassian's [MCP server documentation](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/) for upstream detail.
:::

| Product | Capabilities |
|---|---|
| Jira | Issue search, issue creation and updates, bulk issue creation |
| Confluence | Page reads and summaries, page creation, space navigation |
| Compass | Component creation, bulk component and custom-field import from CSV or JSON, dependency queries |
| Jira Service Management | Request and queue access |
| Bitbucket | Repository and pull request access |
| Cross-product | Linking items across products, for example attaching a ticket to a page, or finding docs tied to a Compass component |

LiteLLM prefixes tool names with the server name, so a tool named `getJiraIssue` is exposed to models as `atlassian_mcp-getJiraIssue`; see [Tool naming](../mcp_rest_api.md#tool-naming). This server's tool surface is large, so [MCP Tool Search](../mcp_tool_search.md) and [semantic filtering](../mcp_semantic_filter.md) are worth enabling to keep the model's tool list small enough to be useful.

### Known limitations

The server is in beta, and Atlassian applies its own hourly request quota that varies by plan. Bulk operations carry rate and format constraints, custom Jira fields may need manual configuration, and support is partial in some clients. A session is bound to one site, so a user who authorized against the wrong site has to disconnect and reconnect the server rather than switching in place.

***

:::info Restrict who can use it
Grant the server per key or per team with `object_permission`, and cap call volume per server with `mcp_rpm_limit`, both covered in [MCP Permission Management](../mcp_control.md). A per-key cap matters more here than on most servers, since Atlassian's beta quota is shared across the whole site and one runaway agent can exhaust it.
:::

:::warning Put the LiteLLM key in `x-litellm-api-key`
Interactive OAuth needs the `Authorization` header free for the upstream token. If a client sends the LiteLLM API key as `Authorization: Bearer sk-...`, the OAuth flow never runs and LiteLLM forwards your LiteLLM key to Atlassian, which rejects it. To diagnose, add `x-litellm-mcp-debug: true` and read the response headers; a healthy call reports `x-mcp-debug-auth-resolution: oauth2-passthrough` against `https://mcp.atlassian.com/v1/mcp/authv2`, while `SAME_AS_LITELLM_KEY` confirms this case and `m2m-client-credentials` means client credentials are set and every caller shares one identity. See [Debugging OAuth](../mcp_oauth.md#debugging-oauth) and the [MCP Troubleshooting Guide](../mcp_troubleshoot.md).
:::
