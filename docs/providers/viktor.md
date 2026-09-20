import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Viktor

## Overview

| Property | Details |
|-------|-------|
| Description | Viktor is an AI employee: an agent that works inside a team's tools (code sandbox, files, connected integrations) and is reachable over an OpenAI-compatible API. |
| Provider Route on LiteLLM | `viktor/` |
| Link to Provider Doc | [Viktor ↗](https://viktor.com) |
| Base URL | `https://api.viktor.com/api/compat/v1` |
| Supported Operations | [`/chat/completions`](#sample-usage), [`/responses`](#responses-api) |

<br />
<br />

**Viktor serves a single model id, `viktor`. Always write it as `viktor/viktor`.**

:::info

Viktor is an agent, not a bare LLM. Each request starts a Viktor run that can use Viktor's own tools next to the tools you pass, can take minutes (up to 600 seconds), and may act on the team's connected systems. Every request is a billed run. Set a long timeout and turn retries off, because a retry runs the work again.

:::

## Available Models

| Model | Description |
|-------|-------------|
| `viktor/viktor` | The Viktor agent. Supports streaming, function calling, JSON mode, JSON schema output and image input. |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["VIKTOR_API_KEY"] = ""  # your Viktor API key, scope chat:completions
```

Create the key in Viktor under **Settings → API keys**. A personal key needs a linked Slack or Microsoft Teams identity.

## Usage - LiteLLM Python SDK {#sample-usage}

### Non-streaming

```python showLineNumbers title="Viktor Non-streaming Completion"
import os
from litellm import completion

os.environ["VIKTOR_API_KEY"] = ""  # your Viktor API key

messages = [{"content": "Summarise what changed in our #releases channel this week.", "role": "user"}]

# Viktor call
response = completion(
    model="viktor/viktor",
    messages=messages,
    timeout=660,
    num_retries=0,
)

print(response)
```

### Streaming

```python showLineNumbers title="Viktor Streaming Completion"
import os
from litellm import completion

os.environ["VIKTOR_API_KEY"] = ""  # your Viktor API key

messages = [{"content": "Summarise what changed in our #releases channel this week.", "role": "user"}]

# Viktor call with streaming
response = completion(
    model="viktor/viktor",
    messages=messages,
    stream=True,
    timeout=660,
    num_retries=0,
)

for chunk in response:
    print(chunk)
```

Viktor sends keep-alive comments on the streaming wire while it works in its own tools, so prefer streaming for long tasks.

### Function Calling

```python showLineNumbers title="Viktor Function Calling"
import os
from litellm import completion

os.environ["VIKTOR_API_KEY"] = ""  # your Viktor API key

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
                    "description": "The city, e.g. Berlin"
                }
            },
            "required": ["city"]
        }
    }
}]

messages = [{"role": "user", "content": "What's the weather in Berlin?"}]

response = completion(
    model="viktor/viktor",
    messages=messages,
    tools=tools,
    tool_choice="auto",
    timeout=660,
    num_retries=0,
)

print(response)
```

Tool call ids from Viktor look like `call_vk1_<thread>_...`. They are routing tokens: send them back unchanged in your `tool` messages and Viktor resumes the same run. Only function tools are accepted.

### Structured Output

```python showLineNumbers title="Viktor JSON Schema Output"
import os
from litellm import completion

os.environ["VIKTOR_API_KEY"] = ""  # your Viktor API key

response = completion(
    model="viktor/viktor",
    messages=[{"role": "user", "content": "The city is Berlin"}],
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
    timeout=660,
    num_retries=0,
)

print(response)
```

### Vision

Viktor accepts `https` and `data:` image URLs in jpeg, png, gif and webp, at most 10 images per request.

```python showLineNumbers title="Viktor Image Input"
import os
from litellm import completion

os.environ["VIKTOR_API_KEY"] = ""  # your Viktor API key

response = completion(
    model="viktor/viktor",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What does this chart show?"},
            {"type": "image_url", "image_url": {"url": "https://example.com/chart.png"}},
        ],
    }],
    timeout=660,
    num_retries=0,
)

print(response)
```

### Responses API {#responses-api}

```python showLineNumbers title="Viktor Responses API"
import os
import litellm

os.environ["VIKTOR_API_KEY"] = ""  # your Viktor API key

response = litellm.responses(
    model="viktor/viktor",
    input="Create a scratch file with today's open incidents.",
    timeout=660,
    num_retries=0,
)

print(response.output)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: viktor
    litellm_params:
      model: viktor/viktor
      api_key: os.environ/VIKTOR_API_KEY
      timeout: 660
      num_retries: 0
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["VIKTOR_API_BASE"] = "https://viktor-gateway.internal.example/api/compat/v1"
os.environ["VIKTOR_API_KEY"] = ""  # your API key

response = completion(
    model="viktor/viktor",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="viktor/viktor",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://viktor-gateway.internal.example/api/compat/v1",
    api_key="your-api-key",
)
```

## Supported OpenAI Parameters

- `temperature`
- `top_p`
- `max_tokens`
- `max_completion_tokens`
- `stop`
- `stream`
- `stream_options`
- `tools`
- `tool_choice`
- `parallel_tool_calls`
- `response_format`

`temperature`, `top_p`, `max_tokens` and `stop` are best effort, since one request can involve several model calls inside Viktor. `n` is accepted but Viktor always returns one choice. System messages are added to Viktor's own instructions and do not replace them.
