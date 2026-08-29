---
slug: cursor-integration
title: "Route Cursor Through LiteLLM"
date: 2026-08-07T10:00:00
authors:
  - mateo
description: "Point Cursor at the LiteLLM AI Gateway: IDE chat, agent mode, and the Cursor Cloud Agents API on virtual keys with budgets, model access control, and logging."
keywords: [cursor, litellm, ai gateway, byok, cursor cloud agents, virtual keys, budgets, mcp]
tags: [cursor, integrations, gateway, engineering]
hide_table_of_contents: false
---

Cursor now runs through the LiteLLM AI Gateway end to end: IDE chat, agent mode, and the Cursor Cloud Agents API, all on virtual keys with budgets, model access control, and logging

![Two kinds of Cursor traffic, one gateway](./cursor_litellm_flow.svg)

{/* truncate */}

Everything below ships in v1.97.0

## Why gateway your IDE

If you run LiteLLM, you already know the pitch: one proxy in front of every provider, with per-team keys, spend tracking, and model access control. The awkward exception has been the IDE. Developers pasted personal OpenAI or Anthropic keys into Cursor's settings, spend landed on cards the platform team never saw, and nobody could say which models were approved for whom

The integration removes the exception. Cursor gets a LiteLLM virtual key instead of a raw provider key, and the proxy decides what that key can reach, what it can spend, and what gets logged. Provider credentials never leave the server

## Point Cursor at the proxy

Three settings in Cursor and you are done

1. In Cursor Settings, open Models and enable **Override OpenAI Base URL**. Set it to your proxy with the `/cursor` path appended, for example `https://litellm.your-org.com/cursor`
2. Create a virtual key in the LiteLLM dashboard under **Virtual Keys** and paste it into the OpenAI API Key field. Cursor requires keys to start with `sk-`, which LiteLLM keys already do
3. Add the models you want by their LiteLLM public model name, exactly as they appear under **Models + Endpoints**

On the proxy side nothing special is required beyond a normal `model_list` entry

```yaml
model_list:
  - model_name: claude-opus-5
    litellm_params:
      model: anthropic/claude-opus-5
      api_key: os.environ/ANTHROPIC_API_KEY
```

Cursor verifies custom keys by listing models from the base URL, and the proxy answers that at `GET /cursor/models`, so the verification check in settings passes for real. Pick the model in chat, send a message, and watch it show up on the Logs page

## The hard part was agent mode

The reason this is an endpoint rather than a line in a README is Cursor's wire format. Cursor speaks to its OpenAI-compatible base URL in two dialects. Ask mode sends genuine chat completions bodies. Agent mode sends Responses API shapes to the chat completions path: an `input` array instead of `messages`, flat tool definitions, reasoning config, and custom tools with grammar formats, while still expecting chat completions responses back, streaming included

`/cursor/chat/completions` accepts both. It detects the dialect per request, normalizes every level of the tools array independently, routes Responses-shaped traffic through LiteLLM's Responses bridge, and always answers in the chat completions format Cursor expects. Cursor gates custom API keys by mode and model on its side, so coverage follows whatever Cursor enables, but the proxy handles every shape we have seen real sessions produce

Model names get the same treatment. Cursor's picker emits thinking and fast variants, `claude-opus-5-thinking` for example, and the endpoint resolves those suffixes back to the underlying deployment before auth runs, so key scopes and per-model budgets bind to the model actually served instead of silently missing the variant

## Cloud Agents through the same gateway

Cursor's Cloud Agents run in Cursor's infrastructure and are driven over a REST API at `api.cursor.com`. That API now has a passthrough on the proxy. Call `<proxy>/cursor/v0/...` with a LiteLLM virtual key and the gateway swaps in your real Cursor API key server-side, using the Basic auth encoding Cursor expects. The Cursor key itself lives in the proxy, added under **LLM Credentials** in the UI, as a config deployment, or as the `CURSOR_API_KEY` environment variable, and never reaches developers or CI

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/cursor/v0/agents` | Launch an agent |
| `GET` | `/cursor/v0/agents` | List agents |
| `GET` | `/cursor/v0/agents/{id}` | Agent status |
| `GET` | `/cursor/v0/agents/{id}/conversation` | Agent conversation |
| `POST` | `/cursor/v0/agents/{id}/followup` | Add a follow-up |
| `POST` | `/cursor/v0/agents/{id}/stop` | Stop an agent |
| `DELETE` | `/cursor/v0/agents/{id}` | Delete an agent |
| `GET` | `/cursor/v0/me` | API key info |
| `GET` | `/cursor/v0/models` | List models |
| `GET` | `/cursor/v0/repositories` | List repositories |

Launching an agent from anywhere that holds a virtual key looks like this

```bash
curl -X POST "$LITELLM_PROXY/cursor/v0/agents" \
  -H "Authorization: Bearer sk-your-litellm-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": {"text": "Investigate the flaky auth test and open a PR"},
    "source": {"repository": "https://github.com/your-org/your-repo"}
  }'
```

Every call lands on the LiteLLM Logs page classified by operation, `cursor:agent:create`, `cursor:agent:followup`, and so on, so agent activity is auditable next to your chat traffic

## MCP servers, too

Cursor can also consume MCP servers through the proxy. Point `mcp.json` at a server LiteLLM exposes, with a virtual key in the header, and tool calls get the same authentication and logging as everything else

```json
{
  "mcpServers": {
    "litellm": {
      "url": "http://localhost:4000/everything/mcp",
      "type": "http",
      "headers": {
        "Authorization": "Bearer sk-LITELLM_VIRTUAL_KEY"
      }
    }
  }
}
```

## Getting started

The [Cursor integration tutorial](https://docs.litellm.ai/docs/tutorials/cursor_integration) walks through the same setup with screenshots. If Cursor sends a request shape the endpoint mishandles, [open an issue](https://github.com/BerriAI/litellm/issues): the dialect coverage above came from running real Cursor sessions against the proxy, and we want to keep it total
