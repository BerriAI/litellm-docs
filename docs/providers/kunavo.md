---
title: "Kunavo API with LiteLLM: Python SDK and Gateway"
sidebar_label: "Kunavo"
description: "Call Kunavo's Claude and GPT models from the LiteLLM Python SDK or AI Gateway, with native Anthropic Messages for Claude and USD spend tracking."
---

# Kunavo

<SinceVersion v="1.113.0" />

[Kunavo](https://kunavo.com) is an API gateway that serves Claude and GPT models behind one API key. It speaks OpenAI's chat completions API at `https://api.kunavo.com/v1` and also serves Anthropic's Messages API for its Claude models. Kunavo model ids go after the `kunavo/` prefix, for example `kunavo/claude-sonnet-5-5`.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `kunavo/` |
| API key environment variable | `KUNAVO_API_KEY` |
| Default API base | `https://api.kunavo.com/v1` |
| Optional API base override | `KUNAVO_API_BASE` or the `api_base` parameter |
| Upstream endpoints | `/chat/completions` for every model, `/messages` for Claude models |
| Provider documentation | [Kunavo quickstart](https://kunavo.com/docs/quickstart) |

## Setup

Create an API key in the Kunavo dashboard. Keys start with `sk-kn-`. Export it before you start the SDK or Gateway:

```bash
export KUNAVO_API_KEY="sk-kn-your-key"
```

`GET https://api.kunavo.com/v1/models` with that key lists every model on sale. The ids are Kunavo's own, so a GPT id after the prefix uses hyphens, as in `kunavo/gpt-5-6-sol`.

## LiteLLM Python SDK

```python keep-model-ids
from litellm import completion

response = completion(
    model="kunavo/claude-sonnet-5-5",
    messages=[{"role": "user", "content": "Say hello in five words"}],
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the chunks:

```python
from litellm import completion

response = completion(
    model="kunavo/gpt-6-sol",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

Kunavo forwards `reasoning_effort` to its GPT models. On chat completions it does not forward `reasoning_effort` or `thinking` to Claude models, so use the Anthropic Messages API below for extended thinking on Claude.

### Anthropic Messages API

LiteLLM forwards [Anthropic Messages](/docs/anthropic_unified) calls for Kunavo's Claude models to Kunavo's own `/v1/messages` endpoint without translating them to chat completions, so `thinking`, tools and `cache_control`, a one-hour `ttl` included, keep their Anthropic form. Calls for GPT models go through Kunavo's chat completions instead.

```python keep-model-ids
import asyncio

import litellm


async def main():
    response = await litellm.anthropic.messages.acreate(
        model="kunavo/claude-sonnet-5-5",
        messages=[{"role": "user", "content": "Name three primary colors"}],
        max_tokens=200,
    )
    print(response["content"])


asyncio.run(main())
```

[Responses API](/docs/response_api) calls work for every Kunavo model through LiteLLM's translation to chat completions.

## LiteLLM Gateway

Set `KUNAVO_API_KEY` on the Gateway process, and set `LITELLM_MASTER_KEY` to a strong key for Gateway clients. Save this configuration as `config.yaml`:

```yaml keep-model-ids
model_list:
  - model_name: kunavo-claude
    litellm_params:
      model: kunavo/claude-sonnet-5-5
      api_key: os.environ/KUNAVO_API_KEY
  - model_name: kunavo-gpt
    litellm_params:
      model: kunavo/gpt-6-sol
      api_key: os.environ/KUNAVO_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash
litellm --config config.yaml --port 4000
```

In a second terminal with `LITELLM_MASTER_KEY` set, call either alias on `/v1/chat/completions`:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kunavo-gpt",
    "messages": [{"role": "user", "content": "Say hello in five words"}]
  }'
```

Clients that speak the Anthropic Messages API call the Claude alias on `/v1/messages`:

```bash
curl http://localhost:4000/v1/messages \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kunavo-claude",
    "max_tokens": 200,
    "messages": [{"role": "user", "content": "Say hello in five words"}]
  }'
```

You can also add Kunavo models from the Admin UI. Open Models, click Add Model, pick Kunavo as the provider and paste your key.

## Supported Models

These Kunavo text models are in the LiteLLM catalog, so LiteLLM tracks their spend in USD at the list prices in Kunavo's [pricing.json](https://kunavo.com/pricing.json), cache reads and writes included. Kunavo bills one-hour cache writes on Claude at its five-minute write rate, and the catalog does the same. Prices change, so check the [Kunavo pricing page](https://kunavo.com/pricing) for the current ones. A model Kunavo adds later also works with the `kunavo/` prefix, but LiteLLM records its spend as $0 until it has a price, which you can set on the deployment with `input_cost_per_token` and `output_cost_per_token`.

| Model | Context window | Max output tokens | Native `/v1/messages` |
|-------|----------------|-------------------|-----------------------|
| `kunavo/claude-fable-5-2` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-fable-5-1` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-fable-5` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-opus-5-5` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-opus-5` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-opus-4-8` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-opus-4-7` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-opus-4-6` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-sonnet-5-5` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-sonnet-5` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-sonnet-4-6` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-haiku-5-5` | 1,000,000 | 128,000 | Yes |
| `kunavo/claude-haiku-4-5` | 200,000 | 64,000 | Yes |
| `kunavo/gpt-6-astra` | 1,050,000 | 128,000 | No |
| `kunavo/gpt-6-sol` | 1,050,000 | 128,000 | No |
| `kunavo/gpt-6-luna` | 1,050,000 | 128,000 | No |
| `kunavo/gpt-5-6-sol` | 1,050,000 | 128,000 | No |
| `kunavo/gpt-5-6-terra` | 1,050,000 | 128,000 | No |
| `kunavo/gpt-5-5` | 1,050,000 | 128,000 | No |
