import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Sail

## Overview

| Property | Details |
|-------|-------|
| Description | Sail Research serves open-weight models over an OpenAI-compatible API with a per-request completion window that trades latency for price |
| Provider Route on LiteLLM | `sail/` |
| Link to Provider Doc | [Sail Documentation](https://docs.sailresearch.com) |
| Default Base URL | `https://api.sailresearch.com/v1` |
| Supported Operations | `/chat/completions`, `/responses`, `/v1/messages` |

## API Key

```python showLineNumbers title="Environment Variables"
import os

os.environ["SAIL_API_KEY"] = "your-api-key"
os.environ["SAIL_API_BASE"] = "https://api.sailresearch.com/v1"  # optional override
```

## Models

Model names keep Sail's `org/model` id after the `sail/` prefix. Prices are dollars per 1M tokens as input / output / cache read, one column per Sail completion window, taken from the [Sail model list](https://docs.sailresearch.com/models) and [pricing page](https://docs.sailresearch.com/pricing). LiteLLM bills whichever window a request ran in (see [Completion windows](#completion-windows))

| Model | Context | `asap` | `balanced` | `flex` |
|-------|---------|--------|------------|--------|
| `sail/moonshotai/Kimi-K3` | 1,048,576 | 2.50 / 12.50 / 0.25 | 2.00 / 10.00 / 0.20 | 1.25 / 6.25 / 0.15 |
| `sail/zai-org/GLM-5.3` | 1,048,576 | 0.98 / 3.08 / 0.18 | 0.50 / 2.50 / 0.12 | 0.40 / 1.80 / 0.08 |
| `sail/zai-org/GLM-5.3-Flash` | 1,048,576 | 0.11 / 0.35 / 0.02 | 0.08 / 0.28 / 0.02 | 0.05 / 0.18 / 0.01 |
| `sail/deepseek-ai/DeepSeek-V4-Pro-0813` | 1,048,576 | 0.92 / 2.77 / 0.04 | 0.74 / 2.22 / 0.03 | 0.46 / 1.39 / 0.02 |
| `sail/deepseek-ai/DeepSeek-V4-Flash-0731` | 1,048,576 | 0.09 / 0.18 / 0.02 | 0.07 / 0.14 / 0.02 | 0.05 / 0.09 / 0.01 |
| `sail/deepseek-ai/DeepSeek-V4.1-Flash` | 1,048,576 | 0.15 / 0.60 / 0.006 | 0.12 / 0.48 / 0.005 | 0.08 / 0.30 / 0.004 |
| `sail/moonshotai/Kimi-K2.6` | 262,144 | 1.00 / 4.00 / 0.20 | 0.45 / 3.00 / 0.20 | 0.35 / 2.00 / 0.10 |
| `sail/google/gemma-4-31B-it` | 256,000 | 0.40 / 0.60 / 0.20 | 0.12 / 0.60 / 0.08 | 0.06 / 0.30 / 0.02 |
| `sail/nvidia/Gemma-4-31B-IT-NVFP4` | 262,144 | 0.14 / 0.40 / 0.07 | 0.11 / 0.32 / 0.06 | 0.07 / 0.20 / 0.04 |
| `sail/google/gemma-4-12B-it` | 16,384 | 0.30 / 2.00 / 0.15 | 0.10 / 2.00 / 0.07 | 0.05 / 1.00 / 0.02 |
| `sail/openai/gpt-oss-120b` | 131,072 | 0.06 / 0.40 / 0.03 | `asap` price | `asap` price |
| `sail/Qwen/Qwen3.6-35B-A3B` | 262,144 | 0.05 / 0.40 / 0.02 | `asap` price | 0.05 / 0.40 / 0.02 |

`Qwen/Qwen3.6-35B-A3B` is served in the `flex` window only and needs a background Responses request (see below). Where a model has no published price for a window, LiteLLM bills that window at the `asap` price. Any Sail model that is not in the table still works through the `sail/` route; it just has no automatic pricing until you set `input_cost_per_token` and `output_cost_per_token` on the deployment

## Usage - LiteLLM Python SDK

### Chat Completions

```python showLineNumbers title="Sail Chat Completion"
import os
from litellm import completion

os.environ["SAIL_API_KEY"] = "your-api-key"

response = completion(
    model="sail/zai-org/GLM-5.3-Flash",
    messages=[{"role": "user", "content": "Write a python function that reverses a string"}],
    max_tokens=1024,
)

print(response.choices[0].message.content)
```

`max_tokens` and `max_completion_tokens` are both forwarded as sent; Sail accepts and enforces either

### Streaming

```python showLineNumbers title="Sail Streaming Chat Completion"
import os
from litellm import completion

os.environ["SAIL_API_KEY"] = "your-api-key"

response = completion(
    model="sail/zai-org/GLM-5.3-Flash",
    messages=[{"role": "user", "content": "Explain a binary search in two sentences"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Responses API

```python showLineNumbers title="Sail Responses API"
import os
from litellm import responses

os.environ["SAIL_API_KEY"] = "your-api-key"

response = responses(
    model="sail/zai-org/GLM-5.3-Flash",
    input="Explain a binary search in two sentences",
)

print(response.output_text)
```

### Anthropic Messages API

Sail serves `POST /v1/messages` natively, so LiteLLM forwards the Anthropic request shape as is instead of translating it to chat completions. `max_tokens`, `system`, `thinking`, tools and `image` blocks all reach Sail unchanged

```python showLineNumbers title="Sail Anthropic Messages API"
import asyncio
import os
from litellm import anthropic_messages

os.environ["SAIL_API_KEY"] = "your-api-key"

response = asyncio.run(
    anthropic_messages(
        model="sail/zai-org/GLM-5.3-Flash",
        messages=[{"role": "user", "content": "Explain a binary search in two sentences"}],
        max_tokens=1024,
    )
)

print([block for block in response["content"] if block["type"] == "text"])
```

Reasoning models put a `thinking` block before the text block, so select content by `type` rather than reading `content[0]`. Sail's Messages endpoint is in beta and does not yet apply `cache_control` (accepted, no cache read or write), `stop_sequences`, `top_k`, document blocks or images inside `tool_result`. A non-streaming Messages request waits up to nine minutes before Sail returns a 408 with the response id in `X-Sail-Message-Id`; stream long-running requests instead

## Completion windows

Sail picks how fast a request runs, and what it costs, from `metadata.completion_window`: `asap` (the default, standard latency), `balanced` (slower, cheaper) or `flex` (slowest, cheapest). On LiteLLM you select the window with the OpenAI `service_tier` parameter, and LiteLLM writes the matching `completion_window` into the request and bills at that window's price. `flex` and `balanced` map to the Sail windows of the same name, `default` and `priority` map to `asap` (Sail has nothing faster), and `auto` sends no window so Sail applies its own default of `asap`. Values are case-insensitive. Any other `service_tier` value, or `service_tier` inside `extra_body`, is rejected with an `UnsupportedParamsError` before Sail is called; with `litellm.drop_params = True` or `drop_params: true` on the deployment the value is dropped instead and the request runs and bills at `asap`

```python showLineNumbers title="Balanced window on chat completions"
response = completion(
    model="sail/zai-org/GLM-5.3-Flash",
    messages=[{"role": "user", "content": "Summarize this document"}],
    service_tier="balanced",
)

print(response._hidden_params["response_cost"])  # billed at the balanced price
```

On chat completions `service_tier` is the only way to pick a window. A `completion_window` written into `metadata` or `extra_body.metadata` is rejected the same way as an unknown tier, because chat billing reads `service_tier` and the request would otherwise run at one price and be billed at another. Other keys in `extra_body.metadata` are kept and merged with the window LiteLLM adds

On the Responses API `service_tier` works the same way, and you may instead set `metadata.completion_window` directly. Sail's `standard` alias for `balanced` is accepted there and billed as `balanced`. Sending both a `service_tier` and a `metadata.completion_window` that disagree is a 400

On `/v1/messages` LiteLLM forwards the Anthropic body as is and ignores `service_tier`, like every other provider on that path, so Messages requests run and bill at `asap`

Sail may hold a `flex` chat completion open for minutes and time it out, so for `flex` it recommends a background Responses request and polling the returned id. Background mode accepts `balanced` and `flex` only; `asap` with `background: true` is a 400. LiteLLM forwards `background` as is:

```python showLineNumbers title="Flex window as a background Responses request"
response = responses(
    model="sail/Qwen/Qwen3.6-35B-A3B",
    input="Summarize this document",
    service_tier="flex",
    background=True,
)

print(response.id, response.status)  # resp_..., queued
```

## Usage - LiteLLM Proxy

Add Sail to your LiteLLM Proxy configuration. Clients can pass `service_tier` per request, or you can pin a deployment to a window by setting `service_tier` in its `litellm_params`; either way the request is billed at that window's price with no cost overrides needed:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: glm-5.3-flash
    litellm_params:
      model: sail/zai-org/GLM-5.3-Flash
      api_key: os.environ/SAIL_API_KEY
  - model_name: glm-5.3-flash-balanced
    litellm_params:
      model: sail/zai-org/GLM-5.3-Flash
      api_key: os.environ/SAIL_API_KEY
      service_tier: balanced
  - model_name: glm-5.3-flash-flex
    litellm_params:
      model: sail/zai-org/GLM-5.3-Flash
      api_key: os.environ/SAIL_API_KEY
      service_tier: flex

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export SAIL_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-sail"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Sail via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-sail",
)

response = client.chat.completions.create(
    model="glm-5.3-flash-balanced",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Sail via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "glm-5.3-flash-balanced",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>

<TabItem value="anthropic-sdk" label="Anthropic SDK">

```python showLineNumbers title="Sail via Proxy - Anthropic SDK"
from anthropic import Anthropic

client = Anthropic(
    base_url="http://localhost:4000",
    api_key="sk-local-sail",
)

message = client.messages.create(
    model="glm-5.3-flash",
    max_tokens=1024,
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(next(block.text for block in message.content if block.type == "text"))
```

</TabItem>

<TabItem value="responses" label="Responses API">

```bash showLineNumbers title="Sail via Proxy - flex background Responses"
curl http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "glm-5.3-flash-flex",
    "input": "hello from litellm",
    "background": true
  }'
```

</TabItem>
</Tabs>

You can also add Sail from the Admin UI. Go to Models, then Add Model, pick Sail as the provider, enter a `sail/` model name, and paste your key

## Cost Tracking

The `sail/` models are registered in LiteLLM's model cost map with a price for each completion window: the `asap` price in the usual `input_cost_per_token`, `output_cost_per_token` and `cache_read_input_token_cost` fields, plus `_balanced` and `_flex` variants of each. A request is billed from the fields of the window it was sent with, so spend is computed automatically per request, returned in the `x-litellm-response-cost` response header, and recorded in spend logs under provider `sail`. Cached input tokens reported by Sail are billed at that window's cache read rate. `/model/info` shows all three price sets; the `_balanced` and `_flex` fields are null for models of other providers

A deployment-level `input_cost_per_token` or `output_cost_per_token` override still takes precedence over the cost map, so only set one for a Sail model the cost map does not know

A background Responses request returns before Sail has generated anything, so there is no usage to price at request time. The proxy records that spend later through its [background cost poller](../response_api#cost-tracking-for-background-responses), which needs a Postgres database and the enterprise package; the minimal config above submits the request but does not log its spend

## Unsupported OpenAI parameters

Sail rejects a number of OpenAI chat parameters with a 400 instead of ignoring them: `frequency_penalty`, `presence_penalty`, `logit_bias`, `stop`, `seed`, `logprobs`, `top_logprobs`, `n` other than 1, `verbosity`, `prediction`, `audio`, `modalities`, `web_search_options`, `functions` and `function_call`. LiteLLM knows the first seven are unsupported on `sail/`, so with `litellm.drop_params = True` or `drop_params: true` on the deployment they are removed before the request leaves LiteLLM, and without it LiteLLM raises `UnsupportedParamsError` client-side. `service_tier` values outside `auto`, `default`, `priority`, `flex` and `balanced` are handled the same way (see [Completion windows](#completion-windows)). On the Responses API, `previous_response_id`, `conversation` and `prompt` are not supported, `truncation` only accepts `"disabled"`, `parallel_tool_calls` is accepted but has no effect, and server-side tools such as web search are stripped. Chat completions accept `response_format` of type `text`, `json_object` and `json_schema`; the Responses API accepts `text.format` of type `text` and `json_schema` only. `tool_choice: "required"` fails the request when the model does not call a tool, which Sail does not guarantee for `openai/gpt-oss-*`

## Other Sail request options

Everything below is a request field Sail reads and LiteLLM forwards untouched through `extra_body` (chat completions), `metadata` (Responses and Messages) or `extra_headers`. None of it changes how LiteLLM routes, retries or prices the request; `completion_window` is the one metadata key LiteLLM does manage, as described above

Completion webhooks: `metadata.completion_webhook` is a URL Sail POSTs the finished response to, with `metadata.webhook_token` sent as its bearer token. Delivery is best effort and may repeat, so make the receiver idempotent

Supercache: `metadata.supercache_write: "24h"` writes a prompt prefix of at least 1,025 tokens to Sail's 24 hour cache, at 100x the input price; later requests sharing the prefix read it automatically at 10% of the cached input price. Sail reports those reads inside `usage.input_tokens_details.cached_tokens`, which LiteLLM bills at the regular cache read rate, so Supercache spend is overstated in LiteLLM unless you override the deployment's prices

Prompt cache routing: `prompt_cache_key` and `user` are forwarded, so requests that share one land on the same Sail replica and reuse its prompt cache

Idempotency: pass `extra_headers={"Idempotency-Key": "..."}` on chat completions and Responses, or `anthropic-idempotency-key` on Messages. Sail returns the original response for a repeated key with the same body and a 400 for the same key with a different body. Keys are scoped to your Sail API key and capped at 255 bytes

US-only inference: `extra_body={"routing": {"allowed_countries": ["US"]}}` pins the request to US capacity on Sail's Pro and Enterprise plans, at a surcharge Sail bills but LiteLLM's cost map does not reflect. An `asap` request with no US capacity gets a 429; `balanced` and `flex` wait for it

Images: on models flagged `supports_vision`, up to 20 images of 20 MB each (JPEG, PNG, WebP, GIF) per request, as `image_url` parts on chat completions, `input_image` on Responses or `image` blocks on Messages. Public URLs must load within 10 seconds. Audio and file parts are rejected on every endpoint

## Rate limits and retries

All keys in a Sail organization share its request and concurrency limits. A 429 means a limit was hit and a 503 with code `model_capacity_unavailable` means the model is temporarily out of capacity; both carry `Retry-After`, which the LiteLLM Router honors when it retries. A timeout or 5xx on a request Sail may already have accepted can be billed twice if you retry it blindly, so for long `balanced` and `flex` work prefer background Responses and poll the id, or send an idempotency key. A streamed response can return HTTP 200 and still emit an error event later, so read the stream to the end

## Not supported through LiteLLM

Sail's Batch API (`/v1/batches`), LoRA adapters (`moonshotai/Kimi-K2.6` accepts rank 32 adapters uploaded through Sail), `POST /v1/messages/count_tokens` and `GET /v1/messages/{id}` retrieval have no LiteLLM route yet. Sail has no embeddings, image generation, audio or moderation endpoints, and LiteLLM rejects those calls on `sail/` before sending anything upstream

## Custom Endpoints

Set `SAIL_API_BASE` or pass `api_base` to point the `sail/` route at another Sail-compatible endpoint. Provider identity and pricing stay the same

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: glm-5.3-flash
    litellm_params:
      model: sail/zai-org/GLM-5.3-Flash
      api_base: https://your-sail-endpoint/v1
      api_key: os.environ/SAIL_API_KEY
```
