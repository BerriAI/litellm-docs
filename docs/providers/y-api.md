# Y-API

## Overview

| Property | Details |
|-------|-------|
| Description | Y-API is an OpenAI-compatible relay that fronts models from Anthropic, DeepSeek, MiniMax, Moonshot, Qwen, StepFun, Tencent, Xiaomi, Z.ai and OpenAI behind a single API key. It also serves the Anthropic Messages API and the OpenAI Responses API. |
| Provider Route on LiteLLM | `y-api/` |
| Link to Provider Doc | [Y-API Website ↗](https://y-api.bestvirtualgoods.com) |
| Base URL | `https://api.y-api.bestvirtualgoods.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/completions`](#usage---legacy-completions), [`/responses`](#usage---responses-api), [`/messages`](#usage---anthropic-messages-api) |

<br />

## What is Y-API?

Y-API is a single endpoint in front of several model providers. One key covers all of the
models below, and the request and response shapes are the OpenAI ones, so any OpenAI client
works by changing the base URL.

Model ids keep the upstream organization prefix, exactly as `GET /v1/models` returns them:

```bash
curl https://api.y-api.bestvirtualgoods.com/v1/models \
  -H "Authorization: Bearer $YAPI_API_KEY"
```

Because those ids contain a slash of their own, a LiteLLM model string has two:
`y-api/deepseek/deepseek-v4-flash`. LiteLLM splits on the first slash, so this resolves
correctly — see [Model ids](#model-ids-contain-a-slash).

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["YAPI_API_KEY"] = ""  # your Y-API API key
```

Get your Y-API API key from [y-api.bestvirtualgoods.com](https://y-api.bestvirtualgoods.com).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Y-API Non-streaming Completion"
import os

from litellm import completion

os.environ["YAPI_API_KEY"] = ""  # your Y-API API key

messages = [{"content": "What is the capital of France?", "role": "user"}]

response = completion(
    model="y-api/deepseek/deepseek-v4-flash",
    messages=messages,
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Y-API Streaming Completion"
import os

from litellm import completion

os.environ["YAPI_API_KEY"] = ""  # your Y-API API key

messages = [{"content": "Write a short poem about relays", "role": "user"}]

response = completion(
    model="y-api/z-ai/glm-5.3",
    messages=messages,
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy Server

### 1. Save key in your environment

```bash
export YAPI_API_KEY=""
```

### 2. Start the proxy

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: y-api-deepseek
    litellm_params:
      model: y-api/deepseek/deepseek-v4-flash
      api_key: os.environ/YAPI_API_KEY
  - model_name: y-api-glm
    litellm_params:
      model: y-api/z-ai/glm-5.3
      api_key: os.environ/YAPI_API_KEY
```

```bash
litellm --config /path/to/config.yaml
```

## Usage - Legacy Completions

Y-API also serves `POST /v1/completions`, so the legacy text-completion route works for the
models that support it:

```python showLineNumbers title="Y-API Legacy Completions"
import os

from litellm import text_completion

os.environ["YAPI_API_KEY"] = ""  # your Y-API API key

response = text_completion(
    model="y-api/deepseek/deepseek-v4-flash",
    prompt="The capital of France is",
)

print(response.choices[0].text)
```

## Usage - Responses API

Y-API serves `POST /v1/responses`:

```python showLineNumbers title="Y-API Responses API"
import os

from litellm import responses

os.environ["YAPI_API_KEY"] = ""  # your Y-API API key

response = responses(
    model="y-api/openai/gpt-5.6-luna",
    input="What is the capital of France?",
)

print(response.output_text)
```

## Usage - Anthropic Messages API

Y-API serves `POST /v1/messages` with the Anthropic request and response shape. Through the
proxy this is reachable at the proxy's own `/v1/messages` route:

```bash
curl http://localhost:4000/v1/messages \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "y-api-deepseek",
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "What is the capital of France?"}]
  }'
```

## Supported Models

`GET /v1/models` currently returns twenty models. The catalog changes without notice, so treat
the table below as a snapshot rather than the source of truth.

Prices are USD per million tokens. Y-API publishes each model's **account credit** rate, and
converts top-ups at $1 paid = $10 credit, so every figure below is the credit price ÷ 10. Both
inputs are public and in one file — `credit_price` per model and `top_up.quota_rate` for the
conversion — at [pricing.json](https://y-api.bestvirtualgoods.com/pricing.json); read them there
rather than trusting this table long-term, because the conversion has moved before (a
limited-time 1:20 promo reverted to 1:10 on 2026-10-01, which doubled every cash figure).
Snapshot taken 2026-10-04.

| Model | Input | Output |
|-------|-------|--------|
| `anthropic/claude-opus-5` | $0.50 | $2.50 |
| `anthropic/claude-sonnet-5` | $0.20 | $1.00 |
| `deepseek/deepseek-v4-flash` | free | free |
| `deepseek/deepseek-v4-flash-0731` | $0.015 | $0.03 |
| `deepseek/deepseek-v4-pro` | $0.05 | $0.10 |
| `deepseek/deepseek-v4.1-flash` | $0.02 | $0.10 |
| `minimax/minimax-m2.7` | free | free |
| `moonshotai/kimi-k2.6` | $0.095 | $0.40 |
| `moonshotai/kimi-k3` | $0.30 | $1.50 |
| `openai/gpt-5.6-luna` | $0.03 | $0.13 |
| `openai/gpt-5.6-sol` | $0.50 | $3.00 |
| `qwen/qwen3.8-flash` | $0.02 | $0.05 |
| `stepfun/step-3.7-flash` | $0.02 | $0.12 |
| `tencent/hy3` | free | free |
| `tencent/hy4-preview` | $0.10 | $0.30 |
| `xiaomi/mimo-v2.5` | free | free |
| `xiaomi/mimo-v2.6-flash` | $0.018 | $0.036 |
| `z-ai/glm-5.2` | $0.14 | $0.44 |
| `z-ai/glm-5.3` | $0.14 | $0.50 |
| `z-ai/glm-5.3-flash` | $0.015 | $0.05 |

Models removed from the table since this page was written: `openai/gpt-5.6-terra` and
`openai/gpt-6-astra` returned `503 "No available channel"` and were absent from
`GET /v1/models` on 2026-10-04.

Add the `y-api/` prefix to any of these to use it through LiteLLM:

```python
completion(model="y-api/openai/gpt-5.6-sol", messages=messages)
```

## Model ids contain a slash

The relay returns ids with the upstream organization prefix, so a model string passed to
LiteLLM contains two slashes:

```python
#        provider  upstream org   model
completion(model="y-api/deepseek/deepseek-v4-flash", messages=messages)
```

LiteLLM resolves the provider from the first segment and forwards the rest unchanged, so the
upstream receives `deepseek/deepseek-v4-flash` exactly as it expects.

## Reasoning

The reasoning levels available depend on the model. Y-API accepts a narrower set than the
upstream labs do, so pass only what the model serves:

| Model | Accepted `reasoning_effort` |
|-------|-----------------------------|
| `openai/gpt-5.6-luna` / `sol` | `none`, `low`, `medium`, `high`, `xhigh` |
| `tencent/hy3` | `low`, `high` |

Values outside those sets are rejected with a `400` that names the accepted ones, for example:

```
Unsupported value: 'reasoning_effort' does not support 'max' with this model.
Supported values are: 'none', 'low', 'medium', 'high', and 'xhigh'.
```

## Token limits

The `openai/*` models reject `max_tokens` and require `max_completion_tokens`:

```
Unsupported parameter: 'max_tokens' is not supported with this model.
Use 'max_completion_tokens' instead.
```

LiteLLM rewrites the parameter for you, so `max_tokens` and `max_completion_tokens` behave
identically here and you can pass either. This only matters if you call the API directly.

## Embeddings

Y-API does not serve embedding models, so `litellm.embedding()` is not supported. Point
embeddings at another provider.
