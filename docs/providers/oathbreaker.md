---
title: "Oathbreaker API with LiteLLM: Python SDK and Gateway"
sidebar_label: "Oathbreaker"
description: "Call Oathbreaker's abliterated GLM-5.3, DeepSeek V4.1 Flash and Kimi K3.1 Pro models from the LiteLLM Python SDK or AI Gateway, with streaming and tool calls."
---

# Oathbreaker

<SinceVersion v="1.112.0" />

Use [Oathbreaker AI](https://oathbreaker.ai) through LiteLLM with the `oathbreaker/` model prefix. LiteLLM reads `OATHBREAKER_API_KEY` and sends Chat Completions requests to `https://oathbreaker.ai/v1`.

Oathbreaker serves abliterated variants of Z.ai GLM-5.3, GLM-5.3 Flash, DeepSeek V4.1 Flash 1017 and Moonshot AI Kimi K3.1 Pro. It provides the gateway and account experience. See the [GLM-5.3](https://oathbreaker.ai/models/glm-5-3-abliterated), [Flash](https://oathbreaker.ai/models/glm-5-3-flash-abliterated), [DeepSeek](https://oathbreaker.ai/models/deepseek-v4-1-flash-abliterated) and [Kimi](https://oathbreaker.ai/models/kimi-k3-1-pro-abliterated) details for model provenance.

## Get started

Create an API key and add prepaid credit in your [Oathbreaker account](https://oathbreaker.ai). Set the key in your environment or secret manager.

```bash
export OATHBREAKER_API_KEY="YOUR_OATHBREAKER_API_KEY"
pip install litellm
```

```python
from litellm import completion

response = completion(
    model="oathbreaker/oathbreaker-glm-5.3",
    messages=[{"role": "user", "content": "Reply with hello."}],
    max_tokens=512,
    reasoning_effort="low",
    timeout=650,
    num_retries=0,
)
print(response.choices[0].message.content)
```

A successful request returns an assistant reply and token usage. You do not need to set `api_base`.

## Models and pricing

The [provider documentation](https://oathbreaker.ai/docs) and [pricing](https://oathbreaker.ai/pricing) publish these limits and USD prices per million tokens, checked November 21, 2026.

| Model ID | Shared context budget | Max output | Input | Cached input | Output |
| --- | ---: | ---: | ---: | ---: | ---: |
| `oathbreaker-glm-5.3` | 131,072 | 32,768 | $3.00 | $0.30 | $4.00 |
| `oathbreaker-glm-5.3-flash` | 131,072 | 32,768 | $0.40 | $0.05 | $1.20 |
| `oathbreaker-deepseek-v4.1-flash` | 131,072 units | 32,768 | $0.40 | $0.05 | $1.20 |
| `oathbreaker-deepseek-v4.1-flash-fast` | 131,072 units | 32,768 | $0.50 | $0.05 | $1.50 |
| `oathbreaker-kimi-k3.1-pro` | 131,072 units | 24,576 | $4.50 | $0.45 | $9.00 |

Use the model ID with the `oathbreaker/` prefix, such as `oathbreaker/oathbreaker-glm-5.3-flash`, in the SDK or gateway configuration. All five models use the same API key and base URL. DeepSeek V4.1 Flash Fast is a faster serving route for the same model. Kimi K3.1 Pro uses 8,192 output tokens when a request sets no output budget.

The DeepSeek and Kimi budgets count UTF-8 input bytes, framing and requested output tokens, and a request body can be at most 262,144 bytes. LiteLLM records a conservative 32,768-token input limit for the two DeepSeek models and Kimi K3.1 Pro.

Input, safety headroom, and requested output share the context budget. Reasoning tokens count toward output. The provider supports text input and output. Image input, audio, and embeddings are not supported.

## Gateway setup

Install `litellm[proxy]`. Set `OATHBREAKER_API_KEY` on the gateway process and `LITELLM_MASTER_KEY` to a strong key for your gateway clients. Save this as `config.yaml`.

```yaml
model_list:
  - model_name: oathbreaker-chat
    litellm_params:
      model: oathbreaker/oathbreaker-glm-5.3
      api_key: os.environ/OATHBREAKER_API_KEY
      max_tokens: 512
      reasoning_effort: low
      timeout: 650
      max_retries: 0

router_settings:
  num_retries: 0

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

```bash
litellm --config config.yaml --port 4000
```

In a second terminal with `LITELLM_MASTER_KEY` set, send a request.

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "oathbreaker-chat",
    "messages": [{"role": "user", "content": "Reply with hello."}],
    "max_tokens": 512,
    "reasoning_effort": "low"
  }'
```

Expect HTTP 200 with an assistant message in `choices[0].message.content` and token counts in `usage`.

## Streaming and cache accounting

```python
from litellm import completion

stream = completion(
    model="oathbreaker/oathbreaker-glm-5.3",
    messages=[{"role": "user", "content": "Reply with hello."}],
    max_tokens=512,
    reasoning_effort="low",
    stream=True,
    stream_options={"include_usage": True},
    timeout=650,
    num_retries=0,
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
    if getattr(chunk, "usage", None):
        print(chunk.usage)
```

The service includes final usage in the stream. LiteLLM calculates cached-input cost from `usage.prompt_tokens_details.cached_tokens`. Cached tokens are a subset of prompt tokens, so they are not also charged at the ordinary input rate. A repeated prompt does not guarantee a cache hit.

## Tools and reasoning

Chat Completions supports `tools`, `tool_choice`, and `parallel_tool_calls`. Your application validates arguments and executes tools. Return a tool result for every requested call, preserving the assistant's `reasoning_content` when present. See [function calling](../completion/function_call.md).

Use `reasoning_effort="low"`, `"high"`, or `"max"`. The provider defaults to `low`. Both `max_tokens` and `max_completion_tokens` are accepted, but use only one per request. Reasoning and final text share that output budget.

The endpoint accepts `response_format` for JSON objects and schemas, but does not guarantee strict schema enforcement. Validate the returned data in your application. LiteLLM does not advertise strict response-schema support for this model.

## Endpoint support and retries

This integration registers Chat Completions only. It does not register Oathbreaker's own Responses or Anthropic Messages endpoints.

Requests have a ten-minute upstream deadline. A client timeout does not prove that generation stopped. Check account usage and held credit before repeating a timed-out request. The examples disable automatic retries.

For `401`, check the API key. For insufficient-credit errors, check your prepaid balance. For `429`, follow the provider's retry guidance. Confirm the model alias through `GET https://oathbreaker.ai/v1/models` with your key.
