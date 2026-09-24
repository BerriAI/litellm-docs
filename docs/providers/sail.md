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
| Supported Operations | `/chat/completions`, `/responses` |

## API Key

```python showLineNumbers title="Environment Variables"
import os

os.environ["SAIL_API_KEY"] = "your-api-key"
os.environ["SAIL_API_BASE"] = "https://api.sailresearch.com/v1"  # optional override
```

## Models

Model names keep Sail's `org/model` id after the `sail/` prefix. Prices below are Sail's `asap` window in dollars per 1M tokens, taken from the [Sail model list](https://docs.sailresearch.com/models) and [pricing page](https://docs.sailresearch.com/pricing)

| Model | Context | Input | Output | Cache read |
|-------|---------|-------|--------|------------|
| `sail/moonshotai/Kimi-K3` | 1,048,576 | $2.50 | $12.50 | $0.25 |
| `sail/zai-org/GLM-5.3` | 1,048,576 | $0.98 | $3.08 | $0.18 |
| `sail/zai-org/GLM-5.3-Flash` | 1,048,576 | $0.11 | $0.35 | $0.02 |
| `sail/deepseek-ai/DeepSeek-V4-Pro-0813` | 1,048,576 | $0.92 | $2.77 | $0.04 |
| `sail/deepseek-ai/DeepSeek-V4-Flash-0731` | 1,048,576 | $0.09 | $0.18 | $0.02 |
| `sail/deepseek-ai/DeepSeek-V4.1-Flash` | 1,048,576 | $0.15 | $0.60 | $0.006 |
| `sail/moonshotai/Kimi-K2.6` | 262,144 | $1.00 | $4.00 | $0.20 |
| `sail/google/gemma-4-31B-it` | 262,144 | $0.40 | $0.60 | $0.20 |
| `sail/nvidia/Gemma-4-31B-IT-NVFP4` | 262,144 | $0.14 | $0.40 | $0.07 |
| `sail/google/gemma-4-12B-it` | 16,384 | $0.30 | $2.00 | $0.15 |
| `sail/openai/gpt-oss-120b` | 131,072 | $0.06 | $0.40 | $0.03 |
| `sail/Qwen/Qwen3.6-35B-A3B` | 262,144 | $0.05 | $0.40 | $0.02 |

`Qwen/Qwen3.6-35B-A3B` is served in the `flex` window only and needs a background Responses request (see below). Any Sail model that is not in the table still works through the `sail/` route; it just has no automatic pricing until you set `input_cost_per_token` and `output_cost_per_token` on the deployment

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

LiteLLM sends `max_tokens` to Sail as `max_completion_tokens`, which is the only form Sail accepts

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

## Completion windows

Sail picks how fast a request runs from `metadata.completion_window`: `asap` (the default, standard latency), `balanced` (slower, cheaper) or `flex` (slowest, cheapest). It is a plain metadata key, so pass it through `extra_body` on chat completions and through `metadata` on the Responses API. `service_tier` is not the selector; Sail only accepts `service_tier: "auto"`

```python showLineNumbers title="Balanced window on chat completions"
response = completion(
    model="sail/zai-org/GLM-5.3-Flash",
    messages=[{"role": "user", "content": "Summarize this document"}],
    extra_body={"metadata": {"completion_window": "balanced"}},
)
```

Sail may hold a `flex` chat completion open for minutes and time it out, so for `flex` it recommends a background Responses request and polling the returned id. Background mode accepts `balanced` and `flex` only; `asap` with `background: true` is a 400. LiteLLM forwards `background` and `metadata` as is:

```python showLineNumbers title="Flex window as a background Responses request"
response = responses(
    model="sail/Qwen/Qwen3.6-35B-A3B",
    input="Summarize this document",
    metadata={"completion_window": "flex"},
    background=True,
)

print(response.id, response.status)  # resp_..., queued
```

## Usage - LiteLLM Proxy

Add Sail to your LiteLLM Proxy configuration. To offer a window as its own model, put the `completion_window` in the deployment's `extra_body`:

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
      extra_body:
        metadata:
          completion_window: balanced
      input_cost_per_token: 0.00000008
      output_cost_per_token: 0.00000028
      cache_read_input_token_cost: 0.00000002
  - model_name: glm-5.3-flash-flex
    litellm_params:
      model: sail/zai-org/GLM-5.3-Flash
      api_key: os.environ/SAIL_API_KEY
      extra_body:
        metadata:
          completion_window: flex
      input_cost_per_token: 0.00000005
      output_cost_per_token: 0.00000018
      cache_read_input_token_cost: 0.00000001

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

The `sail/` models are registered in LiteLLM's model cost map at Sail's `asap` prices, so per-request spend is computed automatically, returned in the `x-litellm-response-cost` response header, and recorded in spend logs under provider `sail`. Cached input tokens reported by Sail are billed at the cache read rate

Sail charges less for `balanced` and `flex`, and LiteLLM does not read the window back out of the request. For a deployment pinned to one of those windows, set `input_cost_per_token`, `output_cost_per_token` and `cache_read_input_token_cost` on that deployment to the matching Sail price, as in the proxy config above. Those overrides take precedence over the cost map. A per-request `completion_window` on a deployment without overrides is still billed at that deployment's price, so route windows through their own deployments when the price matters

A background Responses request returns before Sail has generated anything, so there is no usage to price at request time. The proxy records that spend later through its [background cost poller](../response_api#background-cost-tracking), which needs a Postgres database and the enterprise package; the minimal config above submits the request but does not log its spend

## Unsupported OpenAI parameters

Sail rejects a number of OpenAI chat parameters instead of ignoring them: `frequency_penalty`, `presence_penalty`, `logit_bias`, `stop`, `seed`, `logprobs`, `top_logprobs`, `verbosity`, `prediction`, `audio`, `modalities`, `web_search_options`, `functions`, `function_call` and the deprecated `max_tokens` (LiteLLM already rewrites that one). Sail's JSON mode only supports `response_format: {"type": "json_schema", ...}`, so `json_object` is refused. On the Responses API, `previous_response_id`, `conversation` and `prompt` are not supported, and `truncation` only accepts `"disabled"`. To have LiteLLM drop parameters Sail cannot take instead of forwarding them, set `litellm.drop_params = True` or `drop_params: true` on the deployment

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
