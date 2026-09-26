import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Prism

## Overview

| Property | Details |
|-------|-------|
| Description | Prism Inference serves open-weight models for coding agents over OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages APIs, with zero data retention on inputs and outputs. |
| Provider Route on LiteLLM | `prism/` |
| Link to Provider Doc | [Prism Documentation ↗](https://docs.prisminference.com) |
| Base URL | `https://api.prisminference.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#anthropic-messages-api) |

<br />
<br />

**We support ALL Prism models, just set `prism/` as a prefix when sending requests**

## Available Models

| Model | Description | Context Window | Max Output |
|-------|-------------|----------------|------------|
| `prism/deepseek-v4.1-flash` | DeepSeek-V4.1-Flash, the current generation for coding, vision, reasoning, and tool-use loops; takes text and image input | 1,000,000 tokens | 384,000 tokens |
| `prism/deepseek-v4-flash` | DeepSeek-V4-Flash, a text-only model for fast coding and tool loops | 1,000,000 tokens | 384,000 tokens |

Both models support reasoning, function calling, JSON mode, and JSON schema output, and LiteLLM ships their pricing (input, output, and cached input) so spend is tracked out of the box. Prism's catalog at `GET https://api.prisminference.com/v1/models` lists more models (for example `glm-5.3` and `kimi-k3`); any of them works with the `prism/` prefix, but for spend tracking on those you need to pass `input_cost_per_token` and `output_cost_per_token` in `litellm_params` until they are added to LiteLLM's model cost map.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["PRISM_API_KEY"] = ""  # your Prism API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Prism Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["PRISM_API_KEY"] = ""  # your Prism API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# Prism call
response = completion(
    model="prism/deepseek-v4.1-flash",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="Prism Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["PRISM_API_KEY"] = ""  # your Prism API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

# Prism call with streaming
response = completion(
    model="prism/deepseek-v4.1-flash",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="Prism Function Calling"
import os
import litellm
from litellm import completion

os.environ["PRISM_API_KEY"] = ""  # your Prism API key

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
    model="prism/deepseek-v4.1-flash",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

### Structured Output

```python showLineNumbers title="Prism JSON Schema Output"
import os
from litellm import completion

os.environ["PRISM_API_KEY"] = ""  # your Prism API key

response = completion(
    model="prism/deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "The city is San Francisco"}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "city",
            "strict": True,
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

Image input is supported on `prism/deepseek-v4.1-flash`.

```python showLineNumbers title="Prism Image Input"
import os
from litellm import completion

os.environ["PRISM_API_KEY"] = ""  # your Prism API key

response = completion(
    model="prism/deepseek-v4.1-flash",
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

### Responses API

Prism serves the OpenAI Responses API natively, so `litellm.responses` sends the request straight to `https://api.prisminference.com/v1/responses`.

```python showLineNumbers title="Prism Responses API"
import os
import litellm

os.environ["PRISM_API_KEY"] = ""  # your Prism API key

response = litellm.responses(
    model="prism/deepseek-v4.1-flash",
    input="Say hello",
)

print(response.output_text)
```

### Anthropic Messages API

Prism also serves the Anthropic Messages API natively, so `litellm.anthropic.messages.acreate` sends the request straight to `https://api.prisminference.com/v1/messages`.

```python showLineNumbers title="Prism Anthropic Messages API"
import asyncio
import os
import litellm

os.environ["PRISM_API_KEY"] = ""  # your Prism API key

async def main():
    response = await litellm.anthropic.messages.acreate(
        model="prism/deepseek-v4.1-flash",
        messages=[{"role": "user", "content": "Say hello"}],
        max_tokens=64,
    )
    print(response["content"][0]["text"])

asyncio.run(main())
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4.1-flash
    litellm_params:
      model: prism/deepseek-v4.1-flash
      api_key: os.environ/PRISM_API_KEY
  - model_name: deepseek-v4-flash
    litellm_params:
      model: prism/deepseek-v4-flash
      api_key: os.environ/PRISM_API_KEY
```

A deployment configured this way serves all three endpoints on the proxy: `/v1/chat/completions`, `/v1/responses`, and `/v1/messages`.

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4.1-flash",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="responses" label="Responses">

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/responses \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4.1-flash",
    "input": "Hello, how are you?"
  }'
```

</TabItem>
<TabItem value="messages" label="Messages">

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/messages \
  -H "x-api-key: sk-1234" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4.1-flash",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["PRISM_API_BASE"] = "https://custom.prisminference.example/v1"
os.environ["PRISM_API_KEY"] = ""  # your API key

response = completion(
    model="prism/deepseek-v4.1-flash",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="prism/deepseek-v4.1-flash",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://custom.prisminference.example/v1",
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
