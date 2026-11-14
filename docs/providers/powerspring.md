---
title: Powerspring
description: Call Powerspring's open-weight models through LiteLLM with the Python SDK or Gateway, on Chat Completions, Responses and Anthropic Messages.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Powerspring

[Powerspring](https://powerspring.eu) is an OpenAI-compatible API for popular open-weight models, including gpt-oss, DeepSeek, GLM, Qwen and Gemma. Every request runs on EU infrastructure owned by EU companies, Powerspring does not store prompts or outputs, and you pay from prepaid credits in euros. Use the `powerspring/` prefix with a model id from Powerspring's model list.

<SinceVersion v="1.111.0" />

Provider support was added in [PR #51844](https://github.com/BerriAI/litellm/pull/51844). Use this version or a later build that includes the provider.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `powerspring/` |
| API key environment variable | `POWERSPRING_API_KEY` |
| Default API base | `https://api.powerspring.eu/v1` |
| Optional API base override | `POWERSPRING_API_BASE` or the `api_base` parameter |
| Upstream endpoints | `/chat/completions`, `/responses`, `/messages` |
| Provider documentation | [Powerspring docs](https://powerspring.eu/docs) |

## Available Models

The live list is at `GET https://api.powerspring.eu/v1/models`, which needs no key, and on [powerspring.eu/models](https://powerspring.eu/models). Any `id` it returns works with the `powerspring/` prefix, for example `powerspring/gpt-oss-120b` or `powerspring/deepseek-v4.1-flash`. Every model serves all three endpoints with the same capabilities, except that `n`, `logprobs` and `logit_bias` work on chat completions only.

LiteLLM's cost map has each model's lowest Powerspring price in US dollars, converted from euros at the ECB reference rate of 13 November 2026 (1 EUR = 1.1052 USD). Powerspring bills in euros and sends each request to the cheapest available server, so a request can cost more than the listed price; see [powerspring.eu/pricing](https://powerspring.eu/pricing). To override, set `input_cost_per_token` and `output_cost_per_token` in `litellm_params`.

## Setup

Create an API key at [app.powerspring.eu](https://app.powerspring.eu/signup) and export it before you start the SDK or proxy:

```bash
export POWERSPRING_API_KEY="your-powerspring-api-key"
```

LiteLLM removes the `powerspring/` prefix before it sends the model value to Powerspring.

## LiteLLM Python SDK

### Chat completions

```python showLineNumbers title="Powerspring chat completion"
from litellm import completion

response = completion(
    model="powerspring/gpt-oss-120b",
    messages=[{"role": "user", "content": "Say hello in five words"}],
)

print(response.choices[0].message.content)
```

### Streaming

Pass `stream=True` and iterate over the chunks:

```python showLineNumbers title="Powerspring streaming"
from litellm import completion

response = completion(
    model="powerspring/gpt-oss-120b",
    messages=[{"role": "user", "content": "Write a short poem about Barcelona"}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

### Function calling

Every Powerspring model supports tools:

```python showLineNumbers title="Powerspring function calling"
from litellm import completion

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather in a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }
]

response = completion(
    model="powerspring/gpt-oss-120b",
    messages=[{"role": "user", "content": "What's the weather in Barcelona?"}],
    tools=tools,
    tool_choice="auto",
)

print(response.choices[0].message.tool_calls)
```

### Reasoning

Every Powerspring model supports reasoning. On every model except GLM 5.3 Flash, send `reasoning_effort="none"` to switch it off, or `thinking={"type": "disabled"}` on Anthropic Messages requests. GLM 5.3 Flash always reasons; its thinking can't be switched off.

```python showLineNumbers title="Powerspring without reasoning"
from litellm import completion

response = completion(
    model="powerspring/deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    reasoning_effort="none",
)

print(response.choices[0].message.content)
```

### Responses API

Powerspring serves the OpenAI Responses API natively, so `litellm.responses` sends the request straight to `https://api.powerspring.eu/v1/responses`. The endpoint is stateless: LiteLLM always sends `store: false`, and `previous_response_id` returns a 400 error. Send the full conversation in `input` instead.

```python showLineNumbers title="Powerspring Responses API"
import litellm

response = litellm.responses(
    model="powerspring/gpt-oss-120b",
    input="Say hello in five words",
)

print(response.output_text)
```

### Anthropic Messages API

Powerspring also serves the Anthropic Messages API natively, so `litellm.anthropic.messages.acreate` sends the request straight to `https://api.powerspring.eu/v1/messages`.

```python showLineNumbers title="Powerspring Anthropic Messages API"
import asyncio

import litellm


async def main():
    response = await litellm.anthropic.messages.acreate(
        model="powerspring/gpt-oss-120b",
        messages=[{"role": "user", "content": "Say hello in five words"}],
        max_tokens=256,
    )
    print(response["content"])


asyncio.run(main())
```

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-oss-120b
    litellm_params:
      model: powerspring/gpt-oss-120b
      api_key: os.environ/POWERSPRING_API_KEY
  - model_name: powerspring/*
    litellm_params:
      model: powerspring/*
      api_key: os.environ/POWERSPRING_API_KEY
```

The second entry routes any other Powerspring model by its full name, for example `powerspring/qwen3.8-27b`. Start the proxy with the API key exported in its environment:

```bash
litellm --config config.yaml
```

A deployment configured this way serves `/v1/chat/completions`, `/v1/responses` and `/v1/messages` on the proxy:

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-oss-120b",
    "messages": [{"role": "user", "content": "Say hello in five words"}]
  }'
```

</TabItem>
<TabItem value="responses" label="Responses">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-oss-120b",
    "input": "Say hello in five words"
  }'
```

</TabItem>
<TabItem value="messages" label="Messages">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/messages \
  -H "x-api-key: $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-oss-120b",
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "Say hello in five words"}]
  }'
```

</TabItem>
</Tabs>

`$LITELLM_MASTER_KEY` is your LiteLLM key, not your Powerspring API key.

## Custom API Base

Set `POWERSPRING_API_BASE`, or pass `api_base` on the call:

```python showLineNumbers title="Custom API base"
from litellm import completion

response = completion(
    model="powerspring/gpt-oss-120b",
    messages=[{"role": "user", "content": "Say hello"}],
    api_base="https://api.powerspring.eu/v1",
    api_key="your-powerspring-api-key",
)
```
