---
title: "Perplexity Orchestrator API with LiteLLM"
sidebar_label: "Perplexity Orchestrator"
description: "Call Claude, GPT, Gemini, Grok and open-weight models through Perplexity's Orchestrator API with one key, on chat, Responses and Messages routes with cost tracking."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Perplexity Orchestrator

<SinceVersion v="1.112.0" />

Perplexity's Orchestrator API serves models from Anthropic, OpenAI, Google, xAI and open-weight vendors with one Perplexity API key, in the OpenAI Chat Completions, OpenAI Responses and Anthropic Messages formats. LiteLLM calls it with the `perplexity_orchestrator/` prefix. It first ships in `v1.112.0-rc.1`, and in `v1.108.16` on the 1.108.x LTS line.

For Perplexity's Sonar models and the Agent API, use the [`perplexity/` provider](./perplexity.md) instead.

## Overview

| Property | Details |
|-------|-------|
| Description | One Perplexity key for Anthropic, OpenAI, Google, xAI and open-weight models |
| Provider Route on LiteLLM | `perplexity_orchestrator/<vendor>/<model>` |
| Link to Provider Doc | [Perplexity Orchestrator](https://docs.perplexity.ai/docs/orchestrator/quickstart) |
| Default Base URL | `https://api.perplexity.ai/orchestrator/v1` |
| Supported Operations | `/chat/completions`, `/responses`, `/messages` |

## API Key

LiteLLM reads the key from `PERPLEXITY_API_KEY` or `PERPLEXITYAI_API_KEY`. When both are set, it uses `PERPLEXITYAI_API_KEY`, which is the variable the `perplexity/` provider reads, so both providers send the same key.

```python showLineNumbers title="Environment Variables"
import os

os.environ["PERPLEXITY_API_KEY"] = "pplx-..."
```

## Model Names

Write the model as `perplexity_orchestrator/` and then the Orchestrator's model ID, which starts with its vendor, for example `perplexity_orchestrator/anthropic/claude-haiku-5-5`, `perplexity_orchestrator/openai/gpt-6-luna` or `perplexity_orchestrator/xai/grok-4.7`. LiteLLM sends the part after `perplexity_orchestrator/` as the request's `model`. `perplexity_orchestrator/perplexity/auto` lets the Orchestrator pick the model for each request. Perplexity's [models page](https://docs.perplexity.ai/docs/orchestrator/models) lists every ID.

## Usage - LiteLLM Python SDK

```python showLineNumbers title="Chat Completions" keep-model-ids
import os
from litellm import completion

os.environ["PERPLEXITY_API_KEY"] = "pplx-..."

response = completion(
    model="perplexity_orchestrator/anthropic/claude-haiku-5-5",
    messages=[{"role": "user", "content": "Say hello in one word"}],
)
print(response.choices[0].message.content)
```

```python showLineNumbers title="Responses API" keep-model-ids
import litellm

response = litellm.responses(
    model="perplexity_orchestrator/openai/gpt-6-luna",
    input="Say hello in one word",
    max_output_tokens=64,
)
print(response.output_text)
```

```python showLineNumbers title="Anthropic Messages" keep-model-ids
import asyncio
import litellm

response = asyncio.run(
    litellm.anthropic.messages.acreate(
        model="perplexity_orchestrator/anthropic/claude-haiku-5-5",
        max_tokens=64,
        messages=[{"role": "user", "content": "Say hello in one word"}],
    )
)
print(response["content"][0]["text"])
```

## Usage - LiteLLM Proxy

```yaml showLineNumbers title="config.yaml" keep-model-ids
model_list:
  - model_name: claude-haiku
    litellm_params:
      model: perplexity_orchestrator/anthropic/claude-haiku-5-5
      api_key: os.environ/PERPLEXITY_API_KEY
  - model_name: gpt-6-luna
    litellm_params:
      model: perplexity_orchestrator/openai/gpt-6-luna
      api_key: os.environ/PERPLEXITY_API_KEY
  - model_name: auto
    litellm_params:
      model: perplexity_orchestrator/perplexity/auto
      api_key: os.environ/PERPLEXITY_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

```bash showLineNumbers title="Start LiteLLM Proxy"
export PERPLEXITY_API_KEY="pplx-..."
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 16)"
litellm --config config.yaml --port 4000
```

LiteLLM sends each route to the matching Orchestrator route, `/chat/completions`, `/responses` or `/messages` under the base URL, in the format the request came in. It does not translate the request through chat completions.

<Tabs>
<TabItem value="chat" label="/v1/chat/completions">

```bash showLineNumbers title="Chat Completions through LiteLLM Proxy"
curl -sS -D - http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "claude-haiku",
    "messages": [{"role": "user", "content": "Say hello in one word"}]
  }'
```

The proxy answers in the Chat Completions format, with the call's cost in a header:

```text showLineNumbers title="Response (trimmed)" keep-model-ids
HTTP/1.1 200 OK
x-litellm-model-name: perplexity_orchestrator/anthropic/claude-haiku-5-5
x-litellm-response-cost: 4.5e-06

{"model":"claude-haiku","object":"chat.completion","choices":[{"finish_reason":"stop","index":0,"message":{"content":"Hello!","role":"assistant"}}],"usage":{"completion_tokens":6,"prompt_tokens":15,"total_tokens":21}}
```

</TabItem>
<TabItem value="responses" label="/v1/responses">

```bash showLineNumbers title="Responses API through LiteLLM Proxy" keep-model-ids
curl -sS -D - http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "gpt-6-luna",
    "input": "Say hello in one word",
    "max_output_tokens": 64
  }'
```

The proxy answers in the Responses API format:

```text showLineNumbers title="Response (trimmed)" keep-model-ids
HTTP/1.1 200 OK
x-litellm-model-name: perplexity_orchestrator/openai/gpt-6-luna
x-litellm-response-cost: 3.6e-06

{"model":"gpt-6-luna","object":"response","status":"completed","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Hello"}]}],"usage":{"input_tokens":11,"output_tokens":5,"total_tokens":16}}
```

</TabItem>
<TabItem value="messages" label="/v1/messages">

```bash showLineNumbers title="Anthropic Messages through LiteLLM Proxy"
curl -sS -D - http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-haiku",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Say hello in one word"}]
  }'
```

The proxy answers in the Anthropic Messages format:

```text showLineNumbers title="Response (trimmed)" keep-model-ids
HTTP/1.1 200 OK
x-litellm-model-name: perplexity_orchestrator/anthropic/claude-haiku-5-5
x-litellm-response-cost: 4e-06

{"type":"message","role":"assistant","model":"claude-haiku","content":[{"type":"text","text":"Hello"}],"stop_reason":"end_turn","usage":{"input_tokens":15,"output_tokens":5,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}
```

</TabItem>
</Tabs>

You can also add these models in the Admin UI. Go to Models, then Add Model, and pick Perplexity Orchestrator as the provider. It is listed apart from Perplexity, and the Perplexity provider does not list the Orchestrator's models. The API key is required and the API base is optional.

## Cost Tracking

LiteLLM prices each call from the `perplexity_orchestrator/` rows in its cost map, which follow Perplexity's [Orchestrator price list](https://docs.perplexity.ai/docs/orchestrator/models). The cost is in the `x-litellm-response-cost` response header and in the spend logs. The rows cover the rates below.

| Rate | Models |
|-------|-------|
| Long context input and output | Claude above 100k input tokens, GPT above 272k, Grok above 200k |
| Cache reads | Every model |
| 5 minute cache writes | Claude and most GPT models |
| 1 hour cache writes | Claude |
| `flex` and `priority` service tiers | GPT |

A GPT request with `"service_tier": "flex"` is billed at the flex rates. The same `gpt-6-luna` call as above costs `1.8e-06` on flex and `3.6e-06` on the default tier.

LiteLLM bills a `perplexity/auto` request at the rates of the model that answered it, which the Orchestrator names in its response. The SDK returns that model as `response.model`:

```python showLineNumbers title="Auto routing with the SDK" keep-model-ids
import litellm

response = litellm.completion(
    model="perplexity_orchestrator/perplexity/auto",
    messages=[{"role": "user", "content": "Say hello in one word"}],
)
print(response.model, litellm.completion_cost(completion_response=response))
```

```text showLineNumbers title="Output" keep-model-ids
perplexity_orchestrator/openai/gpt-6-luna 3.6e-06
```

The proxy returns your model group name as `model` and puts the cost in the header:

```bash showLineNumbers title="Auto routing through LiteLLM Proxy"
curl -sS -D - http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Say hello in one word"}]
  }'
```

```text showLineNumbers title="Response (trimmed)" keep-model-ids
HTTP/1.1 200 OK
x-litellm-model-name: perplexity_orchestrator/perplexity/auto
x-litellm-response-cost: 3.6e-06

{"model":"auto","object":"chat.completion","choices":[{"finish_reason":"stop","index":0,"message":{"content":"Hello","role":"assistant"}}],"usage":{"completion_tokens":5,"prompt_tokens":11,"total_tokens":16}}
```

## Unsupported Params

The Orchestrator rejects `seed`, `logit_bias`, `top_logprobs`, `functions`, `function_call`, `modalities`, `audio`, `prediction`, `web_search_options`, `verbosity` and `prompt_cache_retention`, and the Responses API's `previous_response_id`. It also takes only the default value of `n` (1), `frequency_penalty` and `presence_penalty` (0), `logprobs`, `store` and `background` (false), and `service_tier` (`auto` or `default`, except on GPT models, which also take `flex` and `priority`). LiteLLM answers such a request with a 400 and does not call the Orchestrator:

```bash showLineNumbers title="A request with seed" keep-model-ids
curl -sS http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "gpt-6-luna",
    "seed": 7,
    "messages": [{"role": "user", "content": "Say hello in one word"}]
  }'
```

```text showLineNumbers title="Response" keep-model-ids
HTTP/1.1 400 Bad Request

{"error":{"message":"litellm.UnsupportedParamsError: perplexity_orchestrator does not support parameters: ['seed'], for model=openai/gpt-6-luna. To drop these, set `litellm.drop_params=True` or for proxy: ...","type":"invalid_request_error","code":"400"}}
```

With `drop_params` on, LiteLLM removes the param and sends the rest of the request, so the same curl answers 200:

```yaml showLineNumbers title="config.yaml"
litellm_settings:
  drop_params: true
```

A param listed in `allowed_openai_params`, on the request or the deployment, skips this check and goes to the Orchestrator as sent. The Orchestrator then answers 400 itself for any value it does not accept, such as `seed` or `n` above 1.

## Prompt Caching

On `/v1/messages`, LiteLLM forwards `cache_control` as sent, a `ttl` of `"1h"` included. The model caches a prompt only when it is longer than the model's minimum cacheable length.

```bash showLineNumbers title="A 1 hour cache breakpoint through LiteLLM Proxy"
curl -sS -D - http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-haiku",
    "max_tokens": 64,
    "system": [
      {
        "type": "text",
        "text": "<a system prompt of at least 4,096 tokens>",
        "cache_control": {"type": "ephemeral", "ttl": "1h"}
      }
    ],
    "messages": [{"role": "user", "content": "Say hello in one word"}]
  }'
```

The first call writes the cache, and LiteLLM bills the write at the 1 hour rate. A later call within the hour reads it at the cache read rate:

```text showLineNumbers title="First call (trimmed)"
x-litellm-response-cost: 0.0029379
x-litellm-response-cost-cache-creation: 0.0029336

"usage":{"input_tokens":13,"output_tokens":6,"cache_creation_input_tokens":14668,"cache_creation":{"ephemeral_1h_input_tokens":14668,"ephemeral_5m_input_tokens":0},"cache_read_input_tokens":0}
```

```text showLineNumbers title="Later call (trimmed)"
x-litellm-response-cost: 0.00015098
x-litellm-response-cost-cache-read: 0.00014668

"usage":{"input_tokens":13,"output_tokens":6,"cache_creation_input_tokens":0,"cache_read_input_tokens":14668}
```

On `/v1/chat/completions` and `/v1/responses`, a `cache_control` marker on a Claude model or on `perplexity/auto` goes to the Orchestrator as its `prompt_cache_breakpoint` field.
