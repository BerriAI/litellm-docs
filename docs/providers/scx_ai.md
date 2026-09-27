import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SCX.ai

## Overview

| Property | Details |
|-------|-------|
| Description | SCX.ai is an Australian sovereign AI platform serving open models over an OpenAI-compatible API, hosted on renewable-powered infrastructure. |
| Provider Route on LiteLLM | `scx-ai/` |
| Link to Provider Doc | [SCX.ai Documentation ↗](https://scx.ai) |
| Base URL | `https://api.scx.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

**We support ALL SCX.ai chat models, just set `scx-ai/` as a prefix when sending completion requests**

## Available Models

| Model | Description | Context Window | Max Output |
|-------|-------------|----------------|------------|
| `scx-ai/GLM-5.2` | Z.ai GLM-5.2, a 753B sparse MoE for long-horizon agentic coding | 1,048,576 tokens | 131,072 tokens |
| `scx-ai/Qwen3.8-Max` | Alibaba Qwen3.8 Max, a 2.4T sparse MoE taking text and image input | 1,000,000 tokens | 131,072 tokens |

Both models support reasoning, function calling, JSON mode and JSON schema output. `scx-ai/Qwen3.8-Max` additionally accepts image input. Prompt caching is applied automatically on both, and cache hits are reported in `usage.prompt_tokens_details.cached_tokens` and billed at the cached input rate.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["SCX_API_KEY"] = ""  # your SCX.ai API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="SCX.ai Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["SCX_API_KEY"] = ""  # your SCX.ai API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# SCX.ai call
response = completion(
    model="scx-ai/GLM-5.2",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="SCX.ai Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["SCX_API_KEY"] = ""  # your SCX.ai API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

# SCX.ai call with streaming
response = completion(
    model="scx-ai/GLM-5.2",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="SCX.ai Function Calling"
import os
import litellm
from litellm import completion

os.environ["SCX_API_KEY"] = ""  # your SCX.ai API key

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a location",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "The city, e.g. Sydney"
                }
            },
            "required": ["city"]
        }
    }
}]

messages = [{"role": "user", "content": "What's the weather in Sydney?"}]

response = completion(
    model="scx-ai/GLM-5.2",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

### Structured Output

```python showLineNumbers title="SCX.ai JSON Schema Output"
import os
from litellm import completion

os.environ["SCX_API_KEY"] = ""  # your SCX.ai API key

response = completion(
    model="scx-ai/GLM-5.2",
    messages=[{"role": "user", "content": "The city is Sydney"}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "city",
            "schema": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
                "additionalProperties": False,
            },
        },
    },
)

print(response)
```

### Vision

Image input is supported on `scx-ai/Qwen3.8-Max`. Images must be at least 10 pixels on each side.

```python showLineNumbers title="SCX.ai Image Input"
import os
from litellm import completion

os.environ["SCX_API_KEY"] = ""  # your SCX.ai API key

response = completion(
    model="scx-ai/Qwen3.8-Max",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What colour fills this image?"},
            {"type": "image_url", "image_url": {"url": "https://example.com/image.png"}},
        ],
    }],
)

print(response)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: glm-5.2
    litellm_params:
      model: scx-ai/GLM-5.2
      api_key: os.environ/SCX_API_KEY
  - model_name: qwen3.8-max
    litellm_params:
      model: scx-ai/Qwen3.8-Max
      api_key: os.environ/SCX_API_KEY
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["SCX_API_BASE"] = "https://custom.scx.ai/v1"
os.environ["SCX_API_KEY"] = ""  # your API key

response = completion(
    model="scx-ai/GLM-5.2",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="scx-ai/GLM-5.2",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://custom.scx.ai/v1",
    api_key="your-api-key",
)
```

## Supported OpenAI Parameters

- `temperature`
- `max_tokens`
- `max_completion_tokens`
- `top_p`
- `frequency_penalty`
- `presence_penalty`
- `stop`
- `n`
- `stream`
- `stream_options`
- `tools`
- `tool_choice`
- `response_format`
- `seed`
- `logit_bias`
- `logprobs`
- `top_logprobs`

`max_completion_tokens` is sent upstream as `max_tokens`. SCX.ai accepts `temperature` in the range `[0.0, 2.0)` and rejects `2.0` itself, so LiteLLM clamps anything higher to `1.99`.
