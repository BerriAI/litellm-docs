import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenCheap

## Overview

| Property | Details |
|-------|-------|
| Description | OpenCheap is an OpenAI-compatible gateway that gives one API key access to hundreds of open and closed models, routed to the cheapest healthy provider for each request. |
| Provider Route on LiteLLM | `opencheap/` |
| Link to Provider Doc | [OpenCheap Documentation ↗](https://docs.opencheap.si) |
| Base URL | `https://api.opencheap.si/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api) |

<br />
<br />

**We support ALL OpenCheap chat models, just set `opencheap/` as a prefix when sending completion requests**

Create an API key (it starts with `kl_live_`) at [app.opencheap.si](https://app.opencheap.si). The live list of model ids, with context windows and prices, is at [opencheap.si/pricing](https://opencheap.si/pricing) and from `GET https://api.opencheap.si/v1/models`.

## Available Models

A model id always means that model and version. The ids below have a price entry in LiteLLM, so `response_cost` and spend tracking work for them without further setup.

| Model | Context Window |
|-------|----------------|
| `opencheap/deepseek-v4-pro` | 1,048,576 tokens |
| `opencheap/deepseek-v4.1-flash` | 1,048,576 tokens |
| `opencheap/glm-5.3` | 1,048,576 tokens |
| `opencheap/glm-5.3-flash` | 1,048,576 tokens |
| `opencheap/gpt-oss-120b` | 131,072 tokens |
| `opencheap/kimi-k3` | 1,048,576 tokens |
| `opencheap/llama-3.3-70b` | 131,072 tokens |
| `opencheap/minimax-m2.5` | 204,800 tokens |
| `opencheap/qwen3-coder` | 262,144 tokens |
| `opencheap/qwen3.5-397b-a17b` | 262,144 tokens |

All ten support function calling and JSON schema output. Reasoning models return their reasoning in `message.reasoning_content` and count it in `usage.completion_tokens_details.reasoning_tokens`.

OpenCheap prices change over time, so the prices shipped in LiteLLM are a snapshot. For a model that is not in the list above, or to pin a price, set `input_cost_per_token` and `output_cost_per_token` on the deployment, or check the current price on the pricing page.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["OPENCHEAP_API_KEY"] = ""  # your OpenCheap API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="OpenCheap Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["OPENCHEAP_API_KEY"] = ""  # your OpenCheap API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# OpenCheap call
response = completion(
    model="opencheap/glm-5.3-flash",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="OpenCheap Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["OPENCHEAP_API_KEY"] = ""  # your OpenCheap API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

# OpenCheap call with streaming
response = completion(
    model="opencheap/glm-5.3-flash",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="OpenCheap Function Calling"
import os
import litellm
from litellm import completion

os.environ["OPENCHEAP_API_KEY"] = ""  # your OpenCheap API key

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
    model="opencheap/glm-5.3-flash",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

### Structured Output

```python showLineNumbers title="OpenCheap JSON Schema Output"
import os
from litellm import completion

os.environ["OPENCHEAP_API_KEY"] = ""  # your OpenCheap API key

response = completion(
    model="opencheap/glm-5.3-flash",
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

### Responses API

OpenCheap serves `/v1/responses` natively, so LiteLLM forwards `litellm.responses()` calls to it without translating them to chat completions.

```python showLineNumbers title="OpenCheap Responses API"
import os
import litellm

os.environ["OPENCHEAP_API_KEY"] = ""  # your OpenCheap API key

response = litellm.responses(
    model="opencheap/glm-5.3-flash",
    input="Say hello in one word",
)

print(response)
```

### Cost tracking

```python showLineNumbers title="OpenCheap Response Cost"
import os
from litellm import completion

os.environ["OPENCHEAP_API_KEY"] = ""  # your OpenCheap API key

response = completion(
    model="opencheap/glm-5.3-flash",
    messages=[{"role": "user", "content": "Hello!"}],
)

print(response._hidden_params["response_cost"])
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: glm-5.3-flash
    litellm_params:
      model: opencheap/glm-5.3-flash
      api_key: os.environ/OPENCHEAP_API_KEY
  - model_name: gpt-oss-120b
    litellm_params:
      model: opencheap/gpt-oss-120b
      api_key: os.environ/OPENCHEAP_API_KEY
```

Start the proxy with `litellm --config config.yaml`, then send a request:

```bash showLineNumbers title="Request through the proxy"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{"model": "glm-5.3-flash", "messages": [{"role": "user", "content": "Hello!"}]}'
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["OPENCHEAP_API_BASE"] = "https://api.opencheap.si/v1"
os.environ["OPENCHEAP_API_KEY"] = ""  # your API key

response = completion(
    model="opencheap/glm-5.3-flash",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="opencheap/glm-5.3-flash",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://api.opencheap.si/v1",
    api_key="your-api-key",
)
```

## Supported OpenAI Parameters

OpenCheap uses the OpenAI request format, so the standard chat completion parameters are sent as given, among them `temperature`, `max_tokens`, `max_completion_tokens`, `top_p`, `stop`, `stream`, `stream_options`, `tools`, `tool_choice`, `response_format` and `seed`. Which of them a model honors depends on the model.
