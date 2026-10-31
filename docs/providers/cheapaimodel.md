import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# cheapaimodel

## Overview

| Property | Details |
|-------|-------|
| Description | cheapaimodel is an OpenAI-compatible API that serves first-party models from DeepSeek, Z.ai, xAI and Moonshot under one key, prepaid in USD and billed per token. |
| Provider Route on LiteLLM | `cheapaimodel/` |
| Link to Provider Doc | [cheapaimodel Documentation ↗](https://cheapaimodel.ai/docs) |
| Base URL | `https://api.cheapaimodel.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

**We support ALL cheapaimodel chat models, just set `cheapaimodel/` as a prefix when sending completion requests**

## Available Models

| Model | Description | Context Window | Max Output |
|-------|-------------|----------------|------------|
| `cheapaimodel/deepseek-v4-1-flash` | DeepSeek V4.1 Flash, text and image input | 1,000,000 tokens | 384,000 tokens |
| `cheapaimodel/glm-5.3` | Z.ai GLM-5.3, text input | 1,000,000 tokens | 128,000 tokens |
| `cheapaimodel/glm-5.3-flash` | Z.ai GLM-5.3-Flash, text and image input | 1,000,000 tokens | 128,000 tokens |
| `cheapaimodel/grok-4.7` | xAI Grok 4.7, text and image input | 500,000 tokens | 500,000 tokens |
| `cheapaimodel/kimi-k3` | Moonshot Kimi K3, text and image input | 1,048,576 tokens | 1,048,576 tokens |

All five models support reasoning, function calling, streaming and JSON schema output, and prompt caching is applied automatically. The live catalog, with prices, is at [cheapaimodel.ai/models](https://cheapaimodel.ai/models).

`cheapaimodel/deepseek-v4-1-flash` follows DeepSeek's peak and off-peak rates: weekdays 01:00–04:00 and 06:00–10:00 UTC bill at the peak rate, all other hours at half. LiteLLM's cost tracking applies the off-peak rate automatically.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["CHEAPAIMODEL_API_KEY"] = ""  # your cheapaimodel API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="cheapaimodel Non-streaming Completion"
import os
from litellm import completion

os.environ["CHEAPAIMODEL_API_KEY"] = ""  # your cheapaimodel API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="cheapaimodel/deepseek-v4-1-flash",
    messages=messages,
)

print(response)
```

### Streaming

```python showLineNumbers title="cheapaimodel Streaming Completion"
import os
from litellm import completion

os.environ["CHEAPAIMODEL_API_KEY"] = ""  # your cheapaimodel API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

response = completion(
    model="cheapaimodel/kimi-k3",
    messages=messages,
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="cheapaimodel Function Calling"
import os
from litellm import completion

os.environ["CHEAPAIMODEL_API_KEY"] = ""  # your cheapaimodel API key

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a city",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "The city, e.g. Singapore"}
            },
            "required": ["city"],
        },
    },
}]

response = completion(
    model="cheapaimodel/glm-5.3",
    messages=[{"role": "user", "content": "What's the weather in Singapore?"}],
    tools=tools,
    tool_choice="auto",
)

print(response.choices[0].message.tool_calls)
```

### Reasoning

Pass `reasoning_effort` to set how much the model thinks. The levels each model accepts are its lab's: `low`, `high` and `max` on DeepSeek, GLM and Kimi; `low`, `medium`, `high` and `xhigh` on Grok. DeepSeek, GLM and Kimi return their reasoning in `reasoning_content`; Grok reports only the reasoning token count.

```python showLineNumbers title="cheapaimodel Reasoning Effort"
import os
from litellm import completion

os.environ["CHEAPAIMODEL_API_KEY"] = ""  # your cheapaimodel API key

response = completion(
    model="cheapaimodel/deepseek-v4-1-flash",
    messages=[{"role": "user", "content": "What is 17 * 23?"}],
    reasoning_effort="high",
)

print(response.choices[0].message.reasoning_content)
print(response.choices[0].message.content)
```

DeepSeek V4.1 Flash can also turn thinking off:

```python showLineNumbers title="Disable thinking on DeepSeek"
response = completion(
    model="cheapaimodel/deepseek-v4-1-flash",
    messages=[{"role": "user", "content": "What is 17 * 23?"}],
    extra_body={"thinking": {"type": "disabled"}},
)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4-1-flash
    litellm_params:
      model: cheapaimodel/deepseek-v4-1-flash
      api_key: os.environ/CHEAPAIMODEL_API_KEY
  - model_name: kimi-k3
    litellm_params:
      model: cheapaimodel/kimi-k3
      api_key: os.environ/CHEAPAIMODEL_API_KEY
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["CHEAPAIMODEL_API_BASE"] = "https://api.cheapaimodel.ai/v1"
os.environ["CHEAPAIMODEL_API_KEY"] = ""  # your API key

response = completion(
    model="cheapaimodel/deepseek-v4-1-flash",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="cheapaimodel/deepseek-v4-1-flash",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://api.cheapaimodel.ai/v1",
    api_key="your-api-key",
)
```
