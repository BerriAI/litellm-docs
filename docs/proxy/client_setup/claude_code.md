---
title: Claude Code (CLI)
sidebar_label: Claude Code (CLI)
---

import Image from '@theme/IdealImage';

# Connect Claude Code to LiteLLM

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) talks to the Anthropic Messages API. LiteLLM serves that format at `/v1/messages`, so you point Claude Code at the gateway with two environment variables and it works against any model in your config, not just Anthropic's.

## Quick reference

| Setting | Value |
|---|---|
| `ANTHROPIC_BASE_URL` | `<LITELLM_PROXY_BASE_URL>` (e.g. `http://localhost:4000`) |
| `ANTHROPIC_AUTH_TOKEN` | Your LiteLLM [virtual key](../virtual_keys.md) |
| MCP endpoint | `<LITELLM_PROXY_BASE_URL>/<server_name>/mcp` |
| MCP auth header | `x-litellm-api-key: Bearer <virtual key>` |

## LLM setup

### 1. Point Claude Code at the gateway

Export the base URL and your virtual key, then launch Claude Code:

```bash
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_AUTH_TOKEN="sk-1234"

claude
```

Claude Code sends every request to LiteLLM's `/v1/messages` endpoint, authenticating with your virtual key. To make this permanent, add the two exports to your shell profile (`~/.zshrc`, `~/.bashrc`) or Claude Code's `settings.json`.

### 2. Pick a model

On startup Claude Code calls `GET /v1/models` against your gateway and adds every model your key can access to the `/model` picker, labeled **From gateway**. Switch models from inside the session:

```bash
/model
```

To pin a default model without the picker, set `ANTHROPIC_MODEL` to a public model name from your config:

```bash
export ANTHROPIC_MODEL="claude-sonnet-5"
```

Here Claude Code is answering through the gateway routed to a non-Anthropic model:

<Image img={require('../../../img/client_setup/claude_code_llm.png')} />

### 3. Verify

Send any prompt, then confirm the traffic in the Admin UI under **Logs** or **Usage**. You should see the request attributed to your virtual key and the model you chose.

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

Start Claude Code, open the MCP menu with `/mcp`, and select the server to connect. For servers behind upstream OAuth (for example a hosted GitHub or Atlassian MCP), keep the LiteLLM key in `x-litellm-api-key` and let LiteLLM run the OAuth flow; see [MCP OAuth](../../mcp_oauth.md).

<!-- SCREENSHOT NEEDED: claude_code_mcp.png -- run `/mcp` in Claude Code and capture the listing showing the litellm server connected and its tools available -->

## Next steps

- [Cut Claude Code costs](../../tutorials/claude_code_cut_costs.md) with budgets, prompt caching, and fallbacks
- [Bring your own Anthropic key (BYOK)](../../tutorials/claude_code_byok.md)
- [Route Claude Code to non-Anthropic models](../../tutorials/claude_non_anthropic_models.md)
- [Claude Code compatibility matrix](../../claude_code_compatibility.md)
