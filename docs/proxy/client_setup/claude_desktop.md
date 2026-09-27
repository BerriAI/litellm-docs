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
| MCP endpoint | `<LITELLM_PROXY_BASE_URL>/mcp`, or `<LITELLM_PROXY_BASE_URL>/<server_name>/mcp` for one server |
| MCP auth header | `x-litellm-api-key: Bearer <virtual key>` |

## LLM setup

### 1. Enable Developer Mode

In Claude Desktop, open **Help -> Troubleshooting -> Enable Developer Mode**.

<Image img={require('../../../img/client_setup/claude_desktop_01_enable_developer_mode.jpeg')} />

### 2. Open Configure Third-Party Inference

Open the Claude menu, click **Developer**, then **Configure Third-Party Inference...**

<Image img={require('../../../img/client_setup/claude_desktop_02_developer_menu.jpeg')} />

<Image img={require('../../../img/client_setup/claude_desktop_03_configure_third_party.jpeg')} />

### 3. Enter your gateway URL and virtual key

In the **Connection** section set **Inference provider** to **Gateway**, put your LiteLLM proxy URL in **Gateway base URL** and your virtual key in **Gateway API key**, and leave **Gateway auth scheme** at **bearer** (LiteLLM also accepts `x-api-key`). Click **Apply Changes** (called **Apply locally** in older versions).

<Image img={require('../../../img/client_setup/claude_desktop_04_gateway_url_and_key.jpeg')} />

Create the virtual key from the Admin UI under **Virtual Keys -> + Create New Key** if you do not have one. Scope it to the Claude models and give it a `max_budget`; everyone using the same key shares that budget.

<Image img={require('../../../img/client_setup/claude_desktop_05_create_virtual_key.jpeg')} />

### 4. Verify

Restart Claude Desktop. The model picker is built from `GET /v1/models` on your gateway and keeps the `model_name` values that contain `claude` or `anthropic`, so name your deployments accordingly. Start a task, then confirm the request in the Admin UI under **Logs** or **Usage**, attributed to your virtual key.

<Image img={require('../../../img/client_setup/claude_desktop_06_verify_usage.jpeg')} />

## MCP setup

The MCP screenshots below use Claude Desktop 2.2553.13 on Linux and a local demonstration gateway. Menu labels can differ by app version.

### 1. Add the gateway connector

Open **Configure Third-Party Inference** and find **Connectors**. Add a server named `litellm`, select **Streamable HTTP**, and enter `http://localhost:4000/mcp` as the URL. Replace the base URL with your gateway address. This endpoint exposes the servers your key can access.

Set the header `x-litellm-api-key` to `Bearer <your virtual key>`. Grant the key access to that MCP server as described in [the overview](./overview.md#the-values-you-will-reuse-everywhere). In the exported configuration, this is an entry in `managedMcpServers`:

```json
[
  {
    "name": "litellm",
    "transport": "http",
    "url": "http://localhost:4000/mcp",
    "headers": {"x-litellm-api-key": "Bearer sk-1234"}
  }
]
```

### 2. Test the connection

Click **Sign in & test** (called **Test this connection** in some versions). Claude runs MCP initialization and tool discovery with the URL and credentials you entered, then displays the discovered tools or a connection error. Check that the tools belong to the intended server before saving the configuration.

<Image img={require('../../../img/client_setup/claude_desktop_02_mcp_connector_connected_tools.png')} alt="Claude connector settings showing the LiteLLM MCP URL, a demonstration key, and three discovered tools" />

The screenshot uses the local demonstration key `sk-1234`; use your own virtual key. Claude may flag a static authentication header as credential-like. For managed deployments, the [advanced guide](../../tutorials/claude_desktop_cowork.md#mcp-servers-through-the-litellm-mcp-gateway) covers a credential helper instead.

### 3. Verify in Cowork

Apply the configuration and restart Claude Desktop. Start a Cowork task that uses a read-only tool from the connector, approve it if prompted, and check that the tool returns a result. Tools use the `<server>-<tool>` naming convention.

<Image img={require('../../../img/client_setup/claude_cowork_04_mcp_tool_result.png')} alt="Claude Cowork displaying a read-only DeepWiki tool result through the LiteLLM connector" />

To select one server, use `/<server_name>/mcp` instead. The [MCP configuration reference](../../mcp_config_reference.md) covers endpoint selection, server filtering, and authentication.

Claude Desktop's built-in connectors (`github`, `microsoft365`, `websearch`) run inside the app against those vendors' APIs and never pass through LiteLLM; only `url` entries do. For servers that need the user's own upstream login, set `"oauth": true` on the per-server URL and let LiteLLM run the flow; see [MCP OAuth passthrough](../../mcp_oauth_passthrough.md). The [full guide](../../tutorials/claude_desktop_cowork.md#mcp-servers-through-the-litellm-mcp-gateway) covers `headersHelper` for single sign-on fleets and per-tool policies.

## Next steps

[Claude Desktop (Cowork)](../../tutorials/claude_desktop_cowork.md) for SSO, model picker rules, fleet rollout, and troubleshooting; [Auto Router with Claude Code and Claude Desktop](../../tutorials/claude_code_autorouter.md); [MCP gateway reference](../../mcp.md).
