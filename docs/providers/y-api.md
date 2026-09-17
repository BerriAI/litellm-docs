# Y-API

## Overview

| Property | Details |
|-------|-------|
| Description | Y-API is an OpenAI-compatible relay that fronts models from DeepSeek, Z.ai, Moonshot, Tencent, Xiaomi, Qwen and OpenAI behind a single API key. It also serves the Anthropic Messages API and the OpenAI Responses API. |
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

`GET /v1/models` currently returns fifteen models. Prices below are USD per million tokens.

| Model | Input | Output |
|-------|-------|--------|
| `deepseek/deepseek-v4-flash` | free | free |
| `deepseek/deepseek-v4-flash-0731` | $0.0075 | $0.015 |
| `deepseek/deepseek-v4-pro` | $0.025 | $0.05 |
| `deepseek/deepseek-v4.1-flash` | $0.01 | $0.05 |
| `moonshotai/kimi-k3` | $0.15 | $0.75 |
| `openai/gpt-5.6-luna` | $0.015 | $0.065 |
| `openai/gpt-5.6-sol` | $0.25 | $1.50 |
| `openai/gpt-5.6-terra` | $0.10 | $0.60 |
| `openai/gpt-6-astra` | $0.50 | $2.50 |
| `qwen/qwen3.8-flash` | $0.01 | $0.05 |
| `tencent/hy3` | free | free |
| `xiaomi/mimo-v2.5` | free | free |
| `z-ai/glm-5.2` | $0.07 | $0.22 |
| `z-ai/glm-5.3` | $0.07 | $0.25 |
| `z-ai/glm-5.3-flash` | $0.0075 | $0.025 |

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
| `openai/gpt-5.6-luna` / `sol` / `terra` | `none`, `low`, `medium`, `high`, `xhigh` |
| `openai/gpt-6-astra` | `low`, `medium`, `high`, `xhigh` |
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

LiteLLM already sends `max_completion_tokens` for these models, so no extra configuration is
needed — this only matters if you call the API directly.

## Embeddings

Y-API does not serve embedding models, so `litellm.embedding()` is not supported. Point
embeddings at another provider.
