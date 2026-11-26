---
title: "Lyceum API with LiteLLM: Python SDK and Gateway"
sidebar_label: "Lyceum"
description: Call Lyceum's serverless open models through LiteLLM with the Python SDK or Gateway. Configure your API key, model name, and optional API base.
---

# Lyceum

[Lyceum](https://lyceum.technology) is a European GPU cloud with serverless inference for open models through an OpenAI-compatible API. Use the `lyceum/` prefix with a model ID from Lyceum's model list.

<SinceVersion v="1.113.0" />

Provider support was added in [PR #54744](https://github.com/BerriAI/litellm/pull/54744). Use this version or a later build that includes the provider.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `lyceum/` |
| API key environment variable | `LYCEUM_API_KEY` |
| Default API base | `https://api.lyceum.technology/openai/v1` |
| Optional API base override | `LYCEUM_API_BASE` or the `api_base` parameter |
| Upstream endpoints | `/chat/completions`, `/embeddings` |
| Provider documentation | [Lyceum serverless inference](https://docs.lyceum.technology/docs/inference/serverless) |

## Setup

Create an API key in the [Lyceum dashboard](https://dashboard.lyceum.technology) and export it before you start the SDK or proxy:

```bash
export LYCEUM_API_KEY="your-lyceum-api-key"
```

Lyceum model IDs keep their vendor prefix, so a LiteLLM model name has two slashes, for example `lyceum/z-ai/glm-5.3`. LiteLLM removes the `lyceum/` prefix and sends `z-ai/glm-5.3` to Lyceum. `GET https://api.lyceum.technology/openai/v1/models` lists the IDs your key can use.

## Models with prices in LiteLLM

| LiteLLM model name | Context | Notes |
|---|---|---|
| `lyceum/z-ai/glm-5.3` | 1M | |
| `lyceum/z-ai/glm-5.3-flash` | 1M | images and video in |
| `lyceum/moonshotai/kimi-k3.1-pro` | 1M | images in |
| `lyceum/moonshotai/kimi-k2.7-code` | 256K | images in |
| `lyceum/deepseek/deepseek-v4.1-flash-1017` | 1M | images in, also callable as `lyceum/deepseek/deepseek-v4.1-flash` |
| `lyceum/deepseek/deepseek-v4-flash-0731` | 1M | |
| `lyceum/minimax/minimax-m3.1-flash` | 1M | images and video in |
| `lyceum/qwen/qwen3.8-27b` | 256K | images and video in |
| `lyceum/qwen/qwen3.8-2.4t-a95b` | 256K | |
| `lyceum/qwen/qwen3-embedding-8b` | 32K | embeddings |

All chat models support tool calls and reasoning. `z-ai/glm-5.3-instant`, `z-ai/glm-5.3-flash-instant` and `qwen/qwen3.8-27b-instant` are the same models with reasoning turned off, at the same price.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="lyceum/z-ai/glm-5.3-flash",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python
from litellm import completion

response = completion(
    model="lyceum/z-ai/glm-5.3-flash",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

Reasoning is on by default for most models, and reasoning tokens count toward `max_tokens`, so leave room for both. Pass `reasoning_effort="none"` to turn it off where the model allows it, or use an `-instant` model name.

### Embeddings

```python
from litellm import embedding

response = embedding(
    model="lyceum/qwen/qwen3-embedding-8b",
    input=["Lyceum runs open models in Europe"],
)

print(len(response.data[0]["embedding"]))
```

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: glm-5.3-flash
    litellm_params:
      model: lyceum/z-ai/glm-5.3-flash
      api_key: os.environ/LYCEUM_API_KEY
```

Start the proxy with the API key exported in its environment:

```bash
litellm --config config.yaml
```

Send a request using the configured model alias:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-5.3-flash",
    "messages": [{"role": "user", "content": "Say hello in five words"}],
    "max_tokens": 2000
  }'
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your Lyceum API key.
