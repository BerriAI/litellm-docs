import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Tium

## Overview

| Property | Details |
|-------|-------|
| Description | Tium serves open-weight models over an OpenAI-compatible API from a gateway operated in Germany. |
| Provider Route on LiteLLM | `tium/` |
| Link to Provider Doc | [Tium Documentation ↗](https://tium.ai/models) |
| Base URL | `https://api.tium.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

**We support ALL Tium chat models, just set `tium/` as a prefix when sending completion requests**

## Available Models

| Model | Description | Context Window | Max Output |
|-------|-------------|----------------|------------|
| `tium/glm-5.3-flash` | Z.ai GLM-5.3 Flash, taking text and image input | 128,000 tokens | 32,768 tokens |
| `tium/deepseek-v4-flash` | DeepSeek V4 Flash | 128,000 tokens | 32,768 tokens |
| `tium/deepseek-v4-pro` | DeepSeek V4 Pro | 128,000 tokens | 32,768 tokens |
| `tium/glm-5.3` | Z.ai GLM-5.3 | 128,000 tokens | 32,768 tokens |
| `tium/kimi-k3` | Moonshot Kimi K3, taking text and image input | 128,000 tokens | 32,768 tokens |

The context window and output ceiling are policy limits set by Tium; the underlying models advertise a larger window at their own APIs. All five models reason by default and return the reasoning text in `reasoning_content`. All five support function calling. Prompt caching is applied automatically, and cache hits are reported in `usage.prompt_tokens_details.cached_tokens` and billed at the cached input rate.

`tium/glm-5.3` accepts text only. The two DeepSeek models do not support `response_format` with a JSON schema, and they reject `tool_choice="required"` while reasoning is enabled; leave `tool_choice` unset, or send `thinking={"type": "disabled"}` alongside it.

## Pricing

Tium bills a monthly allotment of weighted tokens rather than a per-token price, so the USD costs LiteLLM reports are the effective rate at the subscription price, currently 2.83 dollars per million weighted tokens, multiplied by each model's published multiplier and weights. Prepaid credit packs bill higher, between 3.56 and 4.50 dollars per million weighted tokens. See [tium.ai/pricing](https://tium.ai/pricing) for the current figures.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["TIUM_API_KEY"] = ""  # your Tium API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Tium Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["TIUM_API_KEY"] = ""  # your Tium API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# Tium call
response = completion(
    model="tium/glm-5.3",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="Tium Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["TIUM_API_KEY"] = ""  # your Tium API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

# Tium call with streaming
response = completion(
    model="tium/glm-5.3",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="Tium Function Calling"
import os
import litellm
from litellm import completion

os.environ["TIUM_API_KEY"] = ""  # your Tium API key

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
                    "description": "The city, e.g. Berlin"
                }
            },
            "required": ["city"]
        }
    }
}]

messages = [{"role": "user", "content": "What's the weather in Berlin?"}]

response = completion(
    model="tium/glm-5.3",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

On `tium/deepseek-v4-flash` and `tium/deepseek-v4-pro`, `tool_choice="required"` is rejected while reasoning is enabled. Either leave `tool_choice` unset, which still produces tool calls, or disable reasoning for that request:

```python showLineNumbers title="Forcing a tool call on DeepSeek"
response = completion(
    model="tium/deepseek-v4-pro",
    messages=messages,
    tools=tools,
    tool_choice="required",
    thinking={"type": "disabled"},
)
```

### Structured Output

Supported on `tium/glm-5.3`, `tium/glm-5.3-flash` and `tium/kimi-k3`. The two DeepSeek models return an `invalid_request_error` for this parameter.

```python showLineNumbers title="Tium JSON Schema Output"
import os
from litellm import completion

os.environ["TIUM_API_KEY"] = ""  # your Tium API key

response = completion(
    model="tium/glm-5.3",
    messages=[{"role": "user", "content": "The city is Berlin"}],
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

Image input is supported on `tium/glm-5.3-flash` and `tium/kimi-k3`.

```python showLineNumbers title="Tium Image Input"
import os
from litellm import completion

os.environ["TIUM_API_KEY"] = ""  # your Tium API key

response = completion(
    model="tium/glm-5.3-flash",
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

### Reasoning

Every Tium model reasons by default and returns the reasoning text alongside the answer. `glm-5.3` and `glm-5.3-flash` cannot turn reasoning off; they accept `reasoning_effort` of `low`, `high` or `max`. The DeepSeek models and `kimi-k3` accept `thinking={"type": "enabled"}` or `"disabled"`, and reasoning tokens are billed at the output rate.

```python showLineNumbers title="Tium Reasoning Effort"
import os
from litellm import completion

os.environ["TIUM_API_KEY"] = ""  # your Tium API key

response = completion(
    model="tium/glm-5.3",
    messages=[{"role": "user", "content": "How many r's are in strawberry?"}],
    reasoning_effort="max",
)

print(response.choices[0].message.reasoning_content)
print(response.choices[0].message.content)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: glm-5.3
    litellm_params:
      model: tium/glm-5.3
      api_key: os.environ/TIUM_API_KEY
  - model_name: kimi-k3
    litellm_params:
      model: tium/kimi-k3
      api_key: os.environ/TIUM_API_KEY
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["TIUM_API_BASE"] = "https://custom.tium.ai/v1"
os.environ["TIUM_API_KEY"] = ""  # your API key

response = completion(
    model="tium/glm-5.3",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="tium/glm-5.3",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://custom.tium.ai/v1",
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
- `reasoning_effort`

`max_completion_tokens` is sent upstream as `max_tokens`. Where a request carries both, the smaller value binds, and the result is clamped to the per-request ceiling the model's plan allows.

Some upstreams pin a sampling parameter to a single legal value; Moonshot allows only one temperature for `kimi-k3`, for instance, and rejects anything else. Tium drops those parameters rather than passing through a rejection, and names the ones it dropped in the `x-tium-adjusted-params` response header, so a client that sets `temperature` gets an answer at the model's default instead of a 400.
