---
title: LiteAdmin MCP
sidebar_label: Connect Claude or Codex
description: Connect Claude Desktop, Claude Code, or Codex to your LiteLLM gateway with LiteAdmin MCP.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LiteAdmin MCP

Use **LiteAdmin MCP** ([LiteLLM Admin MCP](https://github.com/BerriAI/litellm-admin-mcp)) to manage your gateway from Claude, Codex, or another MCP client. You can ask your agent to:

- Create and manage virtual keys.
- Add model deployments.
- Manage teams, members, and budgets.
- Check spending, activity, and request logs.

Your client runs the agent and model. The MCP server calls your gateway's management API with your personal admin credential. Connecting it leaves your client's model-provider settings unchanged.

For gateway management in Slack, follow the [LiteAdmin Slack app setup](./liteadmin_slack.md). To route third-party MCP tools through LiteLLM, see the separate [MCP Gateway](../mcp.md) guide.

## Before you start

You need a running LiteLLM gateway and a personal [virtual key](./virtual_keys.md) belonging to a user with the [`proxy_admin` role](./access_control.md#global-proxy-roles). The connector requires this role for **all tools, including reads**; `proxy_admin_viewer` and team-admin accounts cannot use it.

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) on the computer that runs your MCP client. The connector requires Python 3.12 or later; uv can download a compatible interpreter. {/* keep-python-version */}

Have these values ready:

| Setting | Value |
| --- | --- |
| `LITELLM_BASE_URL` | Your gateway's HTTPS origin, such as `https://gateway.example.com`. An optional `/v1` suffix is accepted. |
| `LITELLM_API_KEY` | Your personal proxy-admin key. |

The computer running the connector must reach your gateway's `/openapi.json` and management APIs. Use HTTPS except for local loopback development.

## Connect your client

Choose your client below and replace the gateway URL and key placeholders. Keep configurations containing keys private and out of version control. Use your client's secret storage when available.

<Tabs groupId="liteadmin-client">
<TabItem value="claude-desktop" label="Claude Desktop" default>

Open **Settings → Developer → Edit Config** in Claude Desktop. Add the `litellm-admin` entry under `mcpServers`, preserving any existing servers:

```json title="claude_desktop_config.json"
{
  "mcpServers": {
    "litellm-admin": {
      "command": "uvx",
      "args": [
        "--isolated",
        "--refresh-package",
        "litellm-admin-mcp",
        "--from",
        "git+https://github.com/BerriAI/litellm-admin-mcp.git@main",
        "litellm-admin-mcp"
      ],
      "env": {
        "LITELLM_BASE_URL": "https://gateway.example.com",
        "LITELLM_API_KEY": "<your-personal-proxy-admin-key>"
      }
    }
  }
}
```

Quit and reopen Claude Desktop. Open **+ → Connectors** in a new chat to check for `litellm-admin` and its tools. Developer settings also show connection status and logs.

If Claude cannot find `uvx`, replace `"command": "uvx"` with its absolute path. Run `which uvx` on macOS or `where uvx` on Windows to find it. In JSON, escape Windows backslashes as `\\`.

See the [manual Claude Desktop configuration guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers) for config-file locations.

</TabItem>
<TabItem value="claude-code" label="Claude Code">

Run this in your terminal:

```bash
claude mcp add --scope user --transport stdio litellm-admin \
  --env LITELLM_BASE_URL=https://gateway.example.com \
  --env LITELLM_API_KEY='<your-personal-proxy-admin-key>' \
  -- uvx --isolated --refresh-package litellm-admin-mcp \
  --from git+https://github.com/BerriAI/litellm-admin-mcp.git@main \
  litellm-admin-mcp
```

The `--scope user` option makes the connection available across your projects and stores it in your private Claude configuration. Your shell may also retain the command in its history.

Restart Claude Code and run `/mcp` to check the connection. You can also inspect it from the terminal:

```bash
claude mcp get litellm-admin
```

See [Claude Code's MCP documentation](https://code.claude.com/docs/en/mcp) for configuration scopes and client troubleshooting.

</TabItem>
<TabItem value="codex" label="Codex">

Add this server to your existing `~/.codex/config.toml`:

```toml title="~/.codex/config.toml"
[mcp_servers.litellm-admin]
command = "uvx"
args = [
  "--isolated",
  "--refresh-package", "litellm-admin-mcp",
  "--from", "git+https://github.com/BerriAI/litellm-admin-mcp.git@main",
  "litellm-admin-mcp"
]
startup_timeout_sec = 60

[mcp_servers.litellm-admin.env]
LITELLM_BASE_URL = "https://gateway.example.com"
LITELLM_API_KEY = "<your-personal-proxy-admin-key>"
```

Local Codex clients share this configuration on the same host. Restart your client to load the server. In Codex CLI, run `/mcp` to inspect the active connection and tools; `codex mcp list` lists configured servers.

For terminal use, you can keep the key out of this file: remove the `LITELLM_API_KEY` assignment, add `env_vars = ["LITELLM_API_KEY"]` to the server table above the `.env` table, and export the variable before launching `codex`. A desktop app must also have access to that environment variable to use this option.

See the [official Codex MCP documentation](https://developers.openai.com/codex/mcp) for supported configuration fields.

</TabItem>
</Tabs>

These examples check the connector's GitHub `main` branch each time the client starts the server. Restart the connection after an update. For a fixed version, replace `@main` with a release tag or full commit SHA and remove `--refresh-package` and the `litellm-admin-mcp` argument immediately after it.

## Verify the connection

Start with a read request:

> Use LiteAdmin to list my teams and their current budgets.

Check that the client calls an admin tool and returns data from your gateway. An empty team list is a valid result if you have no teams. Connecting to the MCP server alone does not verify gateway access.

Once the read succeeds, you can request changes such as:

- “Create a key for Engineering with a $100 monthly budget.”
- “Update the Engineering team's monthly budget to $500.”

Use names and limits that match your intended change. The gateway enforces the caller's permissions and feature entitlements. After a write times out, inspect the affected key, team, or model before retrying.

### Add a model deployment

Your gateway needs a database, `STORE_MODEL_IN_DB=True`, and provider authentication for [model management](./model_management.md). Include the public model name, exact provider/model ID, and a stored credential name or gateway environment-variable reference in your request. For example:

> Add a model named support-chat using openai/gpt-4.1 and the existing gateway credential openai-production.

Use a provider/model ID and credential that exist in your deployment. Keep provider API keys out of chat. Adding a gateway deployment does not provision provider access or test inference.

## Restrict the available tools

Set these variables in the MCP server's environment, then restart the connection:

| Variable | Effect |
| --- | --- |
| `LITELLM_ADMIN_READ_ONLY=true` | Expose only reviewed read operations. A `proxy_admin` identity is still required. |
| `LITELLM_ADMIN_TOOLS=list_keys,list_teams` | Limit the server to these canonical tool names. |

The connector discovers schemas from your gateway and exposes the reviewed operations available there. Use the [operation catalog](https://github.com/BerriAI/litellm-admin-mcp/blob/main/src/litellm_admin_mcp/operations.json) to find tool names. If you set both restrictions, only tools allowed by both remain available.

## Host a shared MCP endpoint

Use Streamable HTTP when you want to run the connector on a server instead of each user's computer. Install uv on that host, then run:

```bash
export LITELLM_BASE_URL=https://gateway.example.com
export LITELLM_MCP_PUBLIC_URL=https://admin-mcp.example.com
uvx --isolated --refresh-package litellm-admin-mcp \
  --from git+https://github.com/BerriAI/litellm-admin-mcp.git@main \
  litellm-admin-mcp --transport streamable-http --port 8080
```

Put an HTTPS reverse proxy in front of `127.0.0.1:8080` and forward to it from `admin-mcp.example.com`. The client endpoint is `https://admin-mcp.example.com/mcp`. Set `LITELLM_MCP_PUBLIC_URL` to that public origin without the `/mcp` path so the connector accepts its Host and Origin headers.

**Leave `LITELLM_API_KEY` unset on the hosted service.** Each client sends its own personal proxy-admin key. Run one installation per trusted gateway and connect only to a connector you operate and trust.

Configure your client with one of these alternatives to the local setup:

<Tabs groupId="liteadmin-http-client">
<TabItem value="claude-code" label="Claude Code" default>

```bash
claude mcp add --scope user --transport http litellm-admin-remote \
  https://admin-mcp.example.com/mcp \
  --header 'Authorization: Bearer <your-personal-proxy-admin-key>'
```

Restart Claude Code and run `/mcp` to check the connection. This command saves the header in your private client configuration; your shell may retain it in history.

</TabItem>
<TabItem value="codex" label="Codex">

```toml title="~/.codex/config.toml"
[mcp_servers.litellm-admin-remote]
url = "https://admin-mcp.example.com/mcp"
bearer_token_env_var = "LITELLM_API_KEY"
```

Set `LITELLM_API_KEY` in the environment of the Codex process. For Codex CLI:

```bash
export LITELLM_API_KEY='<your-personal-proxy-admin-key>'
codex
```

Run `/mcp` to check the connection.

</TabItem>
</Tabs>

This endpoint uses bearer API-key authentication. It does not provide browser OAuth login, so `codex mcp login` and OAuth-only connector forms do not apply. Use the local configuration above for Claude Desktop.

Check `/healthz` for process health, then repeat the read request to verify gateway access. A healthy process does not prove that its gateway URL, credential, or management APIs work.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `uvx` not found | Install uv and use the executable's absolute path in desktop clients. |
| Startup timeout | Allow the first package/Python download to finish; check access to GitHub and package downloads. Increase the client's startup timeout if needed. |
| Unauthorized or forbidden | Use an active personal key owned by a `proxy_admin`. Read-only mode does not grant access to other roles. |
| Missing tools or schema discovery failure | Check access to `/openapi.json` and the gateway's management routes. Update the connector if an operation ID changed. |
| Model creation fails | Check the database, `STORE_MODEL_IN_DB`, exact provider/model ID, and gateway credentials. |
| Hosted connection rejected | Check the `/mcp` URL, bearer header, HTTPS proxy, and `LITELLM_MCP_PUBLIC_URL`. |
| Write times out | Inspect gateway state before retrying; the connector does not retry tool calls. |

See the [connector repository](https://github.com/BerriAI/litellm-admin-mcp) for result paging, schema-discovery options, and Docker hosting.
