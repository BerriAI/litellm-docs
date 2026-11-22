---
title: "API Store API with LiteLLM: Python SDK and Gateway"
sidebar_label: "API Store"
description: Call Claude, GPT, Gemini, and DeepSeek V4.1 models from API Store through LiteLLM with the Python SDK or Gateway. Configure your API key, model name, and optional API base.
---

# API Store

[API Store](https://apistore.cloud) is a prepaid API gateway with an OpenAI-compatible chat completions API for Claude, GPT, Gemini, and DeepSeek V4.1 models. One API key reaches all of them. Use the `apistore/` prefix with a model name from the API Store price list.

<SinceVersion v="1.112.0" />

Provider support was added in [PR #52854](https://github.com/BerriAI/litellm/pull/52854). Use this version or a later build that includes the provider.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `apistore/` |
| API key environment variable | `APISTORE_API_KEY` |
| Default API base | `https://api.apistore.cloud/v1` |
| Optional API base override | `APISTORE_API_BASE` or the `api_base` parameter |
| Upstream endpoint | `/chat/completions` |
| Provider documentation | [API Store documentation](https://apistore.cloud/docs) |

## Supported models

| Model | Maker | Context window | Max output tokens |
|-------|-------|----------------|-------------------|
| `apistore/deepseek-v4-1-flash` | DeepSeek | 1,048,576 | 393,216 |
| `apistore/deepseek-v4-1-flash-economy` | DeepSeek | 1,048,576 | 393,216 |
| `apistore/claude-fable-5` | Anthropic | 200,000 | 128,000 |
| `apistore/claude-fable-5-1` | Anthropic | 200,000 | 128,000 |
| `apistore/claude-haiku-4-5` | Anthropic | 200,000 | 64,000 |
| `apistore/claude-haiku-5-5` | Anthropic | 200,000 | 128,000 |
| `apistore/claude-opus-4-5` | Anthropic | 200,000 | 64,000 |
| `apistore/claude-opus-4-6` | Anthropic | 200,000 | 128,000 |
| `apistore/claude-opus-4-7` | Anthropic | 200,000 | 128,000 |
| `apistore/claude-opus-4-8` | Anthropic | 200,000 | 128,000 |
| `apistore/claude-opus-5` | Anthropic | 200,000 | 128,000 |
| `apistore/claude-opus-5-5` | Anthropic | 200,000 | 128,000 |
| `apistore/claude-sonnet-4-6` | Anthropic | 200,000 | 128,000 |
| `apistore/claude-sonnet-5` | Anthropic | 200,000 | 128,000 |
| `apistore/claude-sonnet-5-5` | Anthropic | 200,000 | 128,000 |
| `apistore/gpt-5.5` | OpenAI | 400,000 | 128,000 |
| `apistore/gpt-5.6-luna` | OpenAI | 400,000 | 128,000 |
| `apistore/gpt-5.6-sol` | OpenAI | 400,000 | 128,000 |
| `apistore/gpt-5.6-terra` | OpenAI | 400,000 | 128,000 |
| `apistore/gpt-6-astra` | OpenAI | 400,000 | 128,000 |
| `apistore/gpt-6-luna` | OpenAI | 400,000 | 128,000 |
| `apistore/gpt-6-sol` | OpenAI | 400,000 | 128,000 |
| `apistore/gpt-6.1-sol` | OpenAI | 400,000 | 128,000 |
| `apistore/gpt-6.1-terra` | OpenAI | 400,000 | 128,000 |
| `apistore/gpt-6.2-astra` | OpenAI | 400,000 | 128,000 |
| `apistore/gpt-6.2-sol` | OpenAI | 400,000 | 128,000 |
| `apistore/gemini-3.1-flash-lite` | Google | 1,048,576 | 65,536 |
| `apistore/gemini-3.1-pro` | Google | 1,048,576 | 65,536 |
| `apistore/gemini-3.1-pro-preview` | Google | 1,048,576 | 65,536 |
| `apistore/gemini-3.5-flash-lite` | Google | 1,048,576 | 65,536 |
| `apistore/gemini-3.6-flash` | Google | 1,048,576 | 65,536 |
| `apistore/gemini-3.8-flash` | Google | 1,048,576 | 65,536 |
| `apistore/gemini-4-argon` | Google | 1,048,576 | 65,536 |
| `apistore/gemini-4-carbon` | Google | 1,048,576 | 65,536 |
| `apistore/gemini-4-hydrogen` | Google | 1,048,576 | 65,536 |
| `apistore/gemini-4-neon` | Google | 1,048,576 | 65,536 |

All models support streaming, tool calls, and prompt caching. The Claude, GPT, and Gemini models also accept images and PDF files, and take `reasoning_effort` and `response_format`. API Store translates these requests for each model, so you send every model the same OpenAI chat completions format.

LiteLLM prices every model from its model cost map, so spend tracking and budgets work without extra configuration. The [API Store price list](https://apistore.cloud/pricing) shows the models that are on sale now.

## Setup

[Create an API Store account](https://apistore.cloud/signup), add balance, and create an API key on the API keys page. Export the key before you start the SDK or proxy:

```bash
export APISTORE_API_KEY="your-apistore-api-key"
```

LiteLLM removes the `apistore/` prefix before it sends the model value to API Store.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="apistore/deepseek-v4-1-flash",
    messages=[{"role": "user", "content": "Say hello"}],
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python
from litellm import completion

response = completion(
    model="apistore/deepseek-v4-1-flash",
    messages=[{"role": "user", "content": "Say hello"}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: deepseek-v4-1-flash
    litellm_params:
      model: apistore/deepseek-v4-1-flash
      api_key: os.environ/APISTORE_API_KEY
  - model_name: claude-sonnet-5-5
    litellm_params:
      model: apistore/claude-sonnet-5-5
      api_key: os.environ/APISTORE_API_KEY
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
    "model": "deepseek-v4-1-flash",
    "messages": [{"role": "user", "content": "Say hello"}]
  }'
```

The proxy returns an OpenAI-format chat completion, and the `x-litellm-response-cost` header shows the cost of the request:

```json
{
  "choices": [{"message": {"role": "assistant", "content": "Hello! How can I help you today?"}}],
  "usage": {
    "completion_tokens": 11,
    "prompt_tokens": 6,
    "total_tokens": 17
  }
}
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your API Store API key.

LiteLLM also accepts [Anthropic Messages](/docs/anthropic_unified) and [Responses API](/docs/response_api) requests for API Store models through its translation layer. These requests use the API Store chat completions endpoint.

## Pricing

The model cost map uses the API Store standard prices, with two exceptions that LiteLLM also records:

- **Off-peak prices.** The DeepSeek models cost half outside the API Store peak hours, which are 09:00 to 12:00 and 14:00 to 18:00 UTC+8 on weekdays. LiteLLM uses the off-peak prices outside these hours.
- **Long prompts.** Some models bill a whole request at higher prices once its prompt passes a size: Claude Haiku 5.5 above 100K tokens, Gemini 3.1 Pro above 200K tokens, and the GPT models above 272K tokens. LiteLLM uses the higher prices for these requests.

The API Store usage page shows the exact charge of each request, and the [API Store price list](https://apistore.cloud/pricing) shows the current prices.
