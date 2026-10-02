---
title: Client Setup
sidebar_label: Overview
---

import Image from '@theme/IdealImage';

# Connect a client to LiteLLM

Once your LiteLLM gateway is running, a coding tool or chat app can route model traffic through it. Each client authenticates with a virtual key or a sign-in token, depending on the client, and each page in this section walks through its setup

**LLM routing** points the client's model traffic at LiteLLM. The client keeps its normal interface, but every request flows through the gateway, so you get one API surface for 100+ models plus spend tracking, budgets, and guardrails. Set the gateway base URL and a `model_name` from your config, then use the credential supported by that client

**MCP** connects the client to LiteLLM's [MCP gateway](../../mcp.md) so it can call the tools you expose there. The client reaches LiteLLM at an MCP endpoint and authenticates with a virtual key; LiteLLM fans out to the upstream MCP servers you registered and applies access control, cost tracking, and guardrails on the way.

## What each client supports

| Client | Surface | LLM routing | MCP |
|---|---|---|---|
| [Claude Code](./claude_code.md) | CLI | Yes | Yes |
| [Claude Desktop](./claude_desktop.md) | GUI | Yes | Yes |
| [Codex (ChatGPT Desktop)](./codex_chatgpt_desktop.md) | GUI | Yes | Yes |
| [Codex (CLI)](./codex_cli.md) | CLI | Yes | Yes |

## Two credentials, two hops

A request through LiteLLM is authenticated twice. The client authenticates to LiteLLM with a virtual key or a sign-in token, which identifies the user and team and decides which models, budgets, and guardrails apply. LiteLLM then calls the provider with the credentials in its own `model_list`, so developers never hold OpenAI or Anthropic keys and their personal Claude or ChatGPT subscriptions are not used

Billing a user's own subscription is a separate, opt-in setup: [Claude Code Max](../../tutorials/claude_code_max_subscription.md) and [BYOK](../../tutorials/claude_code_byok.md) forward the user's Anthropic credential upstream, and the [ChatGPT subscription provider](../../providers/chatgpt.md) routes models through a ChatGPT login on the proxy

## Choose how users sign in

| Client | Static key | Sign-in, no per-user key | One-command setup |
|---|---|---|---|
| Claude Code | Virtual key in `ANTHROPIC_AUTH_TOKEN` | [Claude Code Gateway](../../tutorials/claude_code_gateway.md) device login, [`lite auth print-token`](../cli_sso.md) as `apiKeyHelper`, or an [IdP JWT helper](../../tutorials/claude_code_okta_sso.md) | `lite configure claude` |
| Claude Desktop | Gateway API key | [Interactive OIDC](../../tutorials/claude_desktop_cowork.md) | None |
| Codex CLI | Virtual key via `env_key` | [`lite auth print-token` as the provider `auth` command](./codex_cli.md#sign-in-with-litellm-sso) | `lite configure codex` |
| Codex in ChatGPT Desktop | Virtual key via `env_key` and `~/.codex/.env` | Same `auth` command, since the app reads the same `config.toml` | Same as Codex CLI |

[`lite configure`](../../auto_router/user_setup.md) writes the supplied credential into the client's config file. For Codex, it goes in `config.toml` as a plaintext `Authorization: Bearer` header under `http_headers`, with no `env_key`, so use the sign-in options above when long-lived keys should not sit on disk

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

LiteLLM accepts the virtual key on the MCP endpoint in either `Authorization: Bearer <key>` or `x-litellm-api-key: Bearer <key>`. When configuring a bearer token setting, use your virtual key; the client sends it in `Authorization`. When configuring custom headers, prefer `x-litellm-api-key`, which leaves `Authorization` free for an upstream server's own OAuth token. See the [MCP configuration reference](../../mcp_config_reference.md) for endpoint and header selection.

:::info Grant the key access to the MCP server

A virtual key only sees the MCP servers it has been granted. Without a grant the gateway answers `The key is not allowed to access the requested MCP servers: my_mcp_server`. Grant access on the key with `"object_permission": {"mcp_servers": ["my_mcp_server"]}` in `POST /key/generate`, on its team, or mark the server public with `allow_all_keys: true`. Details in [MCP access control](../../mcp_control.md).

:::

If you do not have a gateway running yet, start with [Deploy the Gateway -> Quickstart](../docker_quick_start.md), then come back here to connect your client.
