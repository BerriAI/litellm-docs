import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Linear MCP server

> Connect Linear's hosted remote MCP server through the LiteLLM MCP Gateway for issues, projects, cycles, and comments.

Linear hosts and manages the server centrally, so there is nothing to deploy or run yourself. LiteLLM adds centralized auth, access control by key and team, cost tracking per tool call, and one audit trail across every MCP server you expose.

## When should you use this server

- Let an agent file, triage, or update issues from wherever the work is discussed
- Pull current cycle and project state in as context before planning or estimating
- Give a coding agent the ticket it is implementing, then have it comment back with progress

## Key features

- A dedicated read-only endpoint, so you can hand out Linear context without granting the ability to file or edit anything
- Hosted by Linear over Streamable HTTP; the older SSE endpoint remains only as a deprecated fallback
- Dynamic client registration for OAuth, plus an API key path for backend agents where no human is present to sign in

## Authentication

- **Method:** OAuth 2.1 with user tokens, respecting each caller's existing Linear permissions. Linear supports [dynamic client registration](https://datatracker.ietf.org/doc/html/rfc7591), so there is no client ID or secret to manage.
- **Alternative:** A Linear API key sent as a bearer token. This is a single shared identity rather than per-user, so reserve it for read-only context sources and unattended backend agents.

## Endpoint

**Remote MCP server:**

```
https://mcp.linear.app/mcp
```

**Read-only:**

```
https://mcp.linear.app/mcp/readonly
```

Linear also exposes `https://mcp.linear.app/sse` as a deprecated fallback for clients without Streamable HTTP support. Use the `/mcp` endpoint for new setups.

***

## Connect via LiteLLM MCP Gateway

:::warning Leave the client credentials out
Do not set `client_id`, `client_secret`, or `token_url` on the OAuth server. Those switch it to a machine-to-machine identity shared by every caller, so issues get filed by one service account instead of the person who asked. Linear's dynamic registration makes them unnecessary. If you actually want a shared identity, use the API key tab below, which is explicit about it.
:::

### Step 1: Register the server in LiteLLM

<Tabs>
<TabItem value="ui" label="LiteLLM UI">

Navigate to **MCP Servers**, click **+ Add New MCP Server**, and set:

| Field | Value |
|---|---|
| **Server Name** | `linear_mcp` |
| **Transport** | HTTP |
| **Server URL** | `https://mcp.linear.app/mcp` |
| **Authentication** | OAuth |
| **OAuth flow type** | Interactive (PKCE) |
| **Client ID / Client Secret** | Leave blank |

Click **Create MCP Server**, then open the server's **MCP Tools** tab to confirm the connection. The first listing sends you through Linear sign-in.

</TabItem>
<TabItem value="config" label="config.yaml">

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  linear_mcp:
    url: "https://mcp.linear.app/mcp"
    transport: "http"
    description: "Linear issues, projects, and cycles"
    auth_type: oauth2
    oauth2_flow: authorization_code
```

`oauth2_flow: authorization_code` selects the interactive per-user flow and is required; the proxy refuses to start on an `auth_type: oauth2` server that omits it. Storing MCP servers also needs `store_model_in_db: true`, covered in [Prerequisites](../mcp.md#prerequisites).

</TabItem>
<TabItem value="api-key" label="config.yaml (API key)">

For a shared read-only context source, or a backend agent with nobody present to complete a browser sign-in, authenticate with a Linear API key instead. Create it in Linear under **Settings > Security & access > Personal API keys** with only the Read permission enabled, then pair it with the read-only endpoint:

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  linear_readonly:
    url: "https://mcp.linear.app/mcp/readonly"
    transport: "http"
    description: "Linear, read-only"
    auth_type: bearer_token
    auth_value: os.environ/LINEAR_API_KEY
```

Every caller shares this identity, so tool calls are attributed to the key's owner rather than the end user. Prefer OAuth for anything user-facing or anything that writes.

</TabItem>
</Tabs>

### Step 2: Set the proxy's public origin

If LiteLLM runs behind a TLS-terminating ingress, set `PROXY_BASE_URL` to the origin users see in their address bar so the OAuth callback validates:

```bash
PROXY_BASE_URL=https://llm.example.com
```

A mismatch surfaces as `400 Bad Request` with `{"detail":"invalid_request"}` when you click **Connect**. Full rules are in [Reverse proxy and ingress configuration](../mcp_oauth.md#reverse-proxy-and-ingress-configuration).

### Step 3: Connect from an agent

The gateway serves each server at `http://localhost:4000/{server_name}/mcp`, so `linear_mcp` is reachable at `http://localhost:4000/linear_mcp/mcp`.

<Tabs>
<TabItem value="cursor" label="Claude Desktop / Cursor">

```json title="Claude Desktop / Cursor" showLineNumbers
{
  "mcpServers": {
    "linear": {
      "url": "http://localhost:4000/linear_mcp/mcp",
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
claude mcp add --transport http linear http://localhost:4000/linear_mcp/mcp \
  --header "x-litellm-api-key: Bearer $LITELLM_API_KEY"
```

</TabItem>
</Tabs>

The first call opens a browser for Linear sign-in. LiteLLM stores that user's token and refreshes it afterwards, so subsequent sessions connect without prompting.

***

## Tools provided

:::info
Linear publishes its tool definitions at runtime through `tools/list`, so names and fields can change without notice. The **MCP Tools** tab in the LiteLLM UI is the source of truth for what your workspace exposes; it lists the live tools and lets you call one with test arguments. See Linear's [MCP documentation](https://linear.app/docs/mcp) for upstream detail.
:::

| Area | Tools |
|---|---|
| Issues | `get_issue`, `list_issues`, `create_issue`, `update_issue`, `list_my_issues` |
| Issue metadata | `list_issue_statuses`, `get_issue_status`, `list_issue_labels` |
| Projects | `list_projects`, `get_project`, `create_project`, `update_project` |
| Comments | `list_comments`, `create_comment` |
| Documents | `get_document`, `list_documents` |
| Cycles | `list_cycles` |
| Teams | `list_teams` |

Writes are limited to issues, projects, and comments; documents, cycles, teams, statuses, and labels are read-only. LiteLLM prefixes tool names with the server name, so `create_issue` is exposed to models as `linear_mcp-create_issue`; see [Tool naming](../mcp_rest_api.md#tool-naming).

### Reads without writes

The read-only endpoint is the cleanest way to grant reads only, and the one to reach for by default. On the standard endpoint you can get the same result by declining the write scope at consent time, or by excluding the write tools in config. Confirm the names against your live tool list first, because a `disallowed_tools` entry that no longer matches a real tool fails silently and leaves that tool callable:

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  linear_mcp:
    url: "https://mcp.linear.app/mcp"
    transport: "http"
    auth_type: oauth2
    oauth2_flow: authorization_code
    disallowed_tools: ["create_issue", "update_issue", "create_project", "update_project", "create_comment"]
```

***

:::info Restrict who can use it
Grant the server per key or per team with `object_permission`, and cap call volume per server with `mcp_rpm_limit`, both covered in [MCP Permission Management](../mcp_control.md).
:::

:::warning Put the LiteLLM key in `x-litellm-api-key`
Interactive OAuth needs the `Authorization` header free for the upstream token. If a client sends the LiteLLM API key as `Authorization: Bearer sk-...`, the OAuth flow never runs and LiteLLM forwards your LiteLLM key to Linear, which rejects it. To diagnose, add `x-litellm-mcp-debug: true` and read the response headers: `SAME_AS_LITELLM_KEY` confirms this case, and `m2m-client-credentials` means client credentials are set and every caller shares one identity. See [Debugging OAuth](../mcp_oauth.md#debugging-oauth) and the [MCP Troubleshooting Guide](../mcp_troubleshoot.md).
:::

An authorized session is bound to one Linear workspace, and reconnecting alone does not switch it, so a user who needs a second workspace has to register it as a separate MCP server entry.
