import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ainetcafe

## Overview

| Property | Details |
|-------|-------|
| Description | ainetcafe serves Kimi K3 (Moonshot's released weights, native MXFP4 precision, not requantized) from its own cluster over an OpenAI-compatible API, with prompt caching, tool calling and image input. |
| Provider Route on LiteLLM | `ainetcafe/` |
| Link to Provider Doc | [ainetcafe Documentation ↗](https://ainetcafe.com/k3/) |
| Base URL | `https://microquickjs.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

**Set `ainetcafe/` as a prefix when sending completion requests**

## Available Models

| Model | Description | Context Window | Max Output |
|-------|-------------|----------------|------------|
| `ainetcafe/Kimi-K3` | Moonshot Kimi K3, a 2.8T sparse MoE reasoning model, text and image input | 262,144 tokens (1M on request) | 131,072 tokens |

Kimi K3 supports reasoning (`reasoning_effort` `low` / `high` / `max`; `none` turns thinking off), function calling, JSON mode and JSON schema output, and image input. Prompt caching is applied automatically; cache hits are reported in `usage.prompt_tokens_details.cached_tokens` and billed at the cached input rate. The endpoint's results on Moonshot's Kimi Vendor Verifier are published at [ainetcafe.com/k3/verifier.html](https://ainetcafe.com/k3/verifier.html).

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["AINETCAFE_API_KEY"] = ""  # your ainetcafe API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="ainetcafe Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["AINETCAFE_API_KEY"] = ""  # your ainetcafe API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# ainetcafe call
response = completion(
    model="ainetcafe/Kimi-K3",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="ainetcafe Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["AINETCAFE_API_KEY"] = ""  # your ainetcafe API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

# ainetcafe call with streaming
response = completion(
    model="ainetcafe/Kimi-K3",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Reasoning Effort

```python showLineNumbers title="ainetcafe Reasoning Effort"
import os
from litellm import completion

os.environ["AINETCAFE_API_KEY"] = ""  # your ainetcafe API key

response = completion(
    model="ainetcafe/Kimi-K3",
    messages=[{"role": "user", "content": "Plan a three-step migration of a Postgres table."}],
    reasoning_effort="high",  # low | high | max; "none" disables thinking
)

print(response.choices[0].message.reasoning_content)
print(response.choices[0].message.content)
```

### Function Calling

```python showLineNumbers title="ainetcafe Function Calling"
import os
import litellm
from litellm import completion

os.environ["AINETCAFE_API_KEY"] = ""  # your ainetcafe API key

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
                    "description": "The city, e.g. Paris"
                }
            },
            "required": ["city"]
        }
    }
}]

messages = [{"role": "user", "content": "What's the weather in Paris?"}]

response = completion(
    model="ainetcafe/Kimi-K3",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

### Structured Output

```python showLineNumbers title="ainetcafe JSON Schema Output"
import os
from litellm import completion

os.environ["AINETCAFE_API_KEY"] = ""  # your ainetcafe API key

response = completion(
    model="ainetcafe/Kimi-K3",
    messages=[{"role": "user", "content": "The city is Paris"}],
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

```python showLineNumbers title="ainetcafe Image Input"
import os
from litellm import completion

os.environ["AINETCAFE_API_KEY"] = ""  # your ainetcafe API key

response = completion(
    model="ainetcafe/Kimi-K3",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What does this image show?"},
            {"type": "image_url", "image_url": {"url": "https://example.com/image.png"}},
        ],
    }],
)

print(response)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: kimi-k3
    litellm_params:
      model: ainetcafe/Kimi-K3
      api_key: os.environ/AINETCAFE_API_KEY
```

## Custom API Base

Teams on a dedicated endpoint point the provider at their own host.

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["AINETCAFE_API_BASE"] = "https://your-dedicated-endpoint.example.com/v1"
os.environ["AINETCAFE_API_KEY"] = ""  # your API key

response = completion(
    model="ainetcafe/Kimi-K3",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="ainetcafe/Kimi-K3",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://your-dedicated-endpoint.example.com/v1",
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
- `reasoning_effort`
- `seed`
- `logit_bias`
- `logprobs`
- `top_logprobs`
