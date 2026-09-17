---
title: Codex (CLI)
sidebar_label: Codex (CLI)
---

import Image from '@theme/IdealImage';

# Connect Codex CLI to LiteLLM

[Codex](https://github.com/openai/codex) reads all of its configuration from `~/.codex/config.toml`. You define LiteLLM as a custom model provider there and register the [MCP gateway](../../mcp.md) in the same file. This is the same config the [Codex surface inside ChatGPT Desktop](./codex_chatgpt_desktop.md) uses, so setting it up once covers both.

## Quick reference

| Setting | Value |
|---|---|
| Config file | `~/.codex/config.toml` |
| `base_url` | `<LITELLM_PROXY_BASE_URL>/v1` (e.g. `http://localhost:4000/v1`) |
| Provider key | Your LiteLLM [virtual key](../virtual_keys.md), read from the env var named in `env_key` |
| MCP endpoint | `<LITELLM_PROXY_BASE_URL>/<server_name>/mcp` |
| MCP auth | The same virtual key, read from the env var named in `bearer_token_env_var` |

## LLM setup

### 1. Install Codex

```bash
npm i -g @openai/codex
```

Or with the official installer:

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

### 2. Define LiteLLM as a model provider

Codex uses the OpenAI Responses API, which LiteLLM serves at `/v1/responses`. Add a provider block to `~/.codex/config.toml` and select it as the default. `env_key` names the environment variable Codex reads your virtual key from, so no secret is stored in the file:

```toml title="~/.codex/config.toml"
model = "{{anthropic}}"
model_provider = "litellm"

[model_providers.litellm]
name = "LiteLLM"
base_url = "http://localhost:4000/v1"
env_key = "LITELLM_API_KEY"
wire_api = "responses"
```

Long agent turns can idle for minutes behind a gateway, so raise the stream timeout and retries if tasks are cut short:

```toml title="~/.codex/config.toml"
[model_providers.litellm]
stream_idle_timeout_ms = 7200000
stream_max_retries = 5
request_max_retries = 4
```

Export the key, then run Codex:

```bash
export LITELLM_API_KEY="sk-1234"

codex
```

`model` can be any `model_name` from your LiteLLM config. Override it per run with `codex --model {{gemini_pro}}`. Codex only knows the metadata of OpenAI's own models, so with a gateway name it prints `Model metadata for ... not found. Defaulting to fallback metadata` on the first request; requests still go through.

Codex shows the model in its startup header and routes the task through the gateway. Here Codex 0.154 is answering through a local gateway:

<Image img={require('../../../img/client_setup/codex_cli_llm.png')} />

### 3. Verify

Ask Codex to make a small change, then check the Admin UI under **Logs** or **Usage**; the request appears under `/v1/responses`, attributed to your virtual key and the model you selected.

## MCP setup

Register the LiteLLM MCP gateway as a streamable HTTP server in the same `~/.codex/config.toml`. Codex reads the bearer token from an environment variable rather than from the file, so reuse the one you already exported for the model provider:

```toml title="~/.codex/config.toml"
[mcp_servers.litellm]
url = "http://localhost:4000/my_mcp_server/mcp"
bearer_token_env_var = "LITELLM_API_KEY"
```

`my_mcp_server` must match a key under `mcp_servers:` in your gateway config, and the key needs access to that server (see [the overview](./overview.md#the-values-you-will-reuse-everywhere)). Codex sends the key as `Authorization: Bearer <key>`, which the gateway accepts. Start `codex` and run `/mcp`: the server shows as `connected` with its tool count, and `/mcp verbose` lists the tools prefixed with the server name (`my_mcp_server-read_wiki_structure`) and `Auth: Bearer token`.

<Image img={require('../../../img/client_setup/codex_cli_mcp.png')} />

A literal `bearer_token = "..."` in the server block fails on current Codex with `bearer_token is not supported for streamable_http`; use `bearer_token_env_var`. If the server does not show up at all, you are on an older Codex build that ignores remote MCP servers unless `experimental_use_rmcp_client = true` is set under `[features]`; upgrade Codex instead.

For a LiteLLM server that fronts an upstream OAuth provider, run `codex mcp login litellm` to complete the flow instead of setting a static token; see [MCP OAuth](../../mcp_oauth.md).

## Troubleshooting

Connection refused means the gateway is not reachable at the `base_url` you set; check the host, port, and the `/v1` suffix. A 401 from the gateway means `LITELLM_API_KEY` is not exported in the shell you launch `codex` from, or the key is no longer valid. `Invalid model name passed in` means `model` does not match a `model_name` in your gateway config; use your name, not the upstream provider's. If requests never appear in the Admin UI you are still on the default provider, so confirm `model_provider = "litellm"` is set at the top level of the file.

## Next steps

[Codex in ChatGPT Desktop](./codex_chatgpt_desktop.md) uses this same config file. See also [LiteLLM virtual keys](../virtual_keys.md) and the [MCP gateway reference](../../mcp.md).
