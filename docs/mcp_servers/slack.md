import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Slack MCP server

> Connect Slack's hosted MCP server through the LiteLLM MCP Gateway for workspace search, channel reads, and messaging.

Slack hosts and maintains the server, so there is nothing to deploy or run yourself. LiteLLM adds centralized auth, access control by key and team, cost tracking per tool call, and one audit trail across every MCP server you expose.

## When should you use this server

- Give an agent workspace context: what was decided in a channel, who said it, and when
- Let an agent post updates, summaries, or alerts into Slack instead of only reporting back in chat
- Search across messages, files, and canvases as a retrieval step before answering

## Key features

- Tool surface depends on the OAuth scopes you grant, so a read-only rollout and a full read/write rollout use the same server with different consent
- Hosted by Slack over Streamable HTTP; no local process, no bot token to rotate
- Per-user auth, so every tool call runs as the signed-in person and only sees what they can already see in Slack

## Authentication

- **Method:** OAuth 2.1 with user tokens. Slack does not support dynamic client registration, so you create a Slack app and give LiteLLM its client credentials.
- **Slack app:** Create one at [api.slack.com/apps](https://api.slack.com/apps). You will set a redirect URL, add user token scopes, and enable the Model Context Protocol toggle. Slack only permits MCP on internal apps and directory-published apps, so an app built in your own workspace qualifies.

## Endpoint

**Remote MCP server:**

```
https://mcp.slack.com/mcp
```

***

## Connect via LiteLLM MCP Gateway

:::info
Slack is one of the servers that needs explicit client credentials. LiteLLM normally handles OAuth client setup for you through dynamic registration, as on the [Atlassian](./atlassian.md) and [Linear](./linear.md) servers, but Slack requires your own app.
:::

### Step 1: Create a Slack OAuth app

1. Go to [api.slack.com/apps](https://api.slack.com/apps), click **Create New App**, then **From scratch**, and pick the workspace agents should reach.
2. Open **OAuth & Permissions**.
3. Under **Redirect URLs**, add `{PROXY_BASE_URL}/callback` and click **Save URLs**:

   ```
   https://llm.example.com/callback
   ```

4. Replace `https://llm.example.com` with the origin users see in their address bar. This is the value LiteLLM sends upstream as the `redirect_uri`, so a mismatch fails the flow at Slack's consent screen. See [Reverse proxy and ingress configuration](../mcp_oauth.md#reverse-proxy-and-ingress-configuration) if LiteLLM sits behind an ingress.
5. Under **User Token Scopes**, add the scopes for the capabilities you want, matching the table in [Tools provided](#oauth-scopes-by-capability). Start read-only for a broad rollout and add write scopes for teams you trust.
6. From **Basic Information**, copy the **Client ID** and **Client Secret**.

### Step 2: Enable MCP (Agents & AI Apps)

:::warning
The MCP endpoint sits behind a per-app toggle under **Agents & AI Apps**. If you leave it off, OAuth still succeeds and the tool list comes back empty or 403, which reads like a LiteLLM permissions problem when it is not.
:::

1. In the app settings, open **Agents & AI Apps**.
2. Enable **Model Context Protocol**.
3. Install or reinstall the app to the workspace so the new scopes take effect.

### Step 3: Register the server in LiteLLM

<Tabs>
<TabItem value="ui" label="LiteLLM UI">

Navigate to **MCP Servers**, click **+ Add New MCP Server**, and set:

| Field | Value |
|---|---|
| **Server Name** | `slack_mcp` |
| **Transport** | HTTP |
| **Server URL** | `https://mcp.slack.com/mcp` |
| **Authentication** | OAuth |
| **OAuth flow type** | Interactive (PKCE) |
| **Client ID / Client Secret** | From Step 1 |

Click **Create MCP Server**, then open the server's **MCP Tools** tab to confirm LiteLLM can list Slack's tools. The first listing triggers the browser sign-in.

</TabItem>
<TabItem value="config" label="config.yaml">

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

`oauth2_flow: authorization_code` selects the interactive per-user flow and is required; the proxy refuses to start on an `auth_type: oauth2` server that omits it. Storing MCP servers also needs `store_model_in_db: true`, covered in [Prerequisites](../mcp.md#prerequisites).

</TabItem>
</Tabs>

### Step 4: Connect from an agent

The gateway serves each server at `http://localhost:4000/{server_name}/mcp`, so `slack_mcp` is reachable at `http://localhost:4000/slack_mcp/mcp`.

<Tabs>
<TabItem value="cursor" label="Claude Desktop / Cursor">

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

</TabItem>
<TabItem value="claude-code" label="Claude Code">

```bash showLineNumbers
claude mcp add --transport http slack http://localhost:4000/slack_mcp/mcp \
  --header "x-litellm-api-key: Bearer $LITELLM_API_KEY"
```

</TabItem>
</Tabs>

The first call opens a browser for Slack sign-in. LiteLLM stores that user's token and refreshes it afterwards, so subsequent sessions connect without prompting.

***

## Tools provided

:::info
Slack publishes its tool definitions at runtime through `tools/list`, so names and fields can change without notice. The **MCP Tools** tab in the LiteLLM UI is the source of truth for what your workspace exposes; it lists the live tools and lets you call one with test arguments. See Slack's [Slack MCP server overview](https://docs.slack.dev/ai/slack-mcp-server) for upstream detail.
:::

| Area | Tools |
|---|---|
| Search | `search_public`, `search_public_and_private`, `search_channels`, `search_users` |
| Read | `read_channel`, `read_thread`, `read_user_profile` |
| Messaging | `send_message`, `send_message_draft`, `schedule_message` |
| Canvases | `create_canvas`, `read_canvas`, `update_canvas` |

Canvas tools require a paid Slack plan. LiteLLM prefixes tool names with the server name, so `search_public` is exposed to models as `slack_mcp-search_public`; see [Tool naming](../mcp_rest_api.md#tool-naming).

### OAuth scopes by capability

| Capability | User token scopes (examples) |
|---|---|
| Search messages and files | `search:read` |
| Read public channels | `channels:read`, `channels:history` |
| Read private channels | `groups:read`, `groups:history` |
| Read direct messages | `im:history` |
| Post messages | `chat:write` |
| Resolve user profiles | `users:read` |
| Read files | `files:read` |

Slack documents the full list in [OAuth scopes](https://api.slack.com/scopes). Rate limits are applied per tool, matching the tier of the equivalent Web API method, and stack on top of anything you configure in LiteLLM.

***

:::info Restrict who can use it
Grant the server per key or per team with `object_permission`, and cap call volume per server with `mcp_rpm_limit`, both covered in [MCP Permission Management](../mcp_control.md). Grant the narrowest scope set that works for the audience; a key that only needs to summarize channels does not need `chat:write`.
:::

:::warning Put the LiteLLM key in `x-litellm-api-key`
Interactive OAuth needs the `Authorization` header free for the upstream token. If a client sends the LiteLLM API key as `Authorization: Bearer sk-...`, the OAuth flow never runs and LiteLLM forwards your LiteLLM key to Slack, which rejects it. To diagnose, add `x-litellm-mcp-debug: true` and read the response headers: `SAME_AS_LITELLM_KEY` confirms this case, and `m2m-client-credentials` means a `token_url` is set and every caller shares one identity. See [Debugging OAuth](../mcp_oauth.md#debugging-oauth) and the [MCP Troubleshooting Guide](../mcp_troubleshoot.md).
:::
