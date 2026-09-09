import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Eden AI

## Overview

| Property | Details |
|-------|-------|
| Description | Eden AI is a unified API that aggregates 100+ models from OpenAI, Anthropic, Google, Mistral, Cohere, and other vendors behind a single OpenAI-compatible chat-completions endpoint. |
| Provider Route on LiteLLM | `edenai/` |
| Link to Provider Doc | [Eden AI Documentation ↗](https://docs.edenai.co) |
| Base URL | `https://api.edenai.run/v3` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/messages`](#anthropic-format-messages-endpoint) |

<br />

**Eden AI exposes models from many underlying vendors through one OpenAI-compatible endpoint. Use `edenai/` as a prefix and the underlying model id from Eden AI's catalog (e.g. `edenai/openai/gpt-4o-mini`, `edenai/anthropic/claude-opus-4-6`).**

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key
# optional — override the default base URL:
os.environ["EDENAI_API_BASE"] = "https://api.edenai.run/v3"
```

Get your Eden AI API key from your [Eden AI dashboard](https://app.edenai.run/admin/account/settings).

## Model ID format

Eden AI's catalog is vendor-namespaced. Pass the underlying vendor and model id after the `edenai/` prefix:

| LiteLLM model id | Underlying model |
|------------------|------------------|
| `edenai/openai/gpt-4o-mini` | OpenAI GPT-4o mini |
| `edenai/openai/gpt-4o` | OpenAI GPT-4o |
| `edenai/anthropic/claude-opus-4-6` | Anthropic Claude Opus 4.6 |
| `edenai/anthropic/claude-haiku-4-5` | Anthropic Claude Haiku 4.5 |
| `edenai/google/gemini-2.5-flash` | Google Gemini 2.5 Flash |
| `edenai/mistral/mistral-large-latest` | Mistral Large |

Eden AI's catalog stores Anthropic ids with hyphens (`claude-opus-4-6`, not `claude-opus-4.6`). Pass the id verbatim from Eden AI's `/v3/models` endpoint.

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Eden AI Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

response = completion(
    model="edenai/openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
)

print(response.choices[0].message.content)
print(response.usage)
```

### Streaming

```python showLineNumbers title="Eden AI Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

response = completion(
    model="edenai/anthropic/claude-opus-4-6",
    messages=[{"role": "user", "content": "Write a haiku about the sea."}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="", flush=True)
```

### Function / tool calling

Eden AI's underlying models (Anthropic Claude, OpenAI GPT-4, etc.) support tool calling. To use it through LiteLLM, pass `allowed_openai_params=['tools']` on the call so the openai-like loader's local parameter validation lets `tools` through (see [Function-calling caveat](#function-calling-caveat) below):

```python showLineNumbers title="Eden AI with tools"
import os
import litellm
from litellm import completion

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name"},
                },
                "required": ["city"],
            },
        },
    }
]

response = completion(
    model="edenai/anthropic/claude-opus-4-6",
    messages=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=tools,
    allowed_openai_params=["tools"],   # required until Eden AI models gain
                                        # supports_function_calling=true in
                                        # model_prices_and_context_window.json
)

print(response.choices[0].message.tool_calls)
# [{"function": {"name": "get_weather", "arguments": '{"city":"Paris"}'}, ...}]
```

### Switching between underlying vendors

```python showLineNumbers title="Switch underlying vendor"
import litellm

# OpenAI via Eden AI
r1 = litellm.completion(
    model="edenai/openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}],
)

# Anthropic via Eden AI — same call, different model id
r2 = litellm.completion(
    model="edenai/anthropic/claude-opus-4-6",
    messages=[{"role": "user", "content": "Hello"}],
)
```

### Anthropic-format messages endpoint

You can also call Eden AI through LiteLLM's `/v1/messages` (Anthropic-format) entry point. LiteLLM translates the Anthropic-shape request to OpenAI shape internally, routes through Eden AI's chat-completions endpoint, and translates the response back to Anthropic shape:

```python showLineNumbers title="Eden AI via /v1/messages"
import os
import asyncio
import litellm

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

async def main():
    response = await litellm.anthropic_messages(
        model="edenai/anthropic/claude-opus-4-6",
        messages=[{"role": "user", "content": "Say hello"}],
        max_tokens=128,
    )
    # Anthropic-shape response: {"type": "message", "role": "assistant",
    # "content": [{"type": "text", "text": "..."}], "usage": {...}}
    print(response["content"][0]["text"])

asyncio.run(main())
```

`litellm.anthropic_messages` is `async`. Use `asyncio.run(...)` (or `await` from within an async context) when calling it from a synchronous script.

## Usage - LiteLLM Proxy Server

Add Eden AI models to your `config.yaml`:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-4o-mini-via-edenai
    litellm_params:
      model: edenai/openai/gpt-4o-mini
      api_key: os.environ/EDENAI_API_KEY

  - model_name: claude-opus-via-edenai
    litellm_params:
      model: edenai/anthropic/claude-opus-4-6
      api_key: os.environ/EDENAI_API_KEY
```

Start the proxy:

```bash
litellm --config config.yaml
```

Call the proxy with the OpenAI SDK:

```python showLineNumbers title="Proxy call"
from openai import OpenAI

client = OpenAI(api_key="anything", base_url="http://0.0.0.0:4000")

response = client.chat.completions.create(
    model="claude-opus-via-edenai",
    messages=[{"role": "user", "content": "Hello"}],
)

print(response.choices[0].message.content)
```

## Supported OpenAI Parameters

Eden AI accepts the standard OpenAI `chat/completions` request body:

| Parameter | Type | Description |
|-----------|------|-------------|
| `messages` | array | **Required.** Array of message objects with `role` and `content`. |
| `model` | string | **Required.** Model id with `edenai/` prefix. |
| `stream` | boolean | Optional. Enable token-by-token streaming via SSE. |
| `temperature` | float | Optional. Sampling temperature. |
| `top_p` | float | Optional. Nucleus sampling. |
| `max_tokens` | integer | Optional. Maximum tokens to generate. (`max_completion_tokens` is mapped to `max_tokens` automatically.) |
| `tools` | array | Optional. List of available tools / functions. |
| `tool_choice` | string/object | Optional. Control tool/function calling. |
| `response_format` | object | Optional. JSON mode (see caveat below). |
| `stop` | string/array | Optional. Stop sequences. |
| `n` | integer | Optional. Number of completions to generate. |
| `frequency_penalty` | float | Optional. |
| `presence_penalty` | float | Optional. |

## Known caveats

### Function-calling caveat

Calls that pass `tools` (or `tool_choice`, `function_call`, `functions`, `parallel_tool_calls`) currently raise `UnsupportedParamsError` for `edenai/...` models unless one of the following is set:

| Workaround | Scope |
| --- | --- |
| `allowed_openai_params=["tools"]` on the call | per-call — recommended |
| `litellm.drop_params = True` | global — silently drops the `tools` argument; not what you want |
| `litellm_settings.drop_params: true` (proxy) | global on the proxy |

**Why:** LiteLLM's openai-like loader strips tool-related parameters when `supports_function_calling()` returns False for the model. That helper reads `model_prices_and_context_window.json`; Eden AI ships without per-model entries today, so the check returns False. A follow-up PR can add headline-model entries with `supports_function_calling: true` to remove the workaround. Eden AI's API itself accepts the parameter — this is a LiteLLM-side validation, not a server limitation.

### `/v1/responses` is not enabled by default

`litellm.responses(model="edenai/...", ...)` raises the same `UnsupportedParamsError` as above because the responses path injects an empty `tools=[]` array internally. Eden AI's API supports `/v1/responses` — see Eden AI's docs — but routing through LiteLLM requires either `drop_params=True` or a host-side fix. Tracked as a follow-up.

### JSON mode adds a Markdown fence

With `response_format={"type": "json_object"}`, Eden AI returns valid JSON wrapped in a Markdown code fence (` ```json … ``` `) rather than bare JSON. LiteLLM passes the content through unchanged; downstream callers that strictly `json.loads(content)` should strip the fence first or set a system prompt asking for bare JSON.

### Additive non-OpenAI response fields

Eden AI's responses include extra keys (`status`, `provider_time`, `edenai_time`, `provider_specific_fields`). Well-behaved OpenAI clients (including LiteLLM) ignore unknown fields. No code change needed.

## Additional Resources

- [Eden AI Documentation](https://docs.edenai.co)
- [Eden AI Dashboard](https://app.edenai.run)
- [Get an API key](https://app.edenai.run/admin/account/settings)
- [Eden AI catalog (`/v3/models`)](https://docs.edenai.co/reference/get-list-of-models) — full list of underlying vendors and model ids
