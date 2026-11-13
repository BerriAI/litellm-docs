---
title: Keln
description: Call open models on Keln through LiteLLM with the Python SDK or Proxy. Configure your API key, model name, and optional API base.
---

# Keln

[Keln](https://keln.ai) is an inference platform for open models with an OpenAI-compatible API. Use the `keln/` prefix with a model ID from the Keln catalog.

<SinceVersion v="[VERSION]" />

Provider support was added in [PR #[PR_NUMBER]](https://github.com/BerriAI/litellm/pull/[PR_NUMBER]). Use this version or a later build that includes the provider.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `keln/` |
| API key environment variable | `KELN_API_KEY` |
| Default API base | `https://api.keln.ai/v1` |
| Optional API base override | `KELN_API_BASE` or the `api_base` parameter |
| Upstream endpoints | `/chat/completions`, `/responses` |
| Model catalog | `https://api.keln.ai/v1/models` |
| Provider documentation | [Keln docs](https://docs.keln.ai) |

## Setup

Sign up at [app.keln.ai](https://app.keln.ai/signup), open **Keys**, select **Create key**, and export the key before you start the SDK or proxy:

```bash
export KELN_API_KEY="your-keln-api-key"
```

Use `keln/<model-id>` with an ID from `https://api.keln.ai/v1/models`, for example `keln/zai-org/glm-5.3`. LiteLLM removes only the `keln/` prefix, so Keln receives the full model ID `zai-org/glm-5.3`.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="keln/zai-org/glm-5.3",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python
from litellm import completion

response = completion(
    model="keln/zai-org/glm-5.3",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=2000,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

LiteLLM forwards `tools`, `tool_choice` and `reasoning_effort` to Keln for every model. The `reasoning_effort` levels each model accepts are listed under `reasoning.supported_efforts` in the model catalog. Reasoning tokens count toward `max_tokens`, so leave room for both reasoning and the visible answer. LiteLLM sends `max_completion_tokens` to Keln as `max_tokens`.

## Responses API

Keln serves the Responses API natively, and LiteLLM sends `responses()` calls to `https://api.keln.ai/v1/responses`:

```python
from litellm import responses

response = responses(
    model="keln/zai-org/glm-5.3",
    input="Say hello in five words",
    max_output_tokens=2000,
)

print(response.output_text)
```

LiteLLM also accepts [Anthropic Messages](/docs/anthropic_unified) requests for Keln models and sends them to Keln's chat completions endpoint.

## LiteLLM Proxy

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: glm-5.3
    litellm_params:
      model: keln/zai-org/glm-5.3
      api_key: os.environ/KELN_API_KEY
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
    "model": "glm-5.3",
    "messages": [{"role": "user", "content": "Say hello in five words"}],
    "max_tokens": 2000
  }'
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your Keln API key.
