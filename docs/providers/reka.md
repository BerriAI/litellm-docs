import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Reka

## Overview

| Property | Details |
|-------|-------|
| Description | Reka serves its own models and a curated selection of open models over one OpenAI-compatible API, with automatic prompt caching and no platform fee or markup. |
| Provider Route on LiteLLM | `reka/` |
| Link to Provider Doc | [Reka Developer Reference ↗](https://developer.reka.ai/reference) |
| Base URL | `https://api.reka.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#anthropic-messages-api) |

<br />
<br />

**We support ALL Reka models, just set `reka/` as a prefix when sending requests**

## Available Models

| Model | Context | Max output |
|-------|---------|------------|
| `reka/reka-flash-3` | 64k | 58,982 |
| `reka/reka-edge-2603` | 16k | 14,745 |
| `reka/deepseek4-flash` | 1M | 384,000 |
| `reka/deepseek-v4-pro` | 1M | 393,216 |
| `reka/glm5.3` | 262k | 131,072 |
| `reka/glm5.3-flash` | 262k | 131,072 |
| `reka/qwen3.8-27b` | 262k | 131,072 |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["REKA_API_KEY"] = ""  # your Reka API key
os.environ["REKA_API_BASE"] = ""  # optional, defaults to https://api.reka.ai/v1
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Reka Non-streaming Completion"
import os
from litellm import completion

os.environ["REKA_API_KEY"] = ""  # your Reka API key

response = completion(
    model="reka/reka-flash-3",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Reka Streaming Completion"
import os
from litellm import completion

os.environ["REKA_API_KEY"] = ""  # your Reka API key

response = completion(
    model="reka/reka-flash-3",
    messages=[{"role": "user", "content": "Write a short story about AI"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

`reka-flash-3` and the DeepSeek and GLM models reason before they answer. The thinking trace is returned as `reasoning_content` on the message (and streamed as `delta.reasoning_content`), and a small `max_tokens` can be used up by the trace before any answer is produced, leaving `content` empty with `finish_reason: length`. Leave `max_tokens` unset or generous on those models, or use `reka-edge-2603` when you need a short, direct reply.

### Function Calling

Tool calling is supported on every model in the table above except `reka-flash-3`. Reka models are not in LiteLLM's model cost map yet, and LiteLLM only forwards `tools` to a model it knows supports function calling, so register the model first (on the proxy, set `supports_function_calling: true` under `model_info`, as shown in the proxy section below).

```python showLineNumbers title="Reka Function Calling"
import os
import litellm
from litellm import completion

os.environ["REKA_API_KEY"] = ""  # your Reka API key

litellm.register_model({
    "reka/reka-edge-2603": {
        "litellm_provider": "reka",
        "mode": "chat",
        "supports_function_calling": True,
    }
})

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a location",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "The city, e.g. San Francisco"}
            },
            "required": ["city"],
        },
    },
}]

response = completion(
    model="reka/reka-edge-2603",
    messages=[{"role": "user", "content": "What's the weather in San Francisco?"}],
    tools=tools,
    tool_choice="auto",
)

print(response.choices[0].message.tool_calls)
```

### Vision

`reka-edge-2603` accepts images and video. Image input uses the OpenAI content-part shape; video uses a `video_url` part the same way. Check `input_modalities` on `GET /v1/models` before sending media to any other model.

```python showLineNumbers title="Reka Image Input"
import os
from litellm import completion

os.environ["REKA_API_KEY"] = ""  # your Reka API key

response = completion(
    model="reka/reka-edge-2603",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What animal is this? Answer briefly."},
            {"type": "image_url", "image_url": {"url": "https://v0.docs.reka.ai/_images/000000245576.jpg"}},
        ],
    }],
)

print(response.choices[0].message.content)
```

### Responses API

Reka does not serve `/v1/responses` natively, so LiteLLM translates `litellm.responses` calls into Reka chat completions and converts the result back into a Responses API object.

```python showLineNumbers title="Reka Responses API"
import os
import litellm

os.environ["REKA_API_KEY"] = ""  # your Reka API key

response = litellm.responses(
    model="reka/reka-flash-3",
    input="Say hello",
)

print(response.output_text)
```

### Anthropic Messages API

Anthropic Messages requests are bridged the same way, so Anthropic-shaped clients can talk to Reka through LiteLLM. On reasoning models the trace comes back as a `thinking` block ahead of the `text` block, so read the block types rather than assuming `content[0]` is text.

```python showLineNumbers title="Reka Anthropic Messages API"
import asyncio
import os
import litellm

os.environ["REKA_API_KEY"] = ""  # your Reka API key

async def main():
    response = await litellm.anthropic.messages.acreate(
        model="reka/reka-edge-2603",
        messages=[{"role": "user", "content": "Say hello"}],
        max_tokens=64,
    )
    print(response["content"][0]["text"])

asyncio.run(main())
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: reka-flash-3
    litellm_params:
      model: reka/reka-flash-3
      api_key: os.environ/REKA_API_KEY
  - model_name: reka-edge
    litellm_params:
      model: reka/reka-edge-2603
      api_key: os.environ/REKA_API_KEY
    model_info:
      supports_function_calling: true  # lets the proxy forward `tools` to this deployment

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export REKA_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-reka"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

A deployment configured this way serves `/v1/chat/completions`, `/v1/responses`, and `/v1/messages` on the proxy.

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "reka-flash-3",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Reka via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-reka",
)

response = client.chat.completions.create(
    model="reka-flash-3",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="responses" label="Responses">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "reka-flash-3",
    "input": "Hello, how are you?"
  }'
```

</TabItem>
<TabItem value="messages" label="Messages">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/messages \
  -H "x-api-key: $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "reka-edge",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

You can also add Reka from the Admin UI. Go to Models, then Add Model, pick Reka as the provider, enter a `reka/` model id, and paste your key.

## Cost Tracking

Reka models are not yet in LiteLLM's model cost map, so spend is not computed automatically. Reka bills per token at each model's rate with no platform fee, and publishes the rates on [developer.reka.ai/models](https://developer.reka.ai/models) and in the `pricing` object of `GET /v1/models` (US dollars per token, as strings: `prompt`, `completion`, and `input_cache_read`). Pass those values as `input_cost_per_token` and `output_cost_per_token` on the deployment and LiteLLM will track spend for it, returning the amount in the `x-litellm-response-cost` response header and recording it in spend logs. Reka lists rates per million tokens; divide by 1,000,000 for the per-token value.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: reka-edge
    litellm_params:
      model: reka/reka-edge-2603
      api_key: os.environ/REKA_API_KEY
      input_cost_per_token: 0.0000001   # $0.10 / 1M
      output_cost_per_token: 0.0000001  # $0.10 / 1M
  - model_name: glm5.3-flash
    litellm_params:
      model: reka/glm5.3-flash
      api_key: os.environ/REKA_API_KEY
      input_cost_per_token: 0.00000015  # $0.15 / 1M
      output_cost_per_token: 0.0000005  # $0.50 / 1M
```

Where a model supports prompt caching, Reka caches repeated prompt prefixes automatically and bills those tokens at the cached-input rate; `usage.reasoning_tokens` is included inside `completion_tokens` and is not billed twice.

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["REKA_API_BASE"] = "https://custom.reka.example/v1"
os.environ["REKA_API_KEY"] = ""  # your API key

response = completion(
    model="reka/reka-flash-3",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="reka/reka-flash-3",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="https://custom.reka.example/v1",
    api_key="your-api-key",
)
```

Passing `api_base="https://api.reka.ai/v1"` without the `reka/` prefix also resolves to the Reka provider, so `model="reka-flash-3"` with that base URL is routed as `reka` and picks up `REKA_API_KEY`.
