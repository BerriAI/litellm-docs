---
title: ResetData
description: Call ResetData models through LiteLLM with the Python SDK or Gateway. Configure your API key, model name, and optional API base.
---

# ResetData

[ResetData](https://docs.resetdata.ai) is an Australian sovereign AI-inference platform with an OpenAI-compatible chat completions API. ResetData model ids are `provider/model` slugs, so full LiteLLM model ids have three segments, for example `resetdata/zai/glm-5.3`. LiteLLM removes only the `resetdata/` prefix before it sends the model value to ResetData.

<SinceVersion v="1.110.0" />

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

Several ResetData models support reasoning, and reasoning tokens count toward `max_tokens`. Leave enough room for both, or the response can end before any visible text. The `reasoning_effort` levels each model accepts differ, and ResetData returns an error for a level the selected model does not accept.

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: resetdata-glm-5.3
    litellm_params:
      model: resetdata/zai/glm-5.3
      api_key: os.environ/RESETDATA_API_KEY
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
    "model": "resetdata-glm-5.3",
    "messages": [{"role": "user", "content": "Say hello in five words"}],
    "max_tokens": 2000
  }'
```

The proxy returns an OpenAI-format chat completion. The usage block reports reasoning tokens separately:

```json
{
  "choices": [{"message": {"role": "assistant", "content": "Hello there, nice to meet you"}}],
  "usage": {
    "completion_tokens": 22,
    "prompt_tokens": 21,
    "total_tokens": 43,
    "completion_tokens_details": {"reasoning_tokens": 16}
  }
}
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your ResetData API key.

## Supported Models

These ResetData models are in the LiteLLM catalog with their context windows and output caps. Pricing entries will be added in a follow-up change.

| Model | Context window | Max output tokens | Reasoning | Vision |
|-------|----------------|-------------------|-----------|--------|
| `resetdata/zai/glm-5.3` | 524,288 | 32,768 | Yes | No |
| `resetdata/zai/glm-5.2` | 800,000 | 32,768 | Yes | No |
| `resetdata/qwen/qwen3.8-27b` | 262,144 | 32,768 | Yes | Yes |
| `resetdata/qwen/qwen3-coder-30b-a3b-instruct` | 262,144 | 65,536 | No | No |
| `resetdata/google/gemma-4-26b-a4b-it` | 262,144 | 8,192 | No | Yes |
| `resetdata/deepseek/deepseek-v4-flash` | 1,048,576 | 65,536 | Yes | No |
