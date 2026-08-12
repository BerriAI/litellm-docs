# Linear MCP server

Connect Linear's hosted remote MCP server through the LiteLLM MCP Gateway for issues, projects, cycles, and documents.

Linear hosts and manages the server centrally, so there is nothing to deploy. LiteLLM puts centralized auth, access control, and observability in front of it.

## When should you use this server

- Let an agent file, update, and triage Linear issues as part of a coding or planning workflow
- Give an agent project context: what is in the current cycle, what a project's status is, what a document says
- Expose Linear to a team under one gateway key instead of distributing Linear API keys

## Key features

- A dedicated read-only endpoint, so handing an agent Linear context without write access is a URL choice rather than a permissions exercise
- Hosted by Linear, with Streamable HTTP as the primary transport
- Per-user auth by default, with a Linear API key as an alternative for backend agents where no human is present to sign in

## Authentication

- **Method:** OAuth 2.1 with user tokens, using dynamic client registration. LiteLLM registers itself, so there is no client ID or secret to create or rotate
- **Alternative:** a Linear API key sent as a bearer token, useful for read-only context sources and unattended agents. Create it under **Settings > Security & access > Personal API keys**

## Endpoint

**Remote MCP server:**

```
https://mcp.linear.app/mcp
```

**Read-only:**

```
https://mcp.linear.app/mcp/readonly
```

Linear also exposes `https://mcp.linear.app/sse`, a deprecated fallback for clients without Streamable HTTP support. Use `/mcp` for new setups.

---

## Connect via LiteLLM MCP Gateway

:::info
Linear supports [dynamic client registration](https://datatracker.ietf.org/doc/html/rfc7591), so registration is the whole setup. There is no OAuth app to create first, unlike [Slack](./slack.md).
:::

### Step 1: Register the server in LiteLLM

1. In the LiteLLM UI, navigate to **MCP Servers** and click **+ Add New MCP Server**.
2. Set:

   | Field | Value |
   |---|---|
   | **Name** | `linear_mcp` |
   | **Server URL** | `https://mcp.linear.app/mcp` |
   | **Transport** | HTTP |
   | **Authentication** | OAuth |
   | **OAuth flow type** | Interactive (PKCE) |
   | **Client ID / Client Secret** | Leave blank |

3. Click **Create MCP Server**, then open the **MCP Tools** tab to confirm the connection. The first listing sends you through Linear sign-in.

Or declare it in config instead of the UI:

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  linear_mcp:
    url: "https://mcp.linear.app/mcp"
    transport: "http"
    description: "Linear issues, projects, and cycles"
    auth_type: oauth2
    oauth2_flow: authorization_code
```

`oauth2_flow: authorization_code` selects the interactive per-user flow and is required; the proxy refuses to start on an `auth_type: oauth2` server that omits it.

:::warning Leave the client credentials out
Do not add `client_id`, `client_secret`, or `token_url`. Those switch the server to a machine-to-machine identity shared by every caller, so issues get filed by one service account instead of the person who asked. Dynamic registration makes them unnecessary.
:::

### Step 2: Register a read-only server (optional)

For a shared context source, or for a backend agent where no human is present to complete a browser sign-in, pair a read-scoped Linear API key with the read-only endpoint:

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  linear_readonly:
    url: "https://mcp.linear.app/mcp/readonly"
    transport: "http"
    description: "Linear, read-only"
    auth_type: bearer_token
    auth_value: os.environ/LINEAR_API_KEY
```

Create the key with only the Read permission enabled. Every caller shares this one identity, so tool calls are attributed to the key's owner rather than the end user. Prefer Step 1 for anything user-facing or anything that writes.

### Step 3: Connect from an agent

The gateway serves each server at `{proxy_base_url}/{server_name}/mcp`, so `linear_mcp` is reachable at `http://localhost:4000/linear_mcp/mcp`.

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

For Claude Code, `claude mcp add --transport http linear http://localhost:4000/linear_mcp/mcp --header "x-litellm-api-key: Bearer $LITELLM_API_KEY"`.

The first call opens a browser for Linear sign-in. LiteLLM stores and refreshes that user's token afterwards, so the authorization is a one-time step per user.

---

## Tools provided

:::info
Linear publishes its tool definitions at runtime through `tools/list`, so names and fields can change without notice. The **MCP Tools** tab in the LiteLLM UI lists exactly what your workspace exposes and is the source of truth. See Linear's [MCP server documentation](https://linear.app/docs/mcp) for upstream details.
:::

| Area | Tools |
|---|---|
| Issues | `get_issue`, `list_issues`, `create_issue`, `update_issue`, `list_my_issues` |
| Issue metadata | `list_issue_statuses`, `get_issue_status`, `list_issue_labels` |
| Projects | `list_projects`, `get_project`, `create_project`, `update_project` |
| Comments | `list_comments`, `create_comment` |
| Documents and cycles | `get_document`, `list_documents`, `list_cycles` |
| Teams | `list_teams` |

Issues, projects, and comments support reads and writes. Documents, cycles, teams, statuses, and labels are read-only.

LiteLLM prefixes tool names with the server name, so `create_issue` is exposed as `linear_mcp-create_issue`; see [Tool naming](../mcp_rest_api.md#tool-naming). To allow reads but not writes on the standard endpoint, list the write tools under `disallowed_tools`:

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  linear_mcp:
    url: "https://mcp.linear.app/mcp"
    transport: "http"
    auth_type: oauth2
    oauth2_flow: authorization_code
    disallowed_tools: ["create_issue", "update_issue", "create_project", "update_project", "create_comment"]
```

---

## Notes

Access is granted per key and per team through `object_permission`, and call volume is capped per server with `mcp_rpm_limit`; both are covered in [MCP Permission Management](../mcp_control.md).

Pass the LiteLLM API key as `x-litellm-api-key`, never as `Authorization`. Interactive OAuth needs the `Authorization` header free for Linear's token, and a client that occupies it blocks the flow and forwards your LiteLLM key upstream. Adding `x-litellm-mcp-debug: true` to a request returns masked diagnostics; see [Debugging OAuth](../mcp_oauth.md#debugging-oauth) and the [MCP Troubleshooting Guide](../mcp_troubleshoot.md).

An authorized session is scoped to one Linear workspace, and reconnecting alone does not switch it, so a second workspace needs its own MCP server entry in LiteLLM.
