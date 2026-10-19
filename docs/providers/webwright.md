# WebWright

## Overview

| Property | Details |
|-------|-------|
| Description | WebWright serves the Wren R1 model through an OpenAI-compatible API. |
| Provider Route on LiteLLM | `webwright/` |
| Link to Provider Doc | [WebWright ↗](https://webwright.ai) |
| Base URL | `https://webwright.ai/v1` |
| Supported Operations | [`/chat/completions`](/docs/providers/webwright#usage---litellm-python-sdk) |

<br />

Set `webwright/` as the prefix when sending completion requests to route them to the WebWright API.

## Available Models

| Model | Description |
|-------|-------------|
| `webwright/wren-r1` | Wren R1, WebWright's Standard plan chat completion model. |
| `webwright/wren-r1-fast` | Wren R1 Priority, the Premium plan id for the same upstream model with priority capacity. |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["WEBWRIGHT_API_KEY"] = ""  # your WebWright API key
```

Get your API key from the [WebWright dashboard](https://webwright.ai).

Set `WEBWRIGHT_API_BASE` to override the default base URL, for example when you point at a self-hosted gateway.

```python showLineNumbers title="Environment Variable - Custom Base URL"
os.environ["WEBWRIGHT_API_BASE"] = "https://webwright.ai/v1"
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="WebWright Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["WEBWRIGHT_API_KEY"] = ""  # your WebWright API key

messages = [{"content": "What is the capital of France?", "role": "user"}]

response = completion(
    model="webwright/wren-r1",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="WebWright Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["WEBWRIGHT_API_KEY"] = ""  # your WebWright API key

messages = [{"content": "Write a short poem about AI", "role": "user"}]

response = completion(
    model="webwright/wren-r1",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: wren-r1
    litellm_params:
      model: webwright/wren-r1
      api_key: os.environ/WEBWRIGHT_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

## Supported OpenAI Parameters

WebWright supports the following OpenAI-compatible parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `messages` | array | **Required**. Array of message objects with 'role' and 'content' |
| `model` | string | **Required**. Model ID (`wren-r1` or `wren-r1-fast`) |
| `stream` | boolean | Optional. Enable streaming responses |
| `temperature` | float | Optional. Sampling temperature |
| `top_p` | float | Optional. Nucleus sampling parameter |
| `max_tokens` | integer | Optional. Maximum tokens to generate |
| `stop` | string/array | Optional. Stop sequences |
| `tools` | array | Optional. List of available tools/functions |
| `tool_choice` | string/object | Optional. Control tool/function calling |
| `response_format` | object | Optional. Structured output response format |

WebWright's abilities reference also declares a reasoning mode. The public request reference does not document a caller-facing reasoning field or allowed values.

## Additional Resources

[WebWright](https://webwright.ai) serves the Wren R1 model through an OpenAI-compatible API. A runnable quickstart for pointing an OpenAI-compatible client at `wren-r1` is at https://webwright.ai/blog/wren-quickstart.
