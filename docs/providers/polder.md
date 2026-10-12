import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Polder AI

## Overview

| Property | Details |
|-------|-------|
| Description | Polder AI is an OpenAI-compatible inference provider. |
| Provider Route on LiteLLM | `polder/` |
| Base URL | `https://api.polder.example/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

## Available Models

| Model | Context Window | Max Output |
|-------|----------------|------------|
| `polder/polder-large-2` | 128,000 tokens | 8,192 tokens |
| `polder/polder-small-2` | 32,000 tokens | 4,096 tokens |

Both models support function calling, tool choice, and structured (JSON schema) output. Pricing and context window values above are placeholders pending publicly confirmed numbers from Polder AI.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["POLDER_API_KEY"] = ""  # your Polder AI API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Polder AI Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["POLDER_API_KEY"] = ""  # your Polder AI API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# Polder AI call
response = completion(
    model="polder/polder-large-2",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="Polder AI Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["POLDER_API_KEY"] = ""  # your Polder AI API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

# Polder AI call with streaming
response = completion(
    model="polder/polder-large-2",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="Polder AI Function Calling"
import os
import litellm
from litellm import completion

os.environ["POLDER_API_KEY"] = ""  # your Polder AI API key

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
                    "description": "The city, e.g. San Francisco"
                }
            },
            "required": ["city"]
        }
    }
}]

messages = [{"role": "user", "content": "What's the weather in San Francisco?"}]

response = completion(
    model="polder/polder-large-2",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: polder-large-2
    litellm_params:
      model: polder/polder-large-2
      api_key: os.environ/POLDER_API_KEY
  - model_name: polder-small-2
    litellm_params:
      model: polder/polder-small-2
      api_key: os.environ/POLDER_API_KEY
```

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: ******" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "polder-large-2",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["POLDER_API_BASE"] = "https://custom.polder.example/v1"
os.environ["POLDER_API_KEY"] = ""  # your API key

response = completion(
    model="polder/polder-large-2",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="polder/polder-large-2",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://custom.polder.example/v1",
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
- `logprobs`
- `top_logprobs`
