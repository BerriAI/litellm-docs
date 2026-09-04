---
title: Claude Desktop (GUI)
sidebar_label: Claude Desktop (GUI)
---

import Image from '@theme/IdealImage';

# Connect Claude Desktop to LiteLLM

[Claude Desktop](https://claude.ai/download) can route its model traffic through LiteLLM using third-party inference, and reach your [MCP gateway](../../mcp.md) tools through a local bridge. Everything is configured from the app.

## Quick reference

| Setting | Value |
|---|---|
| Gateway URL | `<LITELLM_PROXY_BASE_URL>` (e.g. `http://localhost:4000`) |
| API Key | Your LiteLLM [virtual key](../virtual_keys.md) |
| MCP endpoint | `<LITELLM_PROXY_BASE_URL>/<server_name>/mcp` |
| MCP auth header | `x-litellm-api-key: Bearer <virtual key>` |

## LLM setup

### 1. Enable Developer Mode

In Claude Desktop, go to **Help -> Claude -> Help** and click **Enable Developer Mode**.

<Image img={require('../../../img/client_setup/claude_desktop_01_enable_developer_mode.jpeg')} />

### 2. Open Configure Third-Party Inference

Open the Claude menu from the menu bar icon, click **Developer**, then **Configure Third-Party Inference...**

<Image img={require('../../../img/client_setup/claude_desktop_02_developer_menu.jpeg')} />

<Image img={require('../../../img/client_setup/claude_desktop_03_configure_third_party.jpeg')} />

### 3. Enter your gateway URL and virtual key

In the inference settings dialog, put your LiteLLM proxy URL in **Gateway URL** and your virtual key in **API Key**, then save.

<Image img={require('../../../img/client_setup/claude_desktop_04_gateway_url_and_key.jpeg')} />

Create the virtual key from the Admin UI under **Virtual Keys -> + Create New Key** if you don't have one.

<Image img={require('../../../img/client_setup/claude_desktop_05_create_virtual_key.jpeg')} />

### 4. Verify

Restart Claude Desktop, open a new conversation, and send a message. Confirm the request appears in the Admin UI under **Usage**, attributed to your virtual key.

<Image img={require('../../../img/client_setup/claude_desktop_06_verify_usage.jpeg')} />

## MCP setup

Claude Desktop's native **Custom Connectors** (Settings -> Connectors) only support OAuth or authless remote servers, not custom headers. Because LiteLLM authenticates with the `x-litellm-api-key` header, connect through the [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge, which Claude Desktop runs locally and which forwards your header to the gateway.

Open **Settings -> Developer -> Edit Config** (this opens `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS) and add:

```json title="claude_desktop_config.json"
{
  "mcpServers": {
    "litellm-tools": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://your-litellm-proxy.com/my_mcp_server/mcp",
        "--header",
        "x-litellm-api-key:Bearer sk-1234"
      ]
    }
  }
}
```

`my_mcp_server` must match a key under `mcp_servers:` in your gateway config. Save the file and restart Claude Desktop; the server's tools appear in the tools menu.

:::info

Claude Desktop can block `localhost` MCP URLs. For anything beyond a quick local test, front your gateway with an HTTPS URL (a tunnel such as ngrok or Cloudflare Tunnel works). When LiteLLM fronts an upstream server that uses OAuth, add it through the native Custom Connectors UI instead and let LiteLLM handle the flow; see [MCP OAuth](../../mcp_oauth.md).

:::

<!-- SCREENSHOT NEEDED: claude_desktop_mcp.png -- capture Claude Desktop's Settings -> Connectors (or the tools menu in a conversation) showing the litellm server connected -->

## Next steps

- [Auto Router with Claude Code and Claude Desktop](../../tutorials/claude_code_autorouter.md)

- [LiteLLM virtual keys](../virtual_keys.md)
- [MCP gateway reference](../../mcp.md)
