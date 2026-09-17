---
title: Codex (ChatGPT Desktop)
sidebar_label: Codex (ChatGPT Desktop)
---

# Connect Codex in ChatGPT Desktop to LiteLLM

Codex ships as a panel inside the [ChatGPT desktop app](https://openai.com/chatgpt/download/). It reads the same `~/.codex/config.toml` as the [Codex CLI](./codex_cli.md), so pointing the desktop Codex at LiteLLM means editing that file and then launching Codex from the app.

:::note

This is the Codex coding surface embedded in ChatGPT Desktop. The ChatGPT chat app itself has no setting for a custom API endpoint; it only talks to OpenAI's hosted models. LiteLLM integration for this surface goes through Codex's config file, described below.

:::

## Quick reference

| Setting | Value |
|---|---|
| Config file | `~/.codex/config.toml` (shared with the CLI) |
| `base_url` | `<LITELLM_PROXY_BASE_URL>/v1` (e.g. `http://localhost:4000/v1`) |
| Provider key | Your LiteLLM [virtual key](../virtual_keys.md), read from the env var named in `env_key` |
| MCP endpoint | `<LITELLM_PROXY_BASE_URL>/<server_name>/mcp` |
| MCP auth | The same virtual key, read from the env var named in `bearer_token_env_var` |

## LLM setup

### 1. Add LiteLLM as a model provider

Edit `~/.codex/config.toml` and add a provider block pointing at your gateway's Responses API endpoint. This is identical to the [CLI setup](./codex_cli.md#llm-setup):

```toml title="~/.codex/config.toml"
model = "{{anthropic}}"
model_provider = "litellm"

[model_providers.litellm]
name = "LiteLLM"
base_url = "http://localhost:4000/v1"
env_key = "LITELLM_API_KEY"
wire_api = "responses"
```

Set the virtual key in your environment before launching ChatGPT Desktop so the Codex panel inherits it:

```bash
export LITELLM_API_KEY="sk-1234"
```

On macOS, an app launched from Finder or the Dock does not inherit variables exported in your shell profile, so the key can be missing here even though `codex` works in your terminal. Either launch the app from a shell that has the variable (`open -a "ChatGPT"`), or set it at the login session level and restart the app:

```bash
launchctl setenv LITELLM_API_KEY sk-1234
```

### 2. Launch Codex in ChatGPT Desktop

Open the ChatGPT desktop app and switch to the Codex panel. Codex loads the provider from `config.toml`; because this is a custom provider it skips the "Sign in with ChatGPT" step and uses your LiteLLM key instead. Start a task.

### 3. Verify

Run a task, then check the Admin UI under **Logs** or **Usage**; the request should be attributed to your virtual key.

:::note

With a custom model provider the app has no UI for changing the model of a running session (see [openai/codex#15364](https://github.com/openai/codex/issues/15364)). A session uses whatever `model` was set in `config.toml` when it was created, so to switch models, update `model` and start a new session.

:::

## MCP setup

MCP is configured in the same `~/.codex/config.toml`, so the [CLI's MCP setup](./codex_cli.md#mcp-setup) applies unchanged. Add:

```toml title="~/.codex/config.toml"
[mcp_servers.litellm]
url = "http://localhost:4000/my_mcp_server/mcp"
bearer_token_env_var = "LITELLM_API_KEY"
```

where `my_mcp_server` matches a key under `mcp_servers:` in your gateway config and the key has access to that server. `LITELLM_API_KEY` has to be visible to the app, so the same `launchctl setenv` note as above applies. Restart ChatGPT Desktop so the Codex panel reloads the config.

## Next steps

[Codex CLI](./codex_cli.md) shares this config file. See also [LiteLLM virtual keys](../virtual_keys.md) and the [MCP gateway reference](../../mcp.md).
