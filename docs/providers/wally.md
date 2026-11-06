---
title: Wally
description: Call Wally models from RunAnywhere through LiteLLM with the Python SDK or Gateway. Configure your API key, model name, and optional API base.
---

# Wally

[Wally](https://runwally.com) is RunAnywhere's hosted inference for open models, with an OpenAI-compatible chat completions API. Use the `wally/` prefix with a model name from your Wally console.

<SinceVersion v="1.110.0" />

Provider support was added in [PR #45662](https://github.com/BerriAI/litellm/pull/45662). Use this version or a later build that includes the provider.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `wally/` |
| API key environment variable | `WALLY_API_KEY` |
| Default API base | `https://inference.runanywhere.ai/v1` |
| Optional API base override | `WALLY_API_BASE` or the `api_base` parameter |
| Upstream endpoint | `/chat/completions` |
| Provider documentation | [Wally OpenAI-compatible API](https://docs.runanywhere.ai/wally-cloud/api) |

## Setup

Create a cloud API key in the RunAnywhere console and export it before you start the SDK or proxy:

```bash
export WALLY_API_KEY="your-wally-api-key"
```

Use `wally/<model-name>` for a model listed in your console, for example `wally/glm-5.3-flash`. LiteLLM removes the `wally/` prefix before it sends the model value to Wally.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="wally/glm-5.3-flash",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python
from litellm import completion

response = completion(
    model="wally/glm-5.3-flash",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

Wally's models support reasoning, and reasoning tokens count toward `max_tokens`. Leave enough room for both, or the response can end before any visible text. The `reasoning_effort` levels each model accepts differ, and Wally returns a 400 error for a level the selected model does not accept.

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: glm-5.3-flash
    litellm_params:
      model: wally/glm-5.3-flash
      api_key: os.environ/WALLY_API_KEY
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

The proxy returns an OpenAI-format chat completion. The usage block reports the reasoning tokens separately:

```json
{
  "choices": [{"message": {"role": "assistant", "content": "Hi, nice to meet you!"}}],
  "usage": {
    "completion_tokens": 279,
    "prompt_tokens": 17,
    "total_tokens": 296,
    "completion_tokens_details": {"reasoning_tokens": 268}
  }
}
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your Wally API key.

LiteLLM also accepts [Anthropic Messages](/docs/anthropic_unified) and [Responses API](/docs/response_api) requests for Wally models through its translation layer. These requests use Wally's chat completions endpoint, not native Wally Messages or Responses endpoints.
