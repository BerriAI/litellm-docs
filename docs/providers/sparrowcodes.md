import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SparrowCodes

## Overview

| Property | Details |
|-------|-------|
| Description | SparrowCodes is a model gateway with one key for Claude, GPT, Gemini, DeepSeek, Qwen, GLM and other models, plus `sparrow/auto`, a router that picks a low-cost or stronger model for each coding task. |
| Provider Route on LiteLLM | `sparrowcodes/` |
| Link to Provider Doc | [SparrowCodes Documentation ↗](https://sparrowcodes.com/docs) |
| Base URL | `https://api.sparrowcodes.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#anthropic-messages-api) |

<br />
<br />

**We support ALL SparrowCodes models, just set `sparrowcodes/` as a prefix when sending requests**

Model IDs keep their vendor prefix, so a SparrowCodes model such as `anthropic/claude-sonnet-5.5` is called as `sparrowcodes/anthropic/claude-sonnet-5.5`. The full list, with prices and context windows, is public at `GET https://api.sparrowcodes.com/v1/models`.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["SPARROWCODES_API_KEY"] = ""  # your SparrowCodes API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="SparrowCodes Non-streaming Completion"
import os
from litellm import completion

os.environ["SPARROWCODES_API_KEY"] = ""  # your SparrowCodes API key

response = completion(
    model="sparrowcodes/sparrow/auto",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)

print(response)
```

### Streaming

```python showLineNumbers title="SparrowCodes Streaming Completion"
import os
from litellm import completion

os.environ["SPARROWCODES_API_KEY"] = ""  # your SparrowCodes API key

response = completion(
    model="sparrowcodes/deepseek/deepseek-v4.1-flash",
    messages=[{"content": "Write a short story about AI", "role": "user"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="SparrowCodes Function Calling"
import os
from litellm import completion

os.environ["SPARROWCODES_API_KEY"] = ""  # your SparrowCodes API key

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a location",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string", "description": "The city, e.g. San Francisco"}},
            "required": ["city"],
        },
    },
}]

response = completion(
    model="sparrowcodes/anthropic/claude-sonnet-5.5",
    messages=[{"role": "user", "content": "What's the weather in San Francisco?"}],
    tools=tools,
    tool_choice="auto",
)

print(response)
```

### Responses API

```python showLineNumbers title="SparrowCodes Responses API"
import os
import litellm

os.environ["SPARROWCODES_API_KEY"] = ""  # your SparrowCodes API key

response = litellm.responses(
    model="sparrowcodes/openai/gpt-6.1-sol",
    input="Say hello",
)

print(response.output_text)
```

### Anthropic Messages API

```python showLineNumbers title="SparrowCodes Anthropic Messages API"
import asyncio
import os
import litellm

os.environ["SPARROWCODES_API_KEY"] = ""  # your SparrowCodes API key

async def main():
    response = await litellm.anthropic.messages.acreate(
        model="sparrowcodes/anthropic/claude-sonnet-5.5",
        messages=[{"role": "user", "content": "Say hello"}],
        max_tokens=64,
    )
    print(response["content"][0]["text"])

asyncio.run(main())
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: sparrow-auto
    litellm_params:
      model: sparrowcodes/sparrow/auto
      api_key: os.environ/SPARROWCODES_API_KEY
  - model_name: claude-sonnet-5.5
    litellm_params:
      model: sparrowcodes/anthropic/claude-sonnet-5.5
      api_key: os.environ/SPARROWCODES_API_KEY
```

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sparrow-auto",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="responses" label="Responses">

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-5.5",
    "input": "Hello, how are you?"
  }'
```

</TabItem>
</Tabs>

## Custom API Base

```python showLineNumbers title="Custom API Base"
import os
from litellm import completion

os.environ["SPARROWCODES_API_BASE"] = "https://your-proxy.example.com/v1"  # or pass api_base=...
os.environ["SPARROWCODES_API_KEY"] = ""  # your API key

response = completion(
    model="sparrowcodes/sparrow/auto",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

## Spend Tracking

LiteLLM's model cost map doesn't include SparrowCodes models yet. To track spend, pass `input_cost_per_token` and `output_cost_per_token` in `litellm_params`, using the prices from `https://api.sparrowcodes.com/v1/models`. `sparrow/auto` bills the price of the model it picks, and the response's `model` field names that model.
