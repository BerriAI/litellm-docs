---
title: Client Setup
sidebar_label: Overview
---

import Image from '@theme/IdealImage';

# Connect a client to LiteLLM

Once your LiteLLM gateway is running, most tools connect to it in one of two ways. Every page in this section walks a specific client through whichever of these apply to it.

**LLM routing** points the client's model traffic at LiteLLM. The client keeps its normal chat/agent interface, but every request now flows through the gateway, so you get one API surface for 100+ models, spend tracking, budgets, and guardrails. You need three values: the gateway base URL, a [virtual key](../virtual_keys.md), and a public model name from your config.

**MCP** connects the client to LiteLLM's [MCP gateway](../../mcp.md) so it can call the tools you expose there. The client reaches LiteLLM at an MCP endpoint and authenticates with a virtual key; LiteLLM fans out to the upstream MCP servers you registered, applying auth, cost tracking, and guardrails on the way.

## What each client supports

| Client | Surface | LLM routing | MCP |
|---|---|---|---|
| [Claude Code](./claude_code.md) | CLI | Yes | Yes |
| [Claude Desktop](./claude_desktop.md) | GUI | Yes | Yes |
| [Codex (ChatGPT Desktop)](./codex_chatgpt_desktop.md) | GUI | Yes | Yes |
| [Codex (CLI)](./codex_cli.md) | CLI | Yes | Yes |

## The values you'll reuse everywhere

Create a virtual key from the Admin UI under **Virtual Keys -> + Create New Key**:

<Image img={require('../../../img/client_setup/claude_desktop_05_create_virtual_key.jpeg')} />

| Value | Where it comes from | Example |
|---|---|---|
| Gateway base URL | Where your proxy listens | `http://localhost:4000` |
| Virtual key | Admin UI: **Virtual Keys -> + Create New Key**, or `POST /key/generate` | `sk-1234` |
| Model name | The `model_name` you set under `model_list` in your config | `claude-sonnet-5` |
| MCP endpoint | `<base URL>/mcp` for all servers, or `<base URL>/<server_name>/mcp` for one | `http://localhost:4000/mcp` |
| MCP auth header | Your virtual key, sent as `x-litellm-api-key` | `x-litellm-api-key: Bearer sk-1234` |

:::info

`Authorization` on the MCP endpoint is reserved for upstream OAuth flows. Send your LiteLLM virtual key as `x-litellm-api-key` so it doesn't collide with an upstream server's own `Authorization` header. See [MCP auth](../../mcp.md) for the full header table.

:::

If you don't have a gateway running yet, start with [Deploy the Gateway -> Quickstart](../docker_quick_start.md), then come back here to connect your client.
