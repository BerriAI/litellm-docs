---
title: Claude Code - Context Management
sidebar_label: Claude Code - Context Management
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Claude Code - Context Management

LiteLLM supports Anthropic's `context_management` beta natively across **all providers** - not just Anthropic.

When you send a request to `/v1/messages` (or via `litellm.anthropic.messages.*`) with a `context_management` spec, LiteLLM handles it in one of two ways depending on where the request is routed:

| Routing path | How context_management is applied |
|---|---|
| **Anthropic API** | Passed through to the Anthropic server, which applies edits natively |
| **OpenAI Responses API** (e.g. `gpt-5.x-*`) | Passed through; handled by the Responses API |
| **Any other provider** (OpenAI, xAI, Gemini, Azure, Bedrock non-Anthropic, …) | **In-gateway polyfill** - LiteLLM applies the edits to the message array before forwarding |

The polyfill means you write your Claude Code tool-loop once, pass `context_management` as you normally would, and it works regardless of which model is behind the proxy.

---

## Supported Edit Types

| Edit type | Status | What it does |
|---|---|---|
| `clear_tool_uses_20250919` | ✅ **Supported** | Clears old `tool_result` content from conversation history when a trigger threshold is met, keeping only the most recent `N` tool results intact |
| `clear_thinking_20251015` | ❌ Coming soon | Clears extended-thinking blocks from history |
| `compact_20260112` | ❌ Native pass-through only | Summarisation edit - supported on Anthropic / Bedrock Anthropic forwarding paths; not polyfilled |

---

## How It Works

```
Claude Code client
        │
        │  POST /v1/messages  { context_management: { edits: [...] } }
        ▼
┌─────────────────────────────────────────────────────────┐
│                    LiteLLM Proxy                        │
│                                                         │
│  1. Detect routing target                               │
│                                                         │
│  ┌──────────────────────┐   ┌────────────────────────┐  │
│  │  Anthropic / Bedrock │   │  Any other provider    │  │
│  │  Anthropic / OpenAI  │   │  (OpenAI, xAI, Gemini, │  │
│  │  Responses API       │   │   Azure, …)            │  │
│  │                      │   │                        │  │
│  │  Pass context_mgmt   │   │  In-gateway polyfill:  │  │
│  │  spec through as-is  │   │  • Count input tokens  │  │
│  │  (server applies it) │   │  • Check trigger       │  │
│  └──────────┬───────────┘   │  • Clear old results   │  │
│             │               │  • Keep N most recent  │  │
│             │               │  • Never clear latest  │  │
│             │               └──────────┬─────────────┘  │
│             │                          │                 │
│             └────────────┬─────────────┘                 │
│                          │                               │
│  2. Forward to provider  │                               │
│     (without context_    │                               │
│      management key)     │                               │
└──────────────────────────┼──────────────────────────────┘
                           ▼
                    Upstream model
                           │
                    Response + usage
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  LiteLLM attaches applied_edits to response             │
│  { context_management: { applied_edits: [...] } }       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
                    Claude Code client
```

---

## Usage

### Basic request

```python
import litellm

response = await litellm.anthropic.messages.acreate(
    model="xai/grok-4",          # any provider
    max_tokens=1024,
    messages=[...],              # your multi-turn tool history
    tools=[{"name": "get_weather", "description": "...", "input_schema": {...}}],
    context_management={
        "edits": [
            {
                "type": "clear_tool_uses_20250919",
                "trigger": {
                    "type": "input_tokens",
                    "value": 80000          # activate when history exceeds 80k tokens
                },
                "keep": {
                    "type": "tool_uses",
                    "value": 3              # keep the 3 most-recent tool results
                }
            }
        ]
    }
)
```

You can also trigger on tool-use count instead of tokens:

```python
"trigger": {"type": "tool_uses", "value": 10}   # activate after 10 tool calls
```

### Via the proxy (curl)

```bash
curl -X POST http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "gpt-5.4-mini",
    "max_tokens": 1024,
    "messages": [...],
    "tools": [...],
    "context_management": {
      "edits": [
        {
          "type": "clear_tool_uses_20250919",
          "trigger": {"type": "input_tokens", "value": 80000},
          "keep":    {"type": "tool_uses",    "value": 3}
        }
      ]
    }
  }'
```

---

## `clear_tool_uses_20250919` - Knobs

| Field | Required | Default | Description |
|---|---|---|---|
| `trigger.type` | No | `"input_tokens"` | `"input_tokens"` or `"tool_uses"` |
| `trigger.value` | No | `100000` | Threshold; edits fire when current value **exceeds** this |
| `keep.type` | No | `"tool_uses"` | Must be `"tool_uses"` |
| `keep.value` | No | `3` | Number of most-recent tool results to preserve |
| `clear_at_least` | Accepted | - | Accepted in request but ignored by polyfill (v0) |
| `exclude_tools` | Accepted | - | Accepted in request but ignored by polyfill (v0) |
| `clear_tool_inputs` | Accepted | - | Accepted in request but ignored by polyfill (v0) |

> **Hard floor:** regardless of `keep`, LiteLLM's polyfill never clears the most recently completed `tool_result` - the one the model is about to reply to.

---

## Responses

### Non-streaming

When at least one edit fires, the response includes a `context_management` field:

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "content": [{"type": "text", "text": "Based on the latest weather data..."}],
  "model": "gpt-5.4-mini",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 620,
    "output_tokens": 45
  },
  "context_management": {
    "applied_edits": [
      {
        "type": "clear_tool_uses_20250919",
        "cleared_tool_uses": 3,
        "cleared_input_tokens": 8240
      }
    ]
  }
}
```

If the trigger was not met (context is still small), `context_management` is **absent** from the response.

### Streaming

The `context_management.applied_edits` field is included in the final `message_delta` SSE event:

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_01...","type":"message","role":"assistant","content":[],"model":"gpt-5.4-mini","stop_reason":null,"usage":{"input_tokens":620,"output_tokens":0}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Based on"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" the latest weather data..."}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {
  "type": "message_delta",
  "delta": {"stop_reason": "end_turn", "stop_sequence": null},
  "usage": {"output_tokens": 45},
  "context_management": {
    "applied_edits": [
      {
        "type": "clear_tool_uses_20250919",
        "cleared_tool_uses": 3,
        "cleared_input_tokens": 8240
      }
    ]
  }
}

event: message_stop
data: {"type":"message_stop"}
```

---

## Disabling Context Management

### Per-request - omit the field

Simply don't include `context_management` in the request body.

### Proxy-wide - `drop_params: true`

When `drop_params: true` is set in your proxy config (or passed as a litellm setting), LiteLLM will silently strip `context_management` from any request instead of running the polyfill:

```yaml
# proxy_server_config.yaml
litellm_settings:
  drop_params: true
```

Or at call time:

```python
import litellm
litellm.drop_params = True
```

This is useful when you have a global `drop_params` policy to suppress unsupported parameters - context management is treated like any other unsupported parameter and dropped rather than polyfilled.

---

## Provider Support Matrix

| Provider | Native | Polyfill |
|---|---|---|
| `anthropic/*` | Yes | - |
| `bedrock/anthropic.*` | `compact_20260112` only | - |
| `openai/*` (Responses API) | Yes | - |
| `openai/*` (chat completions) | - | Yes |
| `azure/*` | - | Yes |
| `xai/*` | - | Yes |
| `gemini/*` | - | Yes |
| `vertex_ai/*` | - | Yes |
| All other providers | - | Yes |

---

## Notes

- The polyfill only processes the `clear_tool_uses_20250919` edit type. `compact_20260112` requires Anthropic's summarisation capability and is forwarded as-is on native paths only.
- Token counting for the polyfill uses `litellm.token_counter` (tiktoken `cl100k_base` fallback for unknown models).
- The message array structure is preserved: same number of messages, same role order. Only `tool_result.content` inside matching messages is replaced with `"[Cleared by context management]"`.
