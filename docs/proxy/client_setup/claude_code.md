---
title: Claude Code (CLI)
sidebar_label: Claude Code (CLI)
---

import Image from '@theme/IdealImage';

# Connect Claude Code to LiteLLM

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) talks to the Anthropic Messages API. LiteLLM serves that format at `/v1/messages`, so two environment variables point Claude Code at the gateway and it works against any model in your config, not just Anthropic's.

## Quick reference

| Setting | Value |
|---|---|
| `ANTHROPIC_BASE_URL` | `<LITELLM_PROXY_BASE_URL>` (e.g. `http://localhost:4000`) |
| `ANTHROPIC_AUTH_TOKEN` | Your LiteLLM [virtual key](../virtual_keys.md) |
| `ANTHROPIC_MODEL` | A `model_name` from your config |
| MCP endpoint | `<LITELLM_PROXY_BASE_URL>/<server_name>/mcp` |
| MCP auth header | `x-litellm-api-key: Bearer <virtual key>` |

## LLM setup

### 1. Point Claude Code at the gateway

Export the base URL, your virtual key, and the model, then launch Claude Code:

```bash
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_AUTH_TOKEN="sk-1234"
export ANTHROPIC_MODEL="{{anthropic}}"

claude
```

Claude Code sends every request to LiteLLM's `/v1/messages` endpoint with your virtual key as the bearer token. To make this permanent, add the exports to your shell profile (`~/.zshrc`, `~/.bashrc`) or to the `env` block of Claude Code's `settings.json`. If `ANTHROPIC_API_KEY` is also set in your shell, unset it for this session so Claude Code does not send it instead of the virtual key.

### 2. Pick a model

Claude Code sends whatever model id is selected, so that id has to exist as a `model_name` on your gateway. `ANTHROPIC_MODEL` pins the default to one of your names. The `/model` picker inside a session still lists Anthropic's own ids (for example `claude-haiku-4-5-20251001`), so choosing one there fails with `Invalid model name passed in` unless your config also defines that exact name; either add those names to `model_list` or keep switching models through `ANTHROPIC_MODEL`. [Route Claude Code to non-Anthropic models](../../tutorials/claude_non_anthropic_models.md) covers mapping the Sonnet, Opus, and Haiku tiers to any provider.

### 3. Verify

Send a prompt. Here Claude Code 2.1 is answering through a local gateway with `ANTHROPIC_MODEL` set to a model from `model_list`:

<Image img={require('../../../img/client_setup/claude_code_llm.png')} />

Then confirm the traffic in the Admin UI under **Logs** or **Usage**, attributed to your virtual key and the model you chose.

## MCP setup

Expose your LiteLLM [MCP gateway](../../mcp.md) tools inside Claude Code with `claude mcp add`. The URL is `<LITELLM_PROXY_BASE_URL>/<server_name>/mcp`, where `<server_name>` matches a key under `mcp_servers:` in your gateway config, and the virtual key goes in the `x-litellm-api-key` header:

```bash
claude mcp add --transport http litellm-tools \
  http://localhost:4000/my_mcp_server/mcp \
  --header "x-litellm-api-key: Bearer sk-1234"
```

| Part | Meaning |
|---|---|
| `litellm-tools` | The name for this server inside Claude Code; choose anything |
| `http://localhost:4000/my_mcp_server/mcp` | `<PROXY_URL>/<server_name>/mcp`; `my_mcp_server` must match the key under `mcp_servers:` on the gateway |
| `--header "x-litellm-api-key: Bearer sk-1234"` | Your virtual key, authenticating you to the gateway |

The key needs access to `my_mcp_server` (see [the overview](./overview.md#the-values-you-will-reuse-everywhere)); otherwise the gateway rejects the connection with `The key is not allowed to access the requested MCP servers`. Start Claude Code and run `/mcp`: the server shows as connected with its tools listed, prefixed with the server name (`my_mcp_server-read_wiki_structure`).

<Image img={require('../../../img/client_setup/claude_code_mcp.png')} />

For servers behind upstream OAuth (for example a hosted GitHub or Atlassian MCP), keep the LiteLLM key in `x-litellm-api-key` and let LiteLLM run the OAuth flow; see [MCP OAuth](../../mcp_oauth.md).

## Next steps

[Cut Claude Code costs](../../tutorials/claude_code_cut_costs.md) with budgets, prompt caching, and fallbacks, [bring your own Anthropic key](../../tutorials/claude_code_byok.md), [route Claude Code to non-Anthropic models](../../tutorials/claude_non_anthropic_models.md), or check the [Claude Code compatibility matrix](../../claude_code_compatibility.md).
