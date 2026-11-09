---
title: StreamLake
description: Call StreamLake models through LiteLLM with the Python SDK or Gateway. Configure your API key, model or endpoint ID, and optional API base.
---

# StreamLake

[StreamLake](https://streamlake.ai) provides an OpenAI-compatible chat completions API. Use the `streamlake/` prefix with a model name or an endpoint ID from your StreamLake account.

<SinceVersion v="1.109.0-dev.2" />

Provider support was added in [PR #41006](https://github.com/BerriAI/litellm/pull/41006). Use this development version or a later build that includes the provider.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `streamlake/` |
| API key environment variable | `STREAMLAKE_API_KEY` |
| Default API base | `https://vanchin.streamlake.ai/api/gateway/v1/endpoints` |
| Optional API base override | `STREAMLAKE_API_BASE` or the `api_base` parameter |
| Upstream endpoint | `/chat/completions` |
| Provider documentation | [StreamLake API documentation](https://streamlake.ai/document/DOC/mg6k6nlp8j6qxicx4c9) |

## Setup

Create an API key in your StreamLake account and export it before you start the SDK or proxy:

```bash
export STREAMLAKE_API_KEY="your-streamlake-api-key"
```

Use `streamlake/<model-name>` for a model available to your account, or `streamlake/<endpoint-id>` for a deployed endpoint. Replace the example `ep-your-endpoint-id` below with your actual endpoint ID. LiteLLM removes the `streamlake/` prefix before it sends the model value to StreamLake.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="streamlake/ep-your-endpoint-id",
    messages=[{"role": "user", "content": "Hello from LiteLLM"}],
    max_tokens=128,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python
from litellm import completion

response = completion(
    model="streamlake/ep-your-endpoint-id",
    messages=[{"role": "user", "content": "Hello from LiteLLM"}],
    max_tokens=128,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

LiteLLM maps `max_tokens` to StreamLake's `max_completion_tokens`. Tool calling and reasoning support depend on the selected model.

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: streamlake-model
    litellm_params:
      model: streamlake/ep-your-endpoint-id
      api_key: os.environ/STREAMLAKE_API_KEY
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
    "model": "streamlake-model",
    "messages": [{"role": "user", "content": "Hello from LiteLLM"}],
    "max_tokens": 128
  }'
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your StreamLake API key.

LiteLLM also accepts [Anthropic Messages](/docs/anthropic_unified) and [Responses API](/docs/response_api) requests for chat models through its translation layer. These requests use StreamLake's chat completions endpoint, not native StreamLake Messages or Responses endpoints.
