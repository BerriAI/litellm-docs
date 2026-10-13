# onomeo

## Overview

| Property | Details |
|-------|-------|
| Description | onomeo serves chat models from several model families through one OpenAI-compatible API and one key, with a free tier and pay-as-you-go access to larger models. |
| Provider Route on LiteLLM | `onomeo/` |
| Link to Provider Doc | [onomeo Documentation ↗](https://onomeo.com/docs) |
| Base URL | `https://onomeo.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

:::info Public beta

onomeo is in public beta. Some features may not work as expected. The onomeo team is collecting feedback and welcomes it, see [onomeo.com](https://onomeo.com).

:::

**We support ALL onomeo chat models, just set `onomeo/` as a prefix when sending completion requests**

## Models

Model ids are passed through as onomeo names them, for example `onomeo/deepseek-v4-flash`, `onomeo/glm-5.2`, `onomeo/claude-sonnet-5.5`, `onomeo/claude-opus-5.5`, `onomeo/gpt-6.1-sol` and `onomeo/auto`. The full list is returned by `GET https://onomeo.com/v1/models`.

## Pricing and limits

About two dozen models are free to call without a card, limited to 30 calls per 5 hours. Claude, GPT and other larger models are pay-as-you-go from a one-time $5 top-up, and the balance does not expire.

onomeo charges the balance by characters of visible text, not by tokens. LiteLLM's model cost map therefore has no onomeo entries, and LiteLLM reports a cost of 0 for onomeo calls.

## Required Variables

Create a key after signing in at [onomeo.com/dashboard](https://onomeo.com/dashboard).

```python showLineNumbers title="Environment Variables"
os.environ["ONOMEO_API_KEY"] = ""  # your onomeo API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="onomeo Non-streaming Completion"
import os
from litellm import completion

os.environ["ONOMEO_API_KEY"] = ""  # your onomeo API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# onomeo call
response = completion(
    model="onomeo/deepseek-v4-flash",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="onomeo Streaming Completion"
import os
from litellm import completion

os.environ["ONOMEO_API_KEY"] = ""  # your onomeo API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

# onomeo call with streaming
response = completion(
    model="onomeo/deepseek-v4-flash",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Function Calling

LiteLLM only forwards `tools` and `tool_choice` for models it knows support function calling. It ships no model metadata for onomeo, so declare the capability first. Without it the SDK raises `UnsupportedParamsError`.

```python showLineNumbers title="onomeo Function Calling"
import os
import litellm
from litellm import completion

os.environ["ONOMEO_API_KEY"] = ""  # your onomeo API key

litellm.register_model({
    "onomeo/deepseek-v4-flash": {
        "litellm_provider": "onomeo",
        "mode": "chat",
        "supports_function_calling": True,
    }
})

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a city",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "The city, e.g. Tokyo"
                }
            },
            "required": ["city"]
        }
    }
}]

messages = [{"role": "user", "content": "What's the weather in Tokyo?"}]

response = completion(
    model="onomeo/deepseek-v4-flash",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4-flash
    litellm_params:
      model: onomeo/deepseek-v4-flash
      api_key: os.environ/ONOMEO_API_KEY
    model_info:
      supports_function_calling: true
```

`model_info.supports_function_calling` is the proxy equivalent of the `register_model` call above. Leave it out for models you do not send tools to.

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["ONOMEO_API_BASE"] = "https://custom.onomeo.example/v1"
os.environ["ONOMEO_API_KEY"] = ""  # your API key

response = completion(
    model="onomeo/deepseek-v4-flash",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="onomeo/deepseek-v4-flash",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://custom.onomeo.example/v1",
    api_key="your-api-key",
)
```

## Token limit parameters

onomeo accepts both `max_tokens` and `max_completion_tokens`, and LiteLLM forwards whichever one you pass unchanged.
