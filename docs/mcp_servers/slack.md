# Slack MCP server

Connect Slack's hosted MCP server through the LiteLLM MCP Gateway for search, channels, messaging, and workspace context.

Slack hosts and manages the server, so there is nothing to deploy or keep running. LiteLLM puts centralized auth, access control, and observability in front of it.

## When should you use this server

- Give an agent workspace context: what was decided in a channel, what a thread concluded, who owns something
- Let an agent post updates, draft replies, or schedule messages without a custom Slack integration
- Expose Slack to a team under one gateway key instead of handing out Slack tokens

## Key features

- Tool surface depends on the OAuth scopes you grant, so a read-only rollout is a scope choice rather than a different setup
- Hosted by Slack, so no local process, container, or token rotation to run yourself
- Per-user auth: every tool call runs as the signed-in user and sees only what that person can already see in Slack

## Authentication

- **Method:** OAuth 2.1 with user tokens. Slack does not support dynamic client registration, so LiteLLM needs explicit client credentials from a Slack app you create
- **Slack app:** create one at [api.slack.com/apps](https://api.slack.com/apps), add the LiteLLM callback as a redirect URL, grant user token scopes, and enable Model Context Protocol under **Agents & AI Apps**

## Endpoint

**Remote MCP server:**

```
https://mcp.slack.com/mcp
```

---

## Connect via LiteLLM MCP Gateway

:::info
Slack needs `client_id` and `client_secret` supplied to LiteLLM because it has no dynamic client registration. Servers that do support it, such as [Atlassian](./atlassian.md) and [Linear](./linear.md), skip Steps 1 and 2 entirely.
:::

### Step 1: Create a Slack OAuth app

1. Go to [api.slack.com/apps](https://api.slack.com/apps), click **Create New App**, then **From scratch**, and pick the workspace agents should reach.
2. Open **OAuth & Permissions**.
3. Under **Redirect URLs**, add your proxy's OAuth callback and click **Save URLs**:

   ```
   https://llm.example.com/ui/mcp/oauth/callback
   ```

   Replace the origin with the one users see in their address bar. It must match `PROXY_BASE_URL`; see [Reverse proxy and ingress configuration](../mcp_oauth.md#reverse-proxy-and-ingress-configuration) if LiteLLM sits behind an ingress.
4. Under **User Token Scopes**, add scopes for the capabilities you want, for example `search:read`, `channels:read`, and `chat:write`. Match these to the table in [Tools provided](#tools-provided).
5. From **Basic Information**, copy the **Client ID** and **Client Secret**.

### Step 2: Enable MCP (Agents & AI Apps)

:::warning
The MCP endpoint sits behind a per-app toggle. Leave it off and the OAuth flow still succeeds while the tool list comes back empty, which reads like a LiteLLM permissions problem when it is not.
:::

1. In the app settings, open **Agents & AI Apps**.
2. Enable **Model Context Protocol**.
3. Install or reinstall the app to the workspace so the new scopes take effect.

### Step 3: Register the server in LiteLLM

1. In the LiteLLM UI, navigate to **MCP Servers** and click **+ Add New MCP Server**.
2. Set:

   | Field | Value |
   |---|---|
   | **Name** | `slack_mcp` |
   | **Server URL** | `https://mcp.slack.com/mcp` |
   | **Transport** | HTTP |
   | **Authentication** | OAuth |
   | **OAuth flow type** | Interactive (PKCE) |
   | **Client ID / Client Secret** | From Step 1 |

3. Click **Create MCP Server**, then open the **MCP Tools** tab to confirm LiteLLM can list Slack's tools. The first listing triggers the browser sign-in.

Or declare it in config instead of the UI:

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  slack_mcp:
    url: "https://mcp.slack.com/mcp"
    transport: "http"
    description: "Slack workspace search, channels, and messaging"
    auth_type: oauth2
    oauth2_flow: authorization_code
    client_id: os.environ/SLACK_OAUTH_CLIENT_ID
    client_secret: os.environ/SLACK_OAUTH_CLIENT_SECRET
```

`oauth2_flow: authorization_code` selects the interactive per-user flow and is required; the proxy refuses to start on an `auth_type: oauth2` server that omits it.

### Step 4: Connect from an agent

The gateway serves each server at `{proxy_base_url}/{server_name}/mcp`, so `slack_mcp` is reachable at `http://localhost:4000/slack_mcp/mcp`.

```json title="Claude Desktop / Cursor" showLineNumbers
{
  "mcpServers": {
    "slack": {
      "url": "http://localhost:4000/slack_mcp/mcp",
      "headers": {
        "x-litellm-api-key": "Bearer $LITELLM_API_KEY"
      }
    }
  }
}
```

For Claude Code, `claude mcp add --transport http slack http://localhost:4000/slack_mcp/mcp --header "x-litellm-api-key: Bearer $LITELLM_API_KEY"`.

The first call opens a browser for Slack sign-in. LiteLLM stores and refreshes that user's token afterwards, so the authorization is a one-time step per user.

---

## Tools provided

:::info
Slack publishes its tool definitions at runtime through `tools/list`, so names and fields can change without notice. The **MCP Tools** tab in the LiteLLM UI lists exactly what your workspace exposes and is the source of truth. See Slack's [MCP documentation](https://docs.slack.dev/) for upstream details.
:::

Coverage spans search across messages, files, channels, and users; reads of channels, threads, and user profiles; sending, drafting, and scheduling messages; and creating, reading, and updating canvases. Canvas tools require a paid Slack plan.

### OAuth scopes by capability

| Capability | User token scopes (examples) |
|---|---|
| Search messages and files | `search:read` |
| Read public channels | `channels:read`, `channels:history` |
| Read private channels | `groups:read`, `groups:history` |
| Read direct messages | `im:history` |
| Post messages | `chat:write` |
| Resolve user profiles | `users:read` |

Slack documents the full list in [OAuth scopes](https://api.slack.com/scopes). Start read-only for a broad rollout and add write scopes for teams you trust.

LiteLLM prefixes tool names with the server name, so `search_public` is exposed as `slack_mcp-search_public`; see [Tool naming](../mcp_rest_api.md#tool-naming).

---

## Notes

Access is granted per key and per team through `object_permission`, and call volume is capped per server with `mcp_rpm_limit`; both are covered in [MCP Permission Management](../mcp_control.md).

Pass the LiteLLM API key as `x-litellm-api-key`, never as `Authorization`. Interactive OAuth needs the `Authorization` header free for Slack's token, and a client that occupies it blocks the flow and forwards your LiteLLM key upstream. Adding `x-litellm-mcp-debug: true` to a request returns masked diagnostics that name the exact failure; see [Debugging OAuth](../mcp_oauth.md#debugging-oauth) and the [MCP Troubleshooting Guide](../mcp_troubleshoot.md).

Grant the narrowest scopes that do the job. Tools inherit the user's Slack permissions, so a broad scope grant widens what every agent connected through this server can read.
