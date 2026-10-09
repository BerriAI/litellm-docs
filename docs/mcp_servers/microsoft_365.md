import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Microsoft 365 MCP server

> Reach Outlook mail and calendar, OneDrive and SharePoint files, and Teams through Microsoft Graph, with every tool call running under the signed-in user's own Entra ID account.

Microsoft Graph is the API behind Microsoft 365, and the open source [ms-365-mcp-server](https://github.com/Softeria/ms-365-mcp-server) exposes it over MCP. You run that server next to the proxy over Streamable HTTP, where it signs nobody in and calls Graph with whatever bearer token arrives on the request, and LiteLLM supplies that token: it runs the Entra ID sign-in for each user, stores the resulting Graph token against that LiteLLM user, and attaches it to every tool call. No shared mailbox credential or tenant-wide application secret is involved. LiteLLM adds centralized auth, access control by key and team, cost tracking per tool call, and one audit trail across every MCP server you expose.

The server only translates MCP calls into Graph calls. Sign-in, consent, token storage, and refresh happen between LiteLLM and Entra ID, so swapping the server changes nothing about how users authenticate: any MCP server that calls Graph with the `Authorization: Bearer` token it receives works with the same LiteLLM configuration and a different `url`.

## When should you use this server

- Give an agent the user's own inbox and calendar: what came in, what is booked, and who is free, without a shared service mailbox
- Pull SharePoint and OneDrive documents as a retrieval step before answering, limited to what that person can already open
- Read and post in Teams chats and channels, manage Planner and To Do tasks, and query Excel tables and OneNote pages from the same server

## Key features

- Per-user auth through Entra ID: each caller consents once in their browser, and every tool call carries their delegated Graph permissions, so the agent sees exactly what the user sees
- Tool surface follows the delegated permissions on the app registration, so a read-only rollout and a full read/write rollout use the same server with different scopes
- 300+ tools across mail, calendar, contacts, OneDrive, SharePoint, Teams, Planner, To Do, OneNote, Excel, users, and groups, plus `search-query` and `graph-batch` for anything else Graph exposes
- Self-hosted over Streamable HTTP, so Graph traffic stays inside your network

## Authentication

- **Method:** OAuth 2.0 authorization code with PKCE against Microsoft Entra ID. Entra does not support dynamic client registration, so you register an app and give LiteLLM its client ID and secret. LiteLLM then publishes OAuth discovery documents for the server that point MCP clients at its own sign-in endpoints in front of Entra (`per_server_oauth_discovery: true` below).
- **App registration:** Create one in the [Microsoft Entra admin center](https://entra.microsoft.com) under **App registrations**. You will add a Web redirect URI, a client secret, and delegated Microsoft Graph permissions.
- **Consent:** Each user approves the delegated permissions on first sign-in. A tenant that restricts user consent needs an admin to grant consent once on the app registration's **API permissions** page.

### Single sign-on through Okta or another identity provider

Microsoft Graph accepts only access tokens that Entra ID issues, so neither an Okta token nor the credential from your LiteLLM single sign-on can stand in for the Graph token, and LiteLLM does not convert one into the other. What carries over is the sign-in itself. When your Microsoft 365 tenant federates authentication to Okta or another identity provider, the Entra sign-in LiteLLM starts redirects there like any other Microsoft 365 sign-in, so users see their usual SSO page, and Entra issues the Graph token once they return. Each user does this once; LiteLLM refreshes the token afterwards.

Three other LiteLLM auth modes come up in this setup and none of them replaces the flow above. [On-behalf-of token exchange](../mcp_obo_auth.md) trades an Entra ID token the client already presents to LiteLLM, so it applies only when users authenticate to LiteLLM with Entra ID tokens rather than through Okta. [ID-JAG](../mcp_id_jag.md) gets tokens from an Okta authorization server, which Graph does not trust. [OAuth passthrough](../mcp_oauth_passthrough.md) forwards the client's bearer token unchanged and exchanges nothing, so the client would still have to obtain a Graph token on its own.

## Endpoint

**Self-hosted MCP server** (organization mode, Streamable HTTP on port 3000):

```bash
npx -y @softeria/ms-365-mcp-server --http 3000 --org-mode
```

The server then listens at `http://localhost:3000/mcp`. `--http` is what makes it take the bearer token on each request, which is the one LiteLLM forwards, instead of signing in on its own; it checks only that the token is present and unexpired and leaves the rest to Graph. `--org-mode` adds the work and school tools (Teams, SharePoint, shared mailboxes) and their permissions. Add `--read-only` to drop every write tool, or `--enabled-tools <regex>` to expose a subset, and pin a version (`@softeria/ms-365-mcp-server@<version>`) in production, since the tool list changes between releases. Keep the port reachable from the proxy only.

***

## Connect via LiteLLM MCP Gateway

:::info
Microsoft 365 is one of the servers that needs explicit client credentials. LiteLLM normally handles OAuth client setup through dynamic registration, as on the [Atlassian](./atlassian.md) and [Linear](./linear.md) servers, but Entra ID requires your own app registration, the same way [Slack](./slack.md) does.
:::

### Step 1: Register an Entra ID app

1. In the [Microsoft Entra admin center](https://entra.microsoft.com), open **App registrations** and click **New registration**.
2. Name it (for example `LiteLLM MCP gateway - Microsoft 365`) and keep **Accounts in this organizational directory only** unless users from other tenants should sign in.
3. Under **Redirect URI**, pick the **Web** platform and enter `{PROXY_BASE_URL}/callback`:

   ```
   https://llm.example.com/callback
   ```

4. Replace `https://llm.example.com` with the origin users see in their address bar. This is the value LiteLLM sends to Entra as the `redirect_uri`, so a mismatch fails the flow at the Microsoft sign-in page with `AADSTS50011`. See [Reverse proxy and ingress configuration](../mcp_oauth.md#reverse-proxy-and-ingress-configuration) if LiteLLM sits behind an ingress.
5. Under **Certificates & secrets**, create a client secret and copy its **Value** right away; it is shown once.
6. Under **API permissions**, click **Add a permission**, pick **Microsoft Graph**, then **Delegated permissions**, and add the scopes for the capabilities you want, matching the table in [Tools provided](#tools-provided). A read-only rollout is `openid`, `offline_access`, `User.Read`, `Mail.Read`, `Calendars.Read`, `Files.Read.All`, and `Sites.Read.All`. `offline_access` is what lets LiteLLM refresh the token, so keep it.
7. Click **Grant admin consent** if your tenant blocks users from consenting themselves.
8. From **Overview**, copy the **Application (client) ID** and **Directory (tenant) ID**.

### Step 2: Run the Graph MCP server

Start the server on the proxy host or on a machine only the proxy can reach. `--http` makes it use the token LiteLLM forwards instead of prompting for its own sign-in, and `--org-mode` turns on the work and school tools:

```bash
npx -y @softeria/ms-365-mcp-server --http 3000 --org-mode
```

### Step 3: Register the server in LiteLLM

<Tabs>
<TabItem value="config" label="config.yaml">

```yaml title="config.yaml" showLineNumbers
mcp_servers:
  microsoft_365:
    url: "http://localhost:3000/mcp"
    transport: "http"
    description: "Outlook mail and calendar, OneDrive and SharePoint files, and Teams through Microsoft Graph"
    auth_type: oauth2
    oauth2_flow: authorization_code
    per_server_oauth_discovery: true
    client_id: os.environ/M365_ENTRA_CLIENT_ID
    client_secret: os.environ/M365_ENTRA_CLIENT_SECRET
    authorization_url: "https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/authorize"
    token_url: "https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token"
    scopes:
      - openid
      - offline_access
      - User.Read
      - Mail.Read
      - Calendars.Read
      - Files.Read.All
      - Sites.Read.All
```

`oauth2_flow: authorization_code` selects the interactive per-user flow and is required; the proxy refuses to start on an `auth_type: oauth2` server that omits it. `per_server_oauth_discovery: true` makes LiteLLM publish the OAuth discovery documents for `/microsoft_365/mcp` itself, with its own `/microsoft_365/authorize` and `/microsoft_365/token` endpoints fronting the Entra URLs above. Without it, the server's protected-resource metadata sends MCP clients to the gateway's shared `/mcp` authorization server, which signs users in to LiteLLM rather than to Entra, so the browser ends on a "The connection cannot continue" page and no Graph token is ever stored. Storing MCP servers also needs `store_model_in_db: true`, covered in [Prerequisites](../mcp.md#prerequisites).

</TabItem>
<TabItem value="ui" label="LiteLLM UI">

Navigate to **MCP Servers**, click **+ Add New MCP Server**, and set:

| Field | Value |
|---|---|
| **Server Name** | `microsoft_365` |
| **Transport** | HTTP |
| **Server URL** | `http://localhost:3000/mcp` |
| **Authentication** | OAuth |
| **OAuth flow type** | Interactive (PKCE) |
| **Client ID / Client Secret** | From Step 1 |
| **Authorization URL** | `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/authorize` |
| **Token URL** | `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token` |
| **Scopes** | The delegated permissions from Step 1 |

Click **Create MCP Server**. The form has no field for `per_server_oauth_discovery` yet, so turn it on through the management API with the `server_id` shown on the server's page:

```bash showLineNumbers
curl -X PUT http://localhost:4000/v1/mcp/server \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"server_id": "<server_id>", "per_server_oauth_discovery": true}'
```

Then open the server's **MCP Tools** tab to confirm LiteLLM can list the Graph tools. The first listing triggers the browser sign-in.

</TabItem>
</Tabs>

### Step 4: Set the proxy's public origin

LiteLLM builds the `redirect_uri` it sends to Entra from its public origin. Set `PROXY_BASE_URL` to the origin you registered in Step 1 so the two match:

```bash
export PROXY_BASE_URL=https://llm.example.com
```

### Step 5: Give users access to the server

LiteLLM stores each Entra token against the LiteLLM user behind the key, so the key or its team needs the server in `object_permission.mcp_servers`, and the key needs a user behind it. A key without that completes the sign-in but has nowhere to keep the token, so the next session signs in again, and the proxy log says `OAuth credential storage not authorized`. See [MCP Permission Management](../mcp_control.md). Users who sign in to LiteLLM through SSO already have a LiteLLM user, so granting the server to the team their identity-provider group maps to is enough.

### Step 6: Connect from an agent

The gateway serves each server at `http://localhost:4000/{server_name}/mcp`, so `microsoft_365` is reachable at `http://localhost:4000/microsoft_365/mcp`.

<Tabs>
<TabItem value="claude-code" label="Claude Code">

```bash showLineNumbers
claude mcp add --transport http microsoft_365 http://localhost:4000/microsoft_365/mcp \
  --header "x-litellm-api-key: Bearer $LITELLM_API_KEY"
```

`/mcp` inside Claude Code shows the server and starts the Entra sign-in. Claude Code caches the OAuth client it registered with the gateway, so if you turn on `per_server_oauth_discovery` after adding the server, remove it and add it again.

Users who sign in to LiteLLM through SSO have no `sk-` key to paste. After `lite login` ([CLI authentication](../proxy/cli_sso.md)), let Claude Code fetch the header itself with `headersHelper`, a command whose output is the headers as JSON:

```json title=".mcp.json" showLineNumbers
{
  "mcpServers": {
    "microsoft_365": {
      "type": "http",
      "url": "http://localhost:4000/microsoft_365/mcp",
      "headersHelper": "printf '{\"x-litellm-api-key\": \"Bearer %s\"}' \"$(lite auth print-token)\""
    }
  }
}
```

The Microsoft sign-in that follows is stored against the LiteLLM user that SSO created, so the same person keeps their Graph token across keys and sessions.

</TabItem>
<TabItem value="claude-desktop" label="Claude Desktop">

Claude Desktop on third-party inference adds MCP servers under **Configure Third-Party Inference** > **Connectors**, which exports as a `managedMcpServers` entry. Point it at the per-server path and set `"oauth": true` so Claude Desktop runs the Microsoft sign-in when LiteLLM answers with a 401:

```json title="managedMcpServers" showLineNumbers
[
  {
    "name": "microsoft_365",
    "transport": "http",
    "url": "http://localhost:4000/mcp/microsoft_365",
    "headers": {"x-litellm-api-key": "Bearer sk-<your-litellm-api-key>"},
    "oauth": true
  }
]
```

Fleets that sign in through SSO replace `headers` with `headersHelper`, covered in [Claude Desktop (Cowork)](../tutorials/claude_desktop_cowork.md#mcp-servers-through-the-litellm-mcp-gateway). The built-in Microsoft 365 connector in Claude Desktop calls Microsoft directly and never passes through LiteLLM, so it gets none of the access control or logging above; use the `url` entry instead.

</TabItem>
<TabItem value="cursor" label="Cursor">

```json title="Cursor" showLineNumbers
{
  "mcpServers": {
    "microsoft_365": {
      "url": "http://localhost:4000/microsoft_365/mcp",
      "headers": {
        "x-litellm-api-key": "Bearer sk-<your-litellm-api-key>"
      }
    }
  }
}
```

</TabItem>
</Tabs>

The first call opens a browser at the Microsoft sign-in, followed by the consent screen listing the delegated permissions from Step 1. LiteLLM stores that user's token and refreshes it afterwards, so later sessions connect without prompting. `GET /v1/mcp/server/{server_id}/oauth-user-credential/status` shows whether the calling user has a stored token and when it expires, and `DELETE /v1/mcp/server/{server_id}/oauth-user-credential` revokes it.

***

## Tools provided

:::info
The server publishes its tool definitions at runtime through `tools/list`, so names and fields change between releases (version 0.155.0 lists 337 tools in organization mode). The **MCP Tools** tab in the LiteLLM UI is the source of truth for what your tenant exposes; it lists the live tools and lets you call one with test arguments. `npx -y @softeria/ms-365-mcp-server --list-permissions --org-mode` prints the Graph permission set behind the full tool list, and adding `--read-only` prints the read-only set.
:::

| Area | Tools (a sample) | Delegated permissions |
|---|---|---|
| Mail | `list-mail-messages`, `get-mail-message`, `list-mail-folders`, `list-mail-folder-messages`, `send-mail`, `forward-mail-message` | `Mail.Read` to read, `Mail.ReadWrite` and `Mail.Send` to write |
| Calendar | `list-calendars`, `get-calendar-view`, `list-calendar-events`, `find-meeting-times`, `create-calendar-event` | `Calendars.Read` to read, `Calendars.ReadWrite` to write |
| OneDrive | `list-drives`, `get-drive-root-item`, `list-folder-files`, `get-drive-item`, `upload-file-content`, `create-drive-item-share-link` | `Files.Read.All` to read, `Files.ReadWrite` to write |
| SharePoint | `search-sharepoint-sites`, `get-sharepoint-site`, `list-sharepoint-site-drives`, `list-sharepoint-site-items`, `list-sharepoint-site-lists`, `get-sharepoint-site-list` | `Sites.Read.All` to read, `Sites.ReadWrite.All` to write |
| Teams | `list-joined-teams`, `list-team-channels`, `list-channel-messages`, `list-chats`, `list-chat-messages`, `send-channel-message`, `send-chat-message` | `Team.ReadBasic.All`, `Channel.ReadBasic.All`, `ChannelMessage.Read.All`, `Chat.Read` to read; `ChannelMessage.Send`, `Chat.ReadWrite` to write |
| Planner and To Do | `list-planner-tasks`, `list-todo-task-lists`, `list-todo-tasks`, `create-planner-task`, `create-todo-task` | `Tasks.Read` to read, `Tasks.ReadWrite` to write |
| OneNote and Excel | `list-onenote-notebooks`, `list-onenote-pages`, `get-onenote-page-content`, `list-excel-worksheets`, `list-excel-tables`, `get-excel-range` | `Notes.Read` and `Files.Read.All` to read, `Notes.ReadWrite` and `Files.ReadWrite` to write |
| People and directory | `get-current-user`, `list-users`, `get-user-manager`, `list-outlook-contacts`, `list-groups`, `list-group-members` | `User.Read`, `User.Read.All`, `Contacts.Read`, `Group.Read.All`, `GroupMember.Read.All` |
| Cross-service | `search-query` (Graph search across mail, files, sites, and people), `graph-batch` (several Graph calls in one round trip) | Whatever the searched or batched resources need |

Every tool reaches an agent as `microsoft_365-<tool>` (see [Tool naming](../mcp_rest_api.md#tool-naming)). Three hundred tools is more than most agents want in one context, so pair the server with [Tool Search](../mcp_tool_search.md) or the [Semantic Filter](../mcp_semantic_filter.md), or run the server with `--enabled-tools`.

### Known limitations

The server calls Graph with any unexpired bearer token it receives and serves sign-in endpoints of its own, so it must only be reachable through the proxy. OneDrive tools return `itemNotFound` for a user whose OneDrive was never provisioned (they have not opened OneDrive or Office on the web yet); SharePoint document libraries are unaffected. `search-query` and `search-sharepoint-sites` take Graph search (KQL) syntax, so a bare `*` is rejected. Adding a permission to the app registration after users consented needs a fresh consent: revoke the stored credential with `DELETE /v1/mcp/server/{server_id}/oauth-user-credential` and sign in again. Entra access tokens last about an hour; LiteLLM refreshes them with the `offline_access` refresh token, so leaving that scope out means a sign-in prompt every hour.

***

:::info[Restrict who can use it]
Grant the server per key or per team with `object_permission`, and cap call volume per server with `mcp_rpm_limit`, both covered in [MCP Permission Management](../mcp_control.md). Graph applies its own per-user throttling, so a runaway agent slows that user's own Outlook and Teams clients before anyone else's.
:::

:::warning[Put the LiteLLM key in `x-litellm-api-key`]
Interactive OAuth needs the `Authorization` header free for the upstream token. If a client sends the LiteLLM API key as `Authorization: Bearer sk-...`, the OAuth flow never runs and LiteLLM forwards your LiteLLM key to the Graph server, which passes it to Microsoft, and Graph rejects it with `InvalidAuthenticationToken`. See [Debugging OAuth](../mcp_oauth.md#debugging-oauth) and the [MCP Troubleshooting Guide](../mcp_troubleshoot.md).
:::
