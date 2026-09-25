# Wallaby

## Overview

| Property | Details |
|-------|-------|
| Description | Wallaby is an independent Australian API provider for open-weight models — Kimi K3 live now. Prepaid USD credits, per-token metering, itemized receipts. Prompts are never logged or used for training. |
| Provider Route on LiteLLM | `wallaby/` |
| Link to Provider Doc | [Wallaby API Docs ↗](https://wallabytoken.com/docs) |
| Base URL | `https://api.wallabytoken.com/v1` |
| Supported Operations | [`/chat/completions`](/docs/providers/wallaby#usage---litellm-python-sdk) |

&lt;br /&gt;

## What is Wallaby?

Wallaby serves frontier open-weight models behind a standard OpenAI-compatible endpoint:
- **Open weights only** — Kimi K3 (1M context, reasoning) at launch
- **Privacy by default** — content logging disabled; billing metadata only (token counts, model, timestamp)
- **Prepaid USD** — flat rates, balance never expires, itemized receipts

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["WALLABY_API_KEY"] = ""  # your Wallaby API key
```

Get your API key from [wallabytoken.com](https://wallabytoken.com) — register with an email, top up from $20.

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Wallaby Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["WALLABY_API_KEY"] = ""  # your Wallaby API key

messages = [{"content": "What is the capital of France?", "role": "user"}]

# Wallaby call
response = completion(
    model="wallaby/kimi-k3",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="Wallaby Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["WALLABY_API_KEY"] = ""  # your Wallaby API key

messages = [{"content": "Write a short poem about AI", "role": "user"}]

# Wallaby call with streaming
response = completion(
    model="wallaby/kimi-k3",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Reading the reasoning stream

Kimi K3 is a reasoning model — thinking arrives in `reasoning_content`, the answer in `content`:

```python showLineNumbers title="Wallaby Reasoning Stream"
for chunk in response:
    delta = chunk.choices[0].delta
    if getattr(delta, "reasoning_content", None):
        print(delta.reasoning_content, end="")   # thinking (dim or hide)
    if delta.content:
        print(delta.content, end="", flush=True) # the answer
```

## Usage - LiteLLM Proxy Server

### 1. Save key in your environment

```bash
export WALLABY_API_KEY=""
```

### 2. Start the proxy

```yaml
model_list:
  - model_name: kimi-k3
    litellm_params:
      model: wallaby/kimi-k3
      api_key: os.environ/WALLABY_API_KEY
```

## Supported OpenAI Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `messages` | array | **Required**. Array of message objects with 'role' and 'content' |
| `model` | string | **Required**. `kimi-k3` |
| `stream` | boolean | Optional. Enable streaming responses |
| `max_tokens` / `max_completion_tokens` | integer | Optional. Maximum tokens to generate (thinking counts toward output) |
| `stop` | string/array | Optional. Stop sequences |
| `tools` / `tool_choice` | array | Optional. Function calling |
| `response_format` | object | Optional. `json_object` and `json_schema` (strict) |
| `temperature` | float | Optional. Accepted and normalized — the serving stack fixes sampling at `1` |
| `top_p` | float | Optional. Accepted and normalized to `0.95` |
| `frequency_penalty` / `presence_penalty` | float | Optional. Accepted and normalized to `0` |

## Additional Resources

- [Wallaby API Docs](https://wallabytoken.com/docs)
- [Pricing (machine-readable)](https://wallabytoken.com/pricing.json)
- [Status page](https://status.wallabytoken.com/)