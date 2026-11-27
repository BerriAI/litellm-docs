---
title: "Straitly API with LiteLLM AI Gateway"
sidebar_label: "Straitly"
description: Call Straitly models through LiteLLM with the Python SDK or Gateway. Configure your API key and optional API base, then use chat completions, Responses or Messages.
---

# Straitly

[Straitly](https://straitly.ai) is an AI gateway with one OpenAI-compatible API key for more than 150 models, including Claude, GPT, Gemini, Grok and DeepSeek. Use the `straitly/` prefix with any model ID from the [Straitly model list](https://straitly.ai/models).

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `straitly/` |
| API key environment variable | `STRAITLY_API_KEY` |
| Default API base | `https://api.straitly.ai/v1` |
| Optional API base override | `STRAITLY_API_BASE` or the `api_base` parameter |
| Upstream endpoints | `/chat/completions`, `/responses`, `/messages` |
| Provider documentation | [Straitly quickstart](https://straitly.ai/docs/quickstart) |

## Setup

Create an API key in your Straitly account and export it before you start the SDK or proxy:

```bash
export STRAITLY_API_KEY="your-straitly-api-key"
```

Use `straitly/<model-id>` with a model ID from the Straitly model list. Some model IDs contain a slash, such as `deepseek/deepseek-v4-1-flash-1017`; LiteLLM removes only the `straitly/` prefix and sends the rest of the ID to Straitly unchanged.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="straitly/deepseek/deepseek-v4-1-flash-1017",
    messages=[{"role": "user", "content": "Hello from LiteLLM"}],
    max_tokens=128,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python
from litellm import completion

response = completion(
    model="straitly/deepseek/deepseek-v4-1-flash-1017",
    messages=[{"role": "user", "content": "Hello from LiteLLM"}],
    max_tokens=128,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

LiteLLM forwards `tools` and `tool_choice` to Straitly. Tool calling and reasoning support depend on the selected model.

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: straitly-deepseek
    litellm_params:
      model: straitly/deepseek/deepseek-v4-1-flash-1017
      api_key: os.environ/STRAITLY_API_KEY
  - model_name: straitly-sonnet
    litellm_params:
      model: straitly/claude-sonnet-5-5
      api_key: os.environ/STRAITLY_API_KEY
```

Start the proxy with the API key exported in its environment:

```bash
litellm --config config.yaml
```

Send requests using the configured model alias:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "straitly-deepseek",
    "messages": [{"role": "user", "content": "Hello from LiteLLM"}],
    "max_tokens": 128
  }'
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your Straitly API key.

You can also add Straitly from the Admin UI. Go to Models, then Add Model, pick Straitly as the provider, enter a `straitly/` model ID and paste your key. The API Base field is optional and defaults to `https://api.straitly.ai/v1`.

## Responses and Anthropic Messages

The proxy's `/v1/responses` and `/v1/messages` endpoints, and `litellm.responses()` and `litellm.anthropic.messages.acreate()` in the SDK, call Straitly's own `/responses` and `/messages` endpoints for `straitly/` models.

```bash
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "straitly-sonnet",
    "max_tokens": 128,
    "messages": [{"role": "user", "content": "Hello from LiteLLM"}]
  }'
```

## Cost tracking

LiteLLM has no cost map rows for `straitly/` models, so it does not compute spend for them. To track spend, set `input_cost_per_token` and `output_cost_per_token` in `litellm_params` for each model, as described in [custom pricing](/docs/proxy/custom_pricing).
