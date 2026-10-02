import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Cortecs

## Overview

| Property | Details |
|-------|-------|
| Description | Cortecs is an EU sovereign LLM router serving open-weight and frontier models over OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages APIs. |
| Provider Route on LiteLLM | `cortecs/` |
| Link to Provider Doc | [Cortecs Documentation ↗](https://docs.cortecs.ai) |
| Base URL | `https://api.cortecs.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#anthropic-messages-api) |

<br />
<br />

**We support ALL Cortecs models, just set `cortecs/` as a prefix when sending requests**

## Available Models

Cortecs routes to a live catalog of models, for example `cortecs/gpt-6-sol`. The full catalog is listed at `GET https://api.cortecs.ai/v1/models` and any model id it returns works with the `cortecs/` prefix. LiteLLM does not ship Cortecs pricing yet (Cortecs bills in EUR from its catalog), so for spend tracking pass `input_cost_per_token` and `output_cost_per_token` in `litellm_params`.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["CORTECS_API_KEY"] = ""  # your Cortecs API key, get one at https://cortecs.ai
```

`CORTECS_API_BASE` can be set to override the default base URL.

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Cortecs Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["CORTECS_API_KEY"] = ""  # your Cortecs API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# Cortecs call
response = completion(
    model="cortecs/gpt-6-sol",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="Cortecs Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["CORTECS_API_KEY"] = ""  # your Cortecs API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

# Cortecs call with streaming
response = completion(
    model="cortecs/gpt-6-sol",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="Cortecs Function Calling"
import os
import litellm
from litellm import completion

os.environ["CORTECS_API_KEY"] = ""  # your Cortecs API key

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
    model="cortecs/gpt-6-sol",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

### Structured Output

```python showLineNumbers title="Cortecs JSON Schema Output"
import os
from litellm import completion

os.environ["CORTECS_API_KEY"] = ""  # your Cortecs API key

response = completion(
    model="cortecs/gpt-6-sol",
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

### Responses API

Cortecs serves the OpenAI Responses API natively, so `litellm.responses` sends the request straight to `https://api.cortecs.ai/v1/responses`.

```python showLineNumbers title="Cortecs Responses API"
import os
import litellm

os.environ["CORTECS_API_KEY"] = ""  # your Cortecs API key

response = litellm.responses(
    model="cortecs/gpt-6-sol",
    input="Say hello",
)

print(response.output_text)
```

### Anthropic Messages API

Cortecs also serves the Anthropic Messages API natively, so `litellm.anthropic.messages.acreate` sends the request straight to `https://api.cortecs.ai/v1/messages`.

```python showLineNumbers title="Cortecs Anthropic Messages API"
import asyncio
import os
import litellm

os.environ["CORTECS_API_KEY"] = ""  # your Cortecs API key

async def main():
    response = await litellm.anthropic.messages.acreate(
        model="cortecs/gpt-6-sol",
        messages=[{"role": "user", "content": "Say hello"}],
        max_tokens=64,
    )
    print(response["content"][0]["text"])

asyncio.run(main())
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-6-sol
    litellm_params:
      model: cortecs/gpt-6-sol
      api_key: os.environ/CORTECS_API_KEY
```

A deployment configured this way serves all three endpoints on the proxy: `/v1/chat/completions`, `/v1/responses`, and `/v1/messages`.

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-6-sol",
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
    "model": "gpt-6-sol",
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
    "model": "gpt-6-sol",
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

os.environ["CORTECS_API_BASE"] = "https://custom.cortecs.example/v1"
os.environ["CORTECS_API_KEY"] = ""  # your API key

response = completion(
    model="cortecs/gpt-6-sol",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="cortecs/gpt-6-sol",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://custom.cortecs.example/v1",
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
