---
title: Client Setup
sidebar_label: Overview
---

import Image from '@theme/IdealImage';

# Connect a client to LiteLLM

Once your LiteLLM gateway is running, a coding tool or chat app connects to it in one of two ways, and each page in this section walks a specific client through both.

**LLM routing** points the client's model traffic at LiteLLM. The client keeps its normal interface, but every request flows through the gateway, so you get one API surface for 100+ models plus spend tracking, budgets, and guardrails. You need three values: the gateway base URL, a [virtual key](../virtual_keys.md), and a `model_name` from your config.

**MCP** connects the client to LiteLLM's [MCP gateway](../../mcp.md) so it can call the tools you expose there. The client reaches LiteLLM at an MCP endpoint and authenticates with a virtual key; LiteLLM fans out to the upstream MCP servers you registered and applies access control, cost tracking, and guardrails on the way.

## What each client supports

| Client | Surface | LLM routing | MCP |
|---|---|---|---|
| [Claude Code](./claude_code.md) | CLI | Yes | Yes |
| [Claude Desktop](./claude_desktop.md) | GUI | Yes | Yes |
| [Codex (ChatGPT Desktop)](./codex_chatgpt_desktop.md) | GUI | Yes | Yes |
| [Codex (CLI)](./codex_cli.md) | CLI | Yes | Yes |

## The values you will reuse everywhere

Create a virtual key from the Admin UI under **Virtual Keys -> + Create New Key**, or with `POST /key/generate`.

<Image img={require('../../../img/client_setup/claude_desktop_05_create_virtual_key.jpeg')} />

| Value | Where it comes from | Example |
|---|---|---|
| Gateway base URL | Where your proxy listens | `http://localhost:4000` |
| Virtual key | Admin UI: **Virtual Keys -> + Create New Key**, or `POST /key/generate` | `sk-1234` |
| Model name | A `model_name` under `model_list` in your config | `{{anthropic}}` |
| MCP endpoint | `<base URL>/mcp` for every server the key can see, or `<base URL>/<server_name>/mcp` for one | `http://localhost:4000/my_mcp_server/mcp` |
| MCP auth header | Your virtual key as a bearer token, in `Authorization` or `x-litellm-api-key` | `Authorization: Bearer sk-1234` |

LiteLLM accepts the virtual key on the MCP endpoint in either `Authorization: Bearer <key>` or `x-litellm-api-key: Bearer <key>`. Clients that only offer a bearer token setting (Codex, Claude Desktop) use `Authorization`; when you can set an arbitrary header (Claude Code, Cursor) prefer `x-litellm-api-key`, which leaves `Authorization` free for an upstream server's own OAuth token. See [MCP auth](../../mcp.md#using-your-mcp-with-client-side-credentials) for the full header table.

:::info Grant the key access to the MCP server

A virtual key only sees the MCP servers it has been granted. Without a grant the gateway answers `The key is not allowed to access the requested MCP servers: my_mcp_server`. Grant access on the key with `"object_permission": {"mcp_servers": ["my_mcp_server"]}` in `POST /key/generate`, on its team, or mark the server public with `allow_all_keys: true`. Details in [MCP access control](../../mcp_control.md).

:::

If you do not have a gateway running yet, start with [Deploy the Gateway -> Quickstart](../docker_quick_start.md), then come back here to connect your client.
