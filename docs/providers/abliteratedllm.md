---
title: AbliteratedLLM
description: Call AbliteratedLLM models through LiteLLM with the Python SDK or Gateway. Configure the API key, model routes, reasoning effort, and the Responses API.
---

# AbliteratedLLM

<SinceVersion v="1.110.0" />

Use [AbliteratedLLM](https://abliteratedllm.dev) through LiteLLM with the `abliteratedllm/` model prefix. AbliteratedLLM serves an abliterated open-weight model, stock open-weight models, and two DeepSeek models answered by DeepSeek's official API, all with one OpenAI-compatible API key. LiteLLM reads `ABLITERATEDLLM_API_KEY` and sends requests to `https://api.abliteratedllm.dev/v1`.

## Overview

| Property | Details |
|----------|---------|
| Provider route | `abliteratedllm/` |
| API key environment variable | `ABLITERATEDLLM_API_KEY` |
| API base | `https://api.abliteratedllm.dev/v1` |
| Supported endpoints | `/chat/completions`, `/responses` |
| Provider documentation | [AbliteratedLLM docs](https://abliteratedllm.dev/docs) |

## Get started

Create an API key in your [AbliteratedLLM account](https://abliteratedllm.dev) and set `ABLITERATEDLLM_API_KEY` in your environment or secret manager. Install `litellm` for the Python SDK, or `litellm[proxy]` for the gateway.

```bash
export ABLITERATEDLLM_API_KEY="YOUR_ABLITERATEDLLM_API_KEY"
pip install litellm
```

```python
from litellm import completion

response = completion(
    model="abliteratedllm/glm-5.3-flash-abliterated",
    messages=[{"role": "user", "content": "Reply with hello."}],
    reasoning_effort="low",
)
print(response.choices[0].message.content)
```

A successful request returns an assistant reply and token usage. You do not need to set `api_base`.

## Models and pricing

Prices below are USD per million tokens, checked against the [published pricing](https://abliteratedllm.dev/pricing) and the live model catalog on November 9, 2026. `GET https://api.abliteratedllm.dev/v1/models` returns the current values and needs no API key; the [AbliteratedLLM models reference](https://abliteratedllm.dev/docs/models) explains each field. Context is the combined input and output budget, so the full output limit is available only when the prompt fits in the remaining context. The Model column shows the full LiteLLM route.

| Model | Context | Max output | Input | Cached input | Output | Input types | Type |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `abliteratedllm/glm-5.3-flash-abliterated` | 1,048,576 | 131,072 | $0.0977 | $0.0098 | $0.3421 | text, image | `abliterated` |
| `abliteratedllm/deepseek-v4.1-flash` | 1,048,576 | 393,216 | $0.30 | $0.006 | $1.20 | text | `official_api` |
| `abliteratedllm/deepseek-v4-pro` | 1,048,576 | 393,216 | $1.32 | $0.044 | $3.96 | text | `official_api` |
| `abliteratedllm/deepseek-v4.1-flash-1017` | 1,048,576 | 1,048,576 | $0.27 | $0.0054 | $1.08 | text, image | `stock` |
| `abliteratedllm/deepseek-v4.1-flash-1017-ultrafast` | 1,048,576 | 1,048,576 | $2.16 | $0.0432 | $8.64 | text | `stock` |
| `abliteratedllm/deepseek-v4.1-flash-original` | 1,048,576 | 1,048,576 | $0.27 | $0.0054 | $1.08 | text, image | `stock` |
| `abliteratedllm/glm-5.3-flash` | 1,048,576 | 1,048,576 | $0.135 | $0.027 | $0.45 | text, image, video | `stock` |
| `abliteratedllm/glm-5.3` | 1,048,576 | 1,048,576 | $1.26 | $0.234 | $3.96 | text | `stock` |
| `abliteratedllm/glm-5.3-fast` | 1,048,576 | 1,048,576 | $1.89 | $0.351 | $5.94 | text | `stock` |
| `abliteratedllm/kimi-k3` | 1,048,576 | 1,048,576 | $2.70 | $0.27 | $13.50 | text, image | `stock` |
| `abliteratedllm/kimi-k3.1-pro` | 1,048,576 | 1,048,576 | $1.80 | $0.18 | $9.00 | text, image | `stock` |
| `abliteratedllm/kimi-k3-fast` | 1,048,576 | 1,048,576 | $4.05 | $0.405 | $20.25 | text, image | `stock` |
| `abliteratedllm/ember-1` | 1,048,576 | 1,048,576 | $2.70 | $0.27 | $13.50 | text, image | `stock` |
| `abliteratedllm/muse-spark-open` | 1,048,576 | 1,048,576 | $1.125 | $0.135 | $3.825 | text, image | `stock` |
| `abliteratedllm/qwen3.8-max` | 262,144 | 262,144 | $1.80 | $0.225 | $5.40 | text, image | `stock` |
| `abliteratedllm/qwen3.8-2.4t-a95b` | 262,144 | 262,144 | $1.80 | $0.225 | $5.40 | text, image | `stock` |
| `abliteratedllm/minimax-m3` | 512,000 | 512,000 | $0.27 | $0.054 | $1.08 | text, image | `stock` |

The Type column is the catalog's `variant` field. `glm-5.3-flash-abliterated` is the only `abliterated` model: GLM-5.3 Flash weights with the refusal direction removed, served in native FP8. `stock` models run the vendor's original weights and keep the vendor's own refusals. `official_api` models are DeepSeek's stock models, answered by DeepSeek's official API. Prompts and outputs for them go to DeepSeek and are handled under the [DeepSeek Privacy Policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html), and DeepSeek can decline some requests on its side. IDs ending in `-fast` or `-ultrafast` serve the same model as the ID without the suffix, at a higher speed and higher prices. Their input types and priority tier can differ, so check their rows in the table and their catalog entries.

Models whose catalog entry sets `capabilities.priority_tier` also accept `service_tier="priority"` on Chat Completions, billed at the prices in `pricing.priority`. The table lists standard-tier prices. A model without `"image"` or `"video"` in its input types rejects those content parts with 400 `unsupported_content`.

## Gateway setup

Install the proxy with `pip install 'litellm[proxy]'`. Set `ABLITERATEDLLM_API_KEY` on the gateway process, and set `LITELLM_MASTER_KEY` to a strong key for gateway clients. The provider key authenticates upstream requests. The gateway key authenticates your client to LiteLLM.

Add this deployment to your existing configuration, or save it as `config.yaml` for a new gateway.

```yaml
model_list:
  - model_name: abliteratedllm-chat
    litellm_params:
      model: abliteratedllm/glm-5.3-flash-abliterated
      api_key: os.environ/ABLITERATEDLLM_API_KEY

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
    "model": "abliteratedllm-chat",
    "messages": [{"role": "user", "content": "Reply with hello."}],
    "reasoning_effort": "low"
  }'
```

Expect HTTP 200 with an assistant message in `choices[0].message.content` and counts in `usage`.

## Streaming and prompt caching

Set `stream=True` and request usage in the final chunk. The provider sends usage in a last chunk with an empty `choices` list, so check `chunk.choices` before you read it.

```python
from litellm import completion

stream = completion(
    model="abliteratedllm/glm-5.3-flash-abliterated",
    messages=[{"role": "user", "content": "Reply with hello."}],
    reasoning_effort="low",
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
    if getattr(chunk, "usage", None):
        print(chunk.usage)
```

Prompt caching is automatic. When a request starts with the same tokens as a recent one, the provider reads those tokens from cache and reports them in `usage.prompt_tokens_details.cached_tokens`. LiteLLM uses that count to charge reused input at the cached-input rate. Uncached input uses the standard input rate, and cache writes are not charged. Send the same `prompt_cache_key` on every request of a session to raise the hit rate. A repeated prompt does not guarantee a cache hit.

## Tools, structured output, and reasoning

Chat Completions supports function `tools`, `tool_choice`, and `parallel_tool_calls`. A tool whose `type` is not `function` returns 400. `response_format` with `json_object` works on every model, and `json_schema` works on every model except the two `official_api` DeepSeek models. Use [LiteLLM function calling](../completion/function_call.md) for tool-result continuations and [structured outputs](../completion/json_mode.md) for JSON Schema examples.

The provider passes `reasoning_effort` through to the model. Use `"low"`, `"medium"`, or `"high"`. Some models also accept `"none"`, which turns reasoning off. On `deepseek-v4.1-flash` and `deepseek-v4-pro`, thinking is on by default, and `reasoning_effort="none"` turns it off. Reasoning text, when returned, is available as `message.reasoning_content`. Reasoning tokens are billed as output tokens and count toward the output budget, which is 16,384 tokens when a request sets no `max_tokens`. See [AbliteratedLLM chat completions](https://abliteratedllm.dev/docs/chat-completions).

## Responses API

LiteLLM routes `responses()` to the provider's native `/v1/responses` endpoint. The endpoint is stateless: it stores no responses, and a request with `previous_response_id` or `background=True` returns 400 `stateless_only`. Send conversation history in `input`. The endpoint ignores `service_tier` and always bills at the standard tier, and video input is available only on Chat Completions.

```python
from litellm import responses

response = responses(
    model="abliteratedllm/glm-5.3-flash-abliterated",
    input="Reply with hello.",
    reasoning={"effort": "low"},
    store=False,
)
print(response.output)
```

Gateway clients can send the same request to `/v1/responses` with the configured deployment name. See [AbliteratedLLM Responses](https://abliteratedllm.dev/docs/responses).

## Troubleshooting

For `401`, check the key in the gateway process environment; a revoked or expired key also returns `invalid_api_key`. For `402`, `insufficient_balance` means the account needs credit, and `key_spend_cap_reached` means the key reached its daily, monthly, or lifetime cap. For `404 model_not_found`, compare the unprefixed model ID with `GET https://api.abliteratedllm.dev/v1/models`. For `429`, wait the number of seconds in `Retry-After` when the response includes it. See [AbliteratedLLM errors](https://abliteratedllm.dev/docs/errors).
