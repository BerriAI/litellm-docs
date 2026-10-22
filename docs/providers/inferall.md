# InferAll

## Overview

| Property | Details |
|-------|-------|
| Description | InferAll is an OpenAI-compatible gateway with one API key for open models ($0 per token) and paid OpenAI, Anthropic, Google and xAI models. |
| Provider Route on LiteLLM | `inferall/` |
| Link to Provider Doc | [InferAll Documentation ↗](https://inferall.ai/docs) |
| Base URL | `https://api.inferall.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/v1/messages`](#anthropic-messages-api) |

<br />

**Set `inferall/` as the prefix, followed by the model id InferAll lists at [inferall.ai/models](https://inferall.ai/models).** Model ids keep their organisation prefix, for example `inferall/nvidia/nemotron-3-ultra-550b-a55b`.

## Example Models

| Model | Notes |
|-------|-------|
| `inferall/nvidia/nemotron-3-ultra-550b-a55b` | Open model, $0 input and output. Supports function calling. |
| `inferall/openai/gpt-oss-20b` | Open model, $0 input and output. Supports function calling. |
| `inferall/anthropic/claude-sonnet-4-6` | Paid model, billed per token from the InferAll balance. |

New InferAll accounts get 25 free calls on the open models without a card. A one-time $5 activation unlocks ongoing $0 use of the open models, within daily request limits, and becomes balance for paid models. See [inferall.ai/pricing](https://inferall.ai/pricing).

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["INFERALL_API_KEY"] = ""  # your InferAll API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="InferAll Non-streaming Completion"
import os
from litellm import completion

os.environ["INFERALL_API_KEY"] = ""  # your InferAll API key

response = completion(
    model="inferall/nvidia/nemotron-3-ultra-550b-a55b",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response)
```

### Streaming

```python showLineNumbers title="InferAll Streaming Completion"
import os
from litellm import completion

os.environ["INFERALL_API_KEY"] = ""  # your InferAll API key

response = completion(
    model="inferall/openai/gpt-oss-20b",
    messages=[{"role": "user", "content": "Write a short poem about the sea"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="InferAll Function Calling"
import os
from litellm import completion

os.environ["INFERALL_API_KEY"] = ""  # your InferAll API key

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a location",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}]

response = completion(
    model="inferall/nvidia/nemotron-3-ultra-550b-a55b",
    messages=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=tools,
    tool_choice="auto",
)

print(response)
```

### Reasoning Effort

```python showLineNumbers title="InferAll Reasoning Effort"
import os
from litellm import completion

os.environ["INFERALL_API_KEY"] = ""  # your InferAll API key

response = completion(
    model="inferall/openai/gpt-oss-20b",
    messages=[{"role": "user", "content": "What is 17 * 23?"}],
    reasoning_effort="low",
)

print(response.choices[0].message.content)
```

### Responses API

```python showLineNumbers title="InferAll Responses API"
import os
import litellm

os.environ["INFERALL_API_KEY"] = ""  # your InferAll API key

response = litellm.responses(
    model="inferall/openai/gpt-oss-20b",
    input="Say hello",
)

print(response.output)
```

### Anthropic Messages API

```python showLineNumbers title="InferAll Anthropic Messages API"
import asyncio
import os
import litellm

os.environ["INFERALL_API_KEY"] = ""  # your InferAll API key

async def main():
    response = await litellm.anthropic.messages.acreate(
        model="inferall/nvidia/nemotron-3-ultra-550b-a55b",
        messages=[{"role": "user", "content": "Say hello"}],
        max_tokens=256,
    )
    print(response)

asyncio.run(main())
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: inferall-ultra
    litellm_params:
      model: inferall/nvidia/nemotron-3-ultra-550b-a55b
      api_key: os.environ/INFERALL_API_KEY
```

```bash
litellm --config config.yaml
```

## Custom API Base

```python showLineNumbers title="Custom API Base"
os.environ["INFERALL_API_BASE"] = "https://api.inferall.ai/v1"  # default
```
