---
title: "NagaAI API with LiteLLM: Python SDK and Gateway"
sidebar_label: "NagaAI"
description: "Call NagaAI models from the LiteLLM Python SDK or AI Gateway, with native Responses, Chat Completions and Anthropic Messages endpoints and USD spend tracking."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# NagaAI

<SinceVersion v="1.113.0" />

[NagaAI](https://naga.ac) is a hosted API for models from many labs, with OpenAI-compatible Responses and Chat Completions endpoints and an Anthropic-compatible Messages endpoint. NagaAI names models as `lab/model`, so a LiteLLM model id has three parts, such as `nagaai/anthropic/claude-sonnet-5.5`. LiteLLM strips the leading `nagaai/` and sends the rest of the id to NagaAI as is.

The `nagaai` provider ships with [PR #51234](https://github.com/BerriAI/litellm/pull/51234), so run the release above or a later build.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `nagaai/` |
| API key environment variable | `NAGA_API_KEY` |
| Default API base | `https://api.naga.ac/v1` |
| Optional API base override | `NAGA_API_BASE` or the `api_base` parameter |
| Upstream endpoints | `/responses`, `/chat/completions`, `/messages` |
| Provider documentation | [NagaAI docs](https://docs.naga.ac) |

## Setup

Create an API key on the [API Keys](https://naga.ac/dashboard/api-keys) page of the NagaAI dashboard and put it in `NAGA_API_KEY`:

```bash
export NAGA_API_KEY="your-nagaai-api-key"
```

`GET https://api.naga.ac/v1/models` lists every model id with its kind. Pick a chat model and add `nagaai/` in front of its id.

## LiteLLM Python SDK

NagaAI serves the Responses API natively, so `litellm.responses` calls go to NagaAI's own `/responses` endpoint:

```python
from litellm import responses

response = responses(
    model="nagaai/anthropic/claude-sonnet-5.5",
    input="Say hello in five words",
)

print(response.output_text)
```

Chat Completions go through `completion`. This example streams the reply:

```python
from litellm import completion

response = completion(
    model="nagaai/anthropic/claude-sonnet-5.5",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## LiteLLM Gateway

Install the proxy with `pip install 'litellm[proxy]'`. The Gateway process needs two keys: `NAGA_API_KEY`, which LiteLLM sends to NagaAI, and `LITELLM_MASTER_KEY`, which your clients send to the Gateway.

```bash
export NAGA_API_KEY="your-nagaai-api-key"
export LITELLM_MASTER_KEY="sk-your-strong-master-key"
```

Then write `config.yaml`:

```yaml
model_list:
  - model_name: claude-sonnet-5.5
    litellm_params:
      model: nagaai/anthropic/claude-sonnet-5.5
      api_key: os.environ/NAGA_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash
litellm --config config.yaml --port 4000
```

From another terminal with `LITELLM_MASTER_KEY` exported, call the Gateway with the alias `claude-sonnet-5.5`. The Gateway sends `/v1/responses` and `/v1/messages` requests for NagaAI models to NagaAI's own Responses and Messages endpoints, not through the chat completions bridge.

<Tabs>
<TabItem value="responses" label="Responses">

```bash
curl http://localhost:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-5.5", "input": "Say hello in five words"}'
```

</TabItem>
<TabItem value="chat" label="Chat Completions">

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-5.5",
    "messages": [{"role": "user", "content": "Say hello in five words"}]
  }'
```

</TabItem>
<TabItem value="messages" label="Messages">

```bash
curl http://localhost:4000/v1/messages \
  -H "x-api-key: $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-5.5",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Say hello in five words"}]
  }'
```

</TabItem>
</Tabs>

Each of these responses carries the request's cost in the `x-litellm-response-cost` header. In the Admin UI, NagaAI is in the provider list under Models, Add Model. The form asks for a `nagaai/` model id and your NagaAI key, and the API base is optional.

## Supported Models

LiteLLM's catalog carries limits and USD prices for the five NagaAI models below, so their spend is tracked, with cache read prices on all five and cache write prices on the two Claude models and `gpt-6.1-sol`. Any other chat model id from `GET /v1/models` works with the `nagaai/` prefix too, without a catalog price.

| Model | Max input tokens | Max output tokens |
|-------|------------------|-------------------|
| `nagaai/anthropic/claude-opus-5.5` | 1,000,000 | 128,000 |
| `nagaai/anthropic/claude-sonnet-5.5` | 1,000,000 | 128,000 |
| `nagaai/openai/gpt-6.2-sol` | 922,000 | 128,000 |
| `nagaai/openai/gpt-6.1-sol` | 922,000 | 128,000 |
| `nagaai/deepseek/deepseek-v4.1-flash` | 1,048,576 | 384,000 |

Each catalog row holds the highest per-token rate NagaAI listed for that model on the day it was added: the `max_price` of an entry in the `pricing` list of `GET /v1/models` where it has one, otherwise its `price`. NagaAI prices follow the market, so tracked spend can sit above your NagaAI usage. To track the current rates, or a model outside the catalog, set per-token costs in USD on the deployment from the `price` of each `pricing` entry: `input_token` maps to `input_cost_per_token`, `output_token` to `output_cost_per_token`, `cached_input_token` to `cache_read_input_token_cost` and `cache_write_input_token` to `cache_creation_input_token_cost`. The numbers in this example are placeholders:

```yaml
model_list:
  - model_name: claude-sonnet-5.5-own-rates
    litellm_params:
      model: nagaai/anthropic/claude-sonnet-5.5
      api_key: os.environ/NAGA_API_KEY
      input_cost_per_token: 0.0000009
      output_cost_per_token: 0.0000045
      cache_read_input_token_cost: 0.00000009
      cache_creation_input_token_cost: 0.000001125
```
