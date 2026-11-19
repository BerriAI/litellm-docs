---
title: "API Store API with LiteLLM: Python SDK and Gateway"
sidebar_label: "API Store"
description: Call DeepSeek V4.1 models from API Store through LiteLLM with the Python SDK or Gateway. Configure your API key, model name, and optional API base.
---

# API Store

[API Store](https://apistore.cloud) is a prepaid API gateway with an OpenAI-compatible chat completions API for DeepSeek V4.1 models. Use the `apistore/` prefix with a model name from the API Store price list.

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

| Model | Context window | Max output tokens |
|-------|----------------|-------------------|
| `apistore/deepseek-v4-1-flash` | 1,048,576 | 393,216 |
| `apistore/deepseek-v4-1-flash-economy` | 1,048,576 | 393,216 |

Both models support streaming, tool calls, and prompt caching. LiteLLM prices both models from its model cost map, so spend tracking and budgets work without extra configuration.

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

The model cost map uses the API Store standard prices. API Store charges half of these prices outside its peak hours, which are 09:00 to 12:00 and 14:00 to 18:00 UTC+8 on weekdays. Outside these hours, LiteLLM records a higher cost than API Store charges. The API Store usage page shows the exact charge of each request, and the [API Store price list](https://apistore.cloud/pricing) shows the current prices.
