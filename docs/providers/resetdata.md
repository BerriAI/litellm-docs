---
title: "ResetData API with LiteLLM: Python SDK and Gateway"
sidebar_label: "ResetData"
description: "Call ResetData's GLM, Qwen, Gemma and DeepSeek models from the LiteLLM Python SDK or AI Gateway, with streaming, reasoning_effort, USD spend tracking and the Messages and Responses bridges."
---

# ResetData

[ResetData](https://docs.resetdata.ai) is an Australian sovereign AI-inference platform with an OpenAI-compatible chat completions API. ResetData model ids are `provider/model` slugs, so full LiteLLM model ids have three segments, for example `resetdata/zai/glm-5.3`. LiteLLM removes only the `resetdata/` prefix before it sends the model value to ResetData.

<SinceVersion v="1.112.0" />

Provider support was added in [PR #50819](https://github.com/BerriAI/litellm/pull/50819). Use this version or a later build that includes the provider.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `resetdata/` |
| API key environment variable | `RESETDATA_API_KEY` |
| Default API base | `https://api.resetdata.ai/api/v1` |
| Optional API base override | `RESETDATA_API_BASE` or the `api_base` parameter |
| Upstream endpoint | `/chat/completions` |
| Provider documentation | [ResetData docs](https://docs.resetdata.ai) |

## Setup

Create an API key in the ResetData platform and export it before you start the SDK or Gateway:

```bash
export RESETDATA_API_KEY="your-resetdata-api-key"
```

Pick a model from the ResetData catalog and prepend the `resetdata/` prefix, for example `resetdata/zai/glm-5.3`.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="resetdata/zai/glm-5.3",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python
from litellm import completion

response = completion(
    model="resetdata/zai/glm-5.3",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

Several ResetData models support reasoning, and reasoning tokens count toward `max_tokens`. Leave enough room for both, or the response can end before any visible text.

The reasoning models in the table below accept `reasoning_effort`. For a model without reasoning, LiteLLM rejects `reasoning_effort` with `UnsupportedParamsError` before it calls ResetData. Set `drop_params=True` on the call, or `drop_params: true` under `litellm_settings` on the Gateway, to drop the parameter and send the rest of the request.

## LiteLLM Gateway

Install the proxy with `pip install 'litellm[proxy]'`. Set `RESETDATA_API_KEY` on the Gateway process, and set `LITELLM_MASTER_KEY` to a strong key for Gateway clients. The ResetData key authenticates upstream requests. The master key authenticates your client to LiteLLM.

```bash
export RESETDATA_API_KEY="your-resetdata-api-key"
export LITELLM_MASTER_KEY="sk-your-strong-master-key"
```

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: resetdata-glm-5.3
    litellm_params:
      model: resetdata/zai/glm-5.3
      api_key: os.environ/RESETDATA_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash
litellm --config config.yaml --port 4000
```

In a second terminal with `LITELLM_MASTER_KEY` set, send a request using the configured model alias:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "resetdata-glm-5.3",
    "messages": [{"role": "user", "content": "Say hello in five words"}],
    "max_tokens": 2000
  }'
```

The proxy returns an OpenAI-format chat completion. The usage block reports reasoning tokens separately:

```json
{
  "choices": [{"message": {"role": "assistant", "content": "Hello there, friend, how are you?"}}],
  "usage": {
    "completion_tokens": 25,
    "prompt_tokens": 17,
    "total_tokens": 42,
    "completion_tokens_details": {"reasoning_tokens": 15, "text_tokens": 10}
  }
}
```

LiteLLM also accepts [Anthropic Messages](/docs/anthropic_unified) and [Responses API](/docs/response_api) requests for ResetData models through its translation layer. These requests use ResetData's chat completions endpoint, not native ResetData Messages or Responses endpoints.

## Supported Models

These ResetData models are in the LiteLLM catalog with their context windows, output caps and prices, so LiteLLM tracks spend for them in USD. ResetData bills in Australian dollars, and the catalog prices are converted at one dated exchange rate, so they drift from your ResetData invoice as the AUD moves.

| Model | Context window | Max output tokens | Reasoning | Vision |
|-------|----------------|-------------------|-----------|--------|
| `resetdata/zai/glm-5.3` | 524,288 | 32,768 | Yes | No |
| `resetdata/qwen/qwen3.8-27b` | 262,144 | 32,768 | Yes | Yes |
| `resetdata/qwen/qwen3-coder-30b-a3b-instruct` | 262,144 | 65,536 | No | No |
| `resetdata/google/gemma-4-26b-a4b-it` | 262,144 | 8,192 | No | Yes |
| `resetdata/deepseek/deepseek-v4-flash` | 1,048,576 | 65,536 | Yes | No |

To bill at your own ResetData rates instead, set per-token costs in USD on the deployment. The values below are an example, not ResetData's prices:

```yaml
model_list:
  - model_name: resetdata-glm-5.3
    litellm_params:
      model: resetdata/zai/glm-5.3
      api_key: os.environ/RESETDATA_API_KEY
      input_cost_per_token: 0.0000006
      output_cost_per_token: 0.0000022
```
