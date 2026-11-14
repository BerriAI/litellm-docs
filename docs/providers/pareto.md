---
title: Pareto Inference
description: Call GLM 5.3 Flash and DeepSeek V4.1 Flash on Pareto Inference through LiteLLM with the Python SDK or Gateway. Configure your API key, model name, and optional API base.
---

# Pareto Inference

[Pareto Inference](https://paretoinference.com) serves open models on an OpenAI-compatible API. Use the `pareto/` prefix with a model id from the Pareto API.

Provider support was added in [PR #42789](https://github.com/BerriAI/litellm/pull/42789). Use a build that includes it.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `pareto/` |
| API key environment variable | `PARETO_API_KEY` |
| Default API base | `https://api.paretoinference.com/v1` |
| Optional API base override | `PARETO_API_BASE` or the `api_base` parameter |
| Upstream endpoint | `/chat/completions` |
| Provider documentation | [Pareto Inference docs](https://docs.paretoinference.com) |

:::info Streaming only

Pareto only serves streamed requests. Pass `stream=True` (SDK) or `"stream": true` (Gateway). A non-streaming request returns a 400 error with code `streaming_only`, and so does a LiteLLM health check, since it sends a non-streaming request.

:::

## Setup

Create an API key in the [Pareto dashboard](https://paretoinference.com/dashboard) and export it before you start the SDK or proxy:

```bash
export PARETO_API_KEY="your-pareto-api-key"
```

LiteLLM removes the `pareto/` prefix before it sends the model value to Pareto, so `pareto/z-ai/glm-5.3-flash` reaches Pareto as `z-ai/glm-5.3-flash`.

## Models

| Model | Input / 1M tokens | Output / 1M tokens | Cached input / 1M tokens |
|-------|-------------------|--------------------|--------------------------|
| `pareto/z-ai/glm-5.3-flash` | $0.06 | $0.20 | $0.012 |
| `pareto/deepseek/deepseek-v4.1-flash` | $0.21 | $0.84 | $0.0042 |

DeepSeek V4.1 Flash bills half the listed rates off-peak. Peak hours are 01:00 to 04:00 and 06:00 to 10:00 UTC, Monday to Friday; all other hours are off-peak. LiteLLM applies the matching rate when it records spend.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="pareto/z-ai/glm-5.3-flash",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=512,
    stream=True,
    stream_options={"include_usage": True},
)

for chunk in response:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
```

Both models reason before they answer, and reasoning tokens count toward `max_tokens`. Leave enough room for both, or the response can end before any visible text.

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: glm-5.3-flash
    litellm_params:
      model: pareto/z-ai/glm-5.3-flash
      api_key: os.environ/PARETO_API_KEY
  - model_name: deepseek-v4.1-flash
    litellm_params:
      model: pareto/deepseek/deepseek-v4.1-flash
      api_key: os.environ/PARETO_API_KEY
```

Start the proxy with the API key exported in its environment:

```bash
litellm --config config.yaml
```

Send a streamed request using the configured model alias:

```bash
curl -N http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-5.3-flash",
    "stream": true,
    "max_tokens": 512,
    "messages": [{"role": "user", "content": "Say hello in five words"}]
  }'
```

The proxy streams OpenAI-format chunks and ends with `data: [DONE]`.

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your Pareto API key.

LiteLLM also accepts streamed [Anthropic Messages](/docs/anthropic_unified) and [Responses API](/docs/response_api) requests for Pareto models through its translation layer. These requests use Pareto's chat completions endpoint.

Pareto Inference is also listed in the Admin UI, under Models, then Add Model.
