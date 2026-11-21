---
title: "Baidu Qianfan API with LiteLLM: Python SDK and Gateway"
sidebar_label: "Baidu Qianfan"
description: Call models hosted on Baidu Qianfan, such as DeepSeek-V4, through LiteLLM. Set the API key, turn thinking on or off, and add Qianfan models to a Gateway config.yaml.
---

# Baidu Qianfan

[Qianfan](https://cloud.baidu.com/product/qianfan.html) is Baidu's model platform. It serves Baidu's ERNIE models and third-party models such as DeepSeek through an OpenAI-compatible chat completions API. Use the `qianfan/` prefix with a model ID from the Qianfan model list.

<SinceVersion v="1.112.0" />

Provider support was added in [PR #49777](https://github.com/BerriAI/litellm/pull/49777). Use this version or a later build that includes the provider.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `qianfan/` |
| API key environment variable | `QIANFAN_API_KEY` |
| Default API base | `https://qianfan.baidubce.com/v2` |
| Optional API base override | `QIANFAN_API_BASE` or the `api_base` parameter |
| Upstream endpoint | `/chat/completions` |
| Provider documentation | [Qianfan model list](https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j) |

## Setup

Create an API key in the [Qianfan console](https://console.bce.baidu.com/qianfan/ais/console/apiKey). Qianfan keys have the form `bce-v3/ALTAK-...`. Export the key before you start the SDK or proxy:

```bash
export QIANFAN_API_KEY="bce-v3/ALTAK-your-key"
```

Use `qianfan/<model-id>` with an ID from the model list, for example `qianfan/deepseek-v4-pro`. LiteLLM removes the `qianfan/` prefix before it sends the model value to Qianfan.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="qianfan/deepseek-v4-pro",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python
from litellm import completion

response = completion(
    model="qianfan/deepseek-v4-pro",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
    stream=True,
    stream_options={"include_usage": True},
)

for chunk in response:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
```

Tool calling, `tool_choice` (including `"required"`), and `response_format` with `json_object` or `json_schema` use the standard OpenAI parameters.

## Thinking

Some Qianfan models think by default. The DeepSeek-V4 models return reasoning tokens even when the request sends no thinking parameter, and the reasoning counts toward `max_tokens`. Qianfan turns thinking on and off with its own `thinking: {"type": "enabled" | "disabled"}` body field. LiteLLM maps two parameters onto it.

The `thinking` parameter takes `{"type": "disabled"}` or `{"type": "enabled"}`. With `enabled`, a `budget_tokens` value becomes Qianfan's `thinking_budget`, which caps the length of the reasoning:

```python
from litellm import completion

plain = completion(
    model="qianfan/deepseek-v4-pro",
    messages=[{"role": "user", "content": "What is 17 * 23?"}],
    thinking={"type": "disabled"},
)

bounded = completion(
    model="qianfan/deepseek-v4-pro",
    messages=[{"role": "user", "content": "What is 17 * 23?"}],
    thinking={"type": "enabled", "budget_tokens": 1024},
)
```

`reasoning_effort="none"` also turns thinking off, so a client that uses the OpenAI parameter gets plain completions without Qianfan-specific code. When a request sends both, the explicit `thinking` value wins. Other `reasoning_effort` values go to Qianfan unchanged. Qianfan documents `high` and `max`, and it treats `low` and `medium` as `high` and `xhigh` as `max`. Whether a level changes the output depends on the model.

Through the proxy, an OpenAI client can send the same switch in the request body:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [{"role": "user", "content": "What is 17 * 23?"}],
    "reasoning_effort": "none"
  }'
```

## Qianfan-specific parameters

LiteLLM forwards `penalty_score`, `web_search`, `thinking_strategy`, `metadata`, and `enable_thinking` to Qianfan in the request body. Support differs by model, so check the model list before you depend on one. With the DeepSeek-V4 models, `enable_thinking: false` does not turn thinking off; use `thinking` or `reasoning_effort="none"`. A model without web search support answers a `web_search` request with HTTP 200 and a fixed refusal text instead of an error.

```python
from litellm import completion

response = completion(
    model="qianfan/deepseek-v4-pro",
    messages=[{"role": "user", "content": "Write one line about autumn."}],
    penalty_score=1.2,
)
```

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: deepseek-v4-pro
    litellm_params:
      model: qianfan/deepseek-v4-pro
      api_key: os.environ/QIANFAN_API_KEY
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
    "model": "deepseek-v4-pro",
    "messages": [{"role": "user", "content": "Say hello in five words"}],
    "max_tokens": 2000
  }'
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your Qianfan API key.

## Prompt caching and cost tracking

Qianfan reports cached prompt tokens in the standard `usage.prompt_tokens_details.cached_tokens` field. A repeated prompt prefix of about 19,000 tokens comes back with most of it cached on the second request, and LiteLLM passes the count through.

The LiteLLM model cost map has no Qianfan entries yet, so set prices on the deployment. Without `cache_read_input_token_cost`, LiteLLM bills cached tokens at the full input price. The values below are placeholders; use the per-token prices from your Qianfan bill or contract, converted to USD:

```yaml
model_list:
  - model_name: deepseek-v4-pro
    litellm_params:
      model: qianfan/deepseek-v4-pro
      api_key: os.environ/QIANFAN_API_KEY
    model_info:
      input_cost_per_token: 0.0000005
      output_cost_per_token: 0.000002
      cache_read_input_token_cost: 0.0000001
```

See [custom pricing](/docs/proxy/custom_pricing) for the other cost fields.
