---
title: Adaption
description: Call Adaption models through LiteLLM with the Python SDK or Gateway. Configure your API key, model name, and optional API base.
---

# Adaption

[Adaption](https://adaptionlabs.ai) serves open-weight models through an OpenAI-compatible API with chat completions and Responses endpoints. Use the `adaption/` prefix with an Adaption model name.

<SinceVersion v="1.111.0" />

Provider support was added in [PR #TODO](https://github.com/BerriAI/litellm/pulls). Use this version or a later build that includes the provider.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `adaption/` |
| API key environment variable | `ADAPTION_API_KEY` |
| Default API base | `https://api.prod.adaptionlabs.ai/api/v1` |
| Optional API base override | `ADAPTION_API_BASE` or the `api_base` parameter |
| Upstream endpoints | `/chat/completions`, `/responses` |
| Provider documentation | [Adaption docs](https://docs.adaptionlabs.ai) |

## Setup

Create an API key in Adaption and export it before you start the SDK or proxy:

```bash
export ADAPTION_API_KEY="your-adaption-api-key"
```

Use `adaption/<model-name>`, for example `adaption/glm-5.2`. Available models: `glm-5.2`, `glm-5.3-flash`, `qwen3.5-397b`, `qwen3.8-27b`, `deepseek-v4-flash`, `gemma-4-31b-it`, and `gemma-4-26b-a4b-it`. LiteLLM removes the `adaption/` prefix before it sends the model value to Adaption.

All models support streaming, tool calling, and structured output. Image input (`image_url`) works on the Gemma and Qwen models and on `glm-5.3-flash`.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="adaption/glm-5.2",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python
from litellm import completion

response = completion(
    model="adaption/glm-5.2",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

Adaption's models support reasoning. The reasoning text is returned in `message.reasoning_content`, and reasoning tokens count toward `max_tokens`. Leave enough room for both, or the response can end before any visible text.

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: glm-5.2
    litellm_params:
      model: adaption/glm-5.2
      api_key: os.environ/ADAPTION_API_KEY
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
    "model": "glm-5.2",
    "messages": [{"role": "user", "content": "Say hello in five words"}],
    "max_tokens": 2000
  }'
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your Adaption API key.

[Responses API](/docs/response_api) requests go to Adaption's native `/responses` endpoint. LiteLLM also accepts [Anthropic Messages](/docs/anthropic_unified) requests for Adaption models through its translation layer, which uses Adaption's chat completions endpoint.
