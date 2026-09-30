import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ZeroGPU

## Overview

| Property | Details |
|-------|-------|
| Description | ZeroGPU serves open and hosted text generation models over an OpenAI-compatible API |
| Provider Route on LiteLLM | `zerogpu/` |
| Link to Provider Doc | [ZeroGPU Documentation](https://docs.zerogpu.ai) |
| Default Base URL | `https://api.zerogpu.ai/v1` |
| Supported Operations | `/chat/completions`, plus `/messages` and `/responses` through LiteLLM's adapters |

ZeroGPU is its own provider on LiteLLM rather than a generic OpenAI-compatible route, so its spend is priced from the `zerogpu/` cost map entries and reported under provider `zerogpu`.

## API Key

```python showLineNumbers title="Environment Variables"
import os

os.environ["ZEROGPU_API_KEY"] = "your-api-key"
os.environ["ZEROGPU_API_BASE"] = "https://api.zerogpu.ai/v1"  # optional override
```

## Models

| Model | Context window | Input / 1M tokens | Output / 1M tokens | Cache read / 1M tokens |
|-------|----------------|-------------------|--------------------|------------------------|
| `zerogpu/deepseek-v4.1-flash` | 1,048,576 | $0.30 | $1.20 | $0.003 |
| `zerogpu/glm-5.3-flash` | 1,048,576 | $0.10 | $0.35 | $0.015 |
| `zerogpu/gpt-4.1-mini` | 1,047,576 | $0.40 | $1.60 | $0.10 |
| `zerogpu/gpt-5.4-nano` | 400,000 | $0.20 | $1.25 | $0.02 |
| `zerogpu/gpt-5.6-luna` | 272,000 | $0.20 | $1.20 | $0.20 |
| `zerogpu/gpt-oss-120b` | 131,072 | $0.15 | $0.60 | $0.03 |
| `zerogpu/LFM2.5-1.2B-Instruct` | 32,768 | $0.02 | $0.05 | n/a |
| `zerogpu/llama-3.1-8b-instruct-fast` | 131,072 | $0.15 | $0.28 | $0.025 |
| `zerogpu/qwen3-30b-a3b-fp8` | 32,768 | $0.10 | $0.45 | n/a |

Pricing follows the [ZeroGPU model catalog](https://docs.zerogpu.ai/docs/model-catalog). Every model above supports `tools`, `tool_choice`, and a `json_schema` `response_format`, and `gpt-5.6-luna` is the only reasoning model.

## Usage - LiteLLM Python SDK

### Chat Completions

```python showLineNumbers title="ZeroGPU Chat Completion"
import os
from litellm import completion

os.environ["ZEROGPU_API_KEY"] = "your-api-key"

response = completion(
    model="zerogpu/gpt-oss-120b",
    messages=[{"role": "user", "content": "Write a python function that reverses a string"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="ZeroGPU Streaming Chat Completion"
import os
from litellm import completion

os.environ["ZEROGPU_API_KEY"] = "your-api-key"

response = completion(
    model="zerogpu/gpt-oss-120b",
    messages=[{"role": "user", "content": "Explain a binary search in two sentences"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Tool Calling

```python showLineNumbers title="ZeroGPU Tool Calling"
import os
from litellm import completion

os.environ["ZEROGPU_API_KEY"] = "your-api-key"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string", "description": "City name"}},
                "required": ["city"],
            },
        },
    }
]

response = completion(
    model="zerogpu/gpt-oss-120b",
    messages=[{"role": "user", "content": "What is the weather in Paris?"}],
    tools=tools,
    tool_choice="auto",
)

print(response.choices[0].message.tool_calls)
```

### Reasoning Effort

LiteLLM forwards `reasoning_effort` only to ZeroGPU models flagged `supports_reasoning` in the cost map, which today is `gpt-5.6-luna`. When the same call can reach other ZeroGPU models, pass `drop_params=True` so LiteLLM drops the parameter for them instead of rejecting the request.

```python showLineNumbers title="ZeroGPU Reasoning Effort" keep-model-ids
import os
from litellm import completion

os.environ["ZEROGPU_API_KEY"] = "your-api-key"

response = completion(
    model="zerogpu/gpt-5.6-luna",
    messages=[{"role": "user", "content": "How many prime numbers are there below 100?"}],
    reasoning_effort="high",
    drop_params=True,
)

print(response.choices[0].message.content)
```

## Usage - LiteLLM Proxy

Add ZeroGPU to your LiteLLM Proxy configuration:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-oss-120b
    litellm_params:
      model: zerogpu/gpt-oss-120b
      api_key: os.environ/ZEROGPU_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export ZEROGPU_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-zerogpu"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="ZeroGPU via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-zerogpu",
)

response = client.chat.completions.create(
    model="gpt-oss-120b",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="ZeroGPU via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "gpt-oss-120b",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
</Tabs>

You can also add ZeroGPU from the Admin UI. Go to Models, then Add Model, pick ZeroGPU as the provider, choose one of the `zerogpu/` models, and paste your key. The API Base field is optional and defaults to `https://api.zerogpu.ai/v1`.

## Anthropic Messages and Responses Compatibility

LiteLLM translates Anthropic Messages-shaped requests into ZeroGPU chat completions, both through the SDK facade and the proxy's `/v1/messages` endpoint:

```bash showLineNumbers title="Anthropic Messages through LiteLLM Proxy"
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gpt-oss-120b",
    "max_tokens": 128,
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

`litellm.responses()` and the proxy's `/v1/responses` endpoint work the same way; LiteLLM bridges Responses API requests onto ZeroGPU chat completions, so no extra configuration is needed.

## Cost Tracking

The `zerogpu/` models are registered in LiteLLM's model cost map, so per-request spend is computed automatically, returned in the `x-litellm-response-cost` response header, and recorded in spend logs under provider `zerogpu`. When ZeroGPU reports cached prompt tokens in `prompt_tokens_details.cached_tokens`, LiteLLM bills those at the cache read rate from the table above and the rest of the prompt at the input rate.

```python showLineNumbers title="Read the response cost"
print(f"Request cost: ${response._hidden_params['response_cost']}")
```

## Custom Endpoints

Set `ZEROGPU_API_BASE` or pass `api_base` to point the `zerogpu/` route at a different ZeroGPU endpoint. The route keeps the provider identity and pricing either way.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-oss-120b
    litellm_params:
      model: zerogpu/gpt-oss-120b
      api_base: https://your-zerogpu-endpoint/v1
      api_key: os.environ/ZEROGPU_API_KEY
```

LiteLLM also recognizes `https://api.zerogpu.ai/v1` as a ZeroGPU base URL, so a call with that `api_base` and a bare model name such as `gpt-oss-120b` resolves to the `zerogpu` provider and reads `ZEROGPU_API_KEY`.
