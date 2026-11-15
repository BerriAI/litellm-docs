---
title: "AIGROW API with LiteLLM: Python SDK and Gateway"
sidebar_label: "AIGROW"
description: Call Claude, GPT, Gemini and Grok models on AIGROW through LiteLLM with the Python SDK or Gateway. Configure your API key, model name, and optional API base.
---

# AIGROW

[AIGROW](https://aigrow.gg/ai-api) serves Claude, GPT, Gemini and Grok models behind one API key, on an endpoint that speaks both the OpenAI Chat Completions and the Anthropic Messages format. Use the `aigrow/` prefix with a model id from AIGROW.

<SinceVersion v="1.111.0" />

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `aigrow/` |
| API key environment variable | `AIGROW_API_KEY` |
| Default API base | `https://aigrow.gg/v1` |
| Optional API base override | `AIGROW_API_BASE` or the `api_base` parameter |
| Upstream endpoints | `/chat/completions` for every model, `/messages` for the Claude models |
| Provider documentation | [AIGROW API guide](https://aigrow.gg/ai-api/guide) |

## Setup

Create a key under **API access** in the AIGROW dashboard. Keys start with `ag_`. Export it before you start the SDK or proxy:

```bash
export AIGROW_API_KEY="ag_your-key"
```

Use `aigrow/<model-id>` with an id that `GET https://aigrow.gg/v1/models` returns for your key, for example `aigrow/claude-sonnet-5.5`. LiteLLM removes the `aigrow/` prefix before it sends the model value to AIGROW. Send the id exactly as AIGROW lists it, since AIGROW answers 404 for a dated id or a model it does not serve.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="aigrow/claude-sonnet-5.5",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python
from litellm import completion

response = completion(
    model="aigrow/claude-sonnet-5.5",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

Every AIGROW model accepts tools and `reasoning_effort`. Reasoning tokens count toward `max_tokens`, so leave room for both, or the response can end before any visible text.

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: claude-sonnet-5.5
    litellm_params:
      model: aigrow/claude-sonnet-5.5
      api_key: os.environ/AIGROW_API_KEY
  - model_name: gemini-4-argon
    litellm_params:
      model: aigrow/gemini-4-argon
      api_key: os.environ/AIGROW_API_KEY
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
    "model": "claude-sonnet-5.5",
    "messages": [{"role": "user", "content": "Say hello in five words"}],
    "max_tokens": 2000
  }'
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your AIGROW API key.

## Anthropic Messages and Responses API

LiteLLM sends [Anthropic Messages](/docs/anthropic_unified) requests for the Claude models straight to AIGROW's `/v1/messages` endpoint, so `cache_control` breakpoints and thinking blocks pass through without translation. Messages requests for the other models, and every [Responses API](/docs/response_api) request, go through AIGROW's chat completions endpoint and LiteLLM's translation layer.
