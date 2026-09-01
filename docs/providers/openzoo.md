import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenZoo

## Overview

| Property | Details |
|-------|-------|
| Description | OpenZoo is a pay-per-call AI gateway serving open models over an OpenAI-compatible API. There is no signup: any API key value is accepted and usage is billed per call via x402 or card. |
| Provider Route on LiteLLM | `openzoo/` |
| Link to Provider Doc | [OpenZoo Documentation ↗](https://openzoo.fun) |
| Base URL | `https://api.openzoo.fun/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

**We support ALL OpenZoo chat models, just set `openzoo/` as a prefix when sending completion requests**

The live model catalog, including current per-token pricing, is served at `https://api.openzoo.fun/v1/models`.

## Available Models

| Model | Description | Context Window | Max Output |
|-------|-------------|----------------|------------|
| `openzoo/z-ai/glm-5.3-flash` | Z.ai GLM-5.3 Flash, a fast agentic coding model | 1,310,720 tokens | 131,072 tokens |
| `openzoo/qwen/qwen3.7-flash` | Alibaba Qwen3.7 Flash, a low-cost general model | 1,000,000 tokens | 65,536 tokens |
| `openzoo/nvidia/nemotron-3.5-lightning` | NVIDIA Nemotron 3.5 Lightning, a compact reasoning model | 262,144 tokens | 131,072 tokens |

All three models support reasoning and function calling.

## Required Variables

OpenZoo has no account system, so there is no key to fetch. Set any non-empty value and requests are billed per call.

```python showLineNumbers title="Environment Variables"
os.environ["OPENZOO_API_KEY"] = "sk-openzoo"  # any value works
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="OpenZoo Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["OPENZOO_API_KEY"] = "sk-openzoo"  # any value works

messages = [{"content": "Hello, how are you?", "role": "user"}]

# OpenZoo call
response = completion(
    model="openzoo/z-ai/glm-5.3-flash",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="OpenZoo Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["OPENZOO_API_KEY"] = "sk-openzoo"  # any value works

messages = [{"content": "Write a short story about AI", "role": "user"}]

# OpenZoo call with streaming
response = completion(
    model="openzoo/z-ai/glm-5.3-flash",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="OpenZoo Function Calling"
import os
import litellm
from litellm import completion

os.environ["OPENZOO_API_KEY"] = "sk-openzoo"  # any value works

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
                    "description": "The city, e.g. Toronto"
                }
            },
            "required": ["city"]
        }
    }
}]

messages = [{"role": "user", "content": "What's the weather in Toronto?"}]

response = completion(
    model="openzoo/z-ai/glm-5.3-flash",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: glm-5.3-flash
    litellm_params:
      model: openzoo/z-ai/glm-5.3-flash
      api_key: os.environ/OPENZOO_API_KEY
  - model_name: qwen3.7-flash
    litellm_params:
      model: openzoo/qwen/qwen3.7-flash
      api_key: os.environ/OPENZOO_API_KEY
```

## Custom API Base

OpenZoo also ships a local gateway, started with `npx openzoo`, which listens on `http://localhost:8402/v1`. Point LiteLLM at it, or at any other compatible endpoint, in either of two ways.

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["OPENZOO_API_BASE"] = "http://localhost:8402/v1"
os.environ["OPENZOO_API_KEY"] = "sk-openzoo"  # any value works

response = completion(
    model="openzoo/z-ai/glm-5.3-flash",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="openzoo/z-ai/glm-5.3-flash",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="http://localhost:8402/v1",
    api_key="sk-openzoo",
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

`max_completion_tokens` is sent upstream as `max_tokens`.
