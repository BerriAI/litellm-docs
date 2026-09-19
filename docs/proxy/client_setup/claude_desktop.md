---
title: Claude Desktop (GUI)
sidebar_label: Claude Desktop (GUI)
---

import Image from '@theme/IdealImage';

# Connect Claude Desktop to LiteLLM

[Claude Desktop](https://claude.ai/download) on third-party inference sends every model call from Cowork, Chat, and Code sessions to a gateway you name, and reaches MCP servers through the same gateway. This page is the quickest path: one device, a static virtual key, configured from the app. For single sign-on through your identity provider, the model picker rules, and rolling the configuration out to a fleet, see [Claude Desktop (Cowork)](../../tutorials/claude_desktop_cowork.md).

## Quick reference

| Setting | Value |
|---|---|
| Inference provider | **Gateway** |
| Gateway base URL | `<LITELLM_PROXY_BASE_URL>` (e.g. `http://localhost:4000`) |
| Gateway API key | Your LiteLLM [virtual key](../virtual_keys.md), auth scheme **Bearer** |
| MCP endpoint | `<LITELLM_PROXY_BASE_URL>/mcp`, or `<LITELLM_PROXY_BASE_URL>/mcp/<server_name>` for one server |
| MCP auth header | `Authorization: Bearer <virtual key>` |

## LLM setup

### 1. Enable Developer Mode

In Claude Desktop, open **Help -> Troubleshooting -> Enable Developer Mode**.

<Image img={require('../../../img/client_setup/claude_desktop_01_enable_developer_mode.jpeg')} />

### 2. Open Configure Third-Party Inference

Open the Claude menu, click **Developer**, then **Configure Third-Party Inference...**

<Image img={require('../../../img/client_setup/claude_desktop_02_developer_menu.jpeg')} />

<Image img={require('../../../img/client_setup/claude_desktop_03_configure_third_party.jpeg')} />

### 3. Enter your gateway URL and virtual key

In the **Connection** section set **Inference provider** to **Gateway**, put your LiteLLM proxy URL in **Gateway base URL** and your virtual key in **Gateway API key**, and leave **Gateway auth scheme** at **bearer** (LiteLLM also accepts `x-api-key`). Click **Apply locally**.

<Image img={require('../../../img/client_setup/claude_desktop_04_gateway_url_and_key.jpeg')} />

Create the virtual key from the Admin UI under **Virtual Keys -> + Create New Key** if you do not have one. Scope it to the Claude models and give it a `max_budget`; everyone using the same key shares that budget.

<Image img={require('../../../img/client_setup/claude_desktop_05_create_virtual_key.jpeg')} />

### 4. Verify

Restart Claude Desktop. The model picker is built from `GET /v1/models` on your gateway and keeps the `model_name` values that contain `claude` or `anthropic`, so name your deployments accordingly. Start a task, then confirm the request in the Admin UI under **Logs** or **Usage**, attributed to your virtual key.

<Image img={require('../../../img/client_setup/claude_desktop_06_verify_usage.jpeg')} />

## MCP setup

Claude Desktop on third-party inference takes MCP servers as `managedMcpServers` entries, and the gateway becomes one entry: the virtual key travels in the entry's headers as a bearer token. The **Connectors** section of the same configuration window has a form for each server (name, transport, URL, headers) and a **Test this connection** button that runs `initialize` and `tools/list` against it. In the exported configuration the entry looks like this:

```json
[
  {
    "name": "litellm",
    "transport": "http",
    "url": "http://localhost:4000/mcp",
    "headers": {"Authorization": "Bearer sk-1234", "x-mcp-servers": "my_mcp_server"}
  }
]
```

`x-mcp-servers` narrows the entry to specific servers; `my_mcp_server` must match a key under `mcp_servers:` in your gateway config, and the per-server path `http://localhost:4000/mcp/my_mcp_server` does the same without the header. The key needs access to the server (see [the overview](./overview.md#the-values-you-will-reuse-everywhere)); the tools then appear as `<server>-<tool>` in a session.

Claude Desktop's built-in connectors (`github`, `microsoft365`, `websearch`) run inside the app against those vendors' APIs and never pass through LiteLLM; only `url` entries do. For servers that need the user's own upstream login, set `"oauth": true` on the per-server URL and let LiteLLM run the flow; see [MCP OAuth passthrough](../../mcp_oauth_passthrough.md). The [full guide](../../tutorials/claude_desktop_cowork.md#mcp-servers-through-the-litellm-mcp-gateway) covers `headersHelper` for single sign-on fleets and per-tool policies.

## Next steps

[Claude Desktop (Cowork)](../../tutorials/claude_desktop_cowork.md) for SSO, model picker rules, fleet rollout, and troubleshooting; [Auto Router with Claude Code and Claude Desktop](../../tutorials/claude_code_autorouter.md); [MCP gateway reference](../../mcp.md).
