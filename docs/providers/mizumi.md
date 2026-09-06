# Mizumi

## Overview

| Property | Details |
|-------|-------|
| Description | Mizumi is an OpenAI-compatible LLM API gateway offering frontier models at 15–28% below official list pricing with spend-based tiers, zero prompt retention, and a $2 free trial credit. |
| Provider Route on LiteLLM | `mizumi/` |
| Link to Provider Doc | [Mizumi Website ↗](https://mizumi.co) |
| Base URL | `https://api.mizumi.co/v1` |
| Supported Operations | [`/chat/completions`](/docs/providers/mizumi#usage---litellm-python-sdk) |

<br />

## What is Mizumi?

Mizumi is an OpenAI-compatible LLM API gateway that offers:
- **Below-List Pricing**: 15–28% below official list pricing, with spend-based tiers
- **Zero Prompt Retention**: your prompts are never stored
- **$2 Free Trial Credit**: get started without a credit card
- **OpenAI-Compatible API**: drop-in replacement for existing OpenAI code
- **Streaming Support**: real-time response streaming
- **Tool Calling**: support for function calling

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["MIZUMI_API_KEY"] = ""  # your Mizumi API key (sk-mizumi-...)
```

Get your Mizumi API key from [mizumi.co](https://mizumi.co).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Mizumi Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["MIZUMI_API_KEY"] = ""  # your Mizumi API key

messages = [{"content": "What is the capital of France?", "role": "user"}]

# Mizumi call
response = completion(
    model="mizumi/gpt-5.6-sol",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="Mizumi Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["MIZUMI_API_KEY"] = ""  # your Mizumi API key

messages = [{"content": "Write a short poem about AI", "role": "user"}]

# Mizumi call with streaming
response = completion(
    model="mizumi/gpt-5.6-sol",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Tool Calling

```python showLineNumbers title="Mizumi Tool Calling"
import os
import litellm

os.environ["MIZUMI_API_KEY"] = ""

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                }
            }
        }
    }
]

response = litellm.completion(
    model="mizumi/gpt-5.6-sol",
    messages=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=tools
)
```

## Usage - LiteLLM Proxy Server

### 1. Save key in your environment

```bash
export MIZUMI_API_KEY=""
```

### 2. Start the proxy

```yaml
model_list:
  - model_name: mizumi-model
    litellm_params:
      model: mizumi/gpt-5.6-sol
      api_key: os.environ/MIZUMI_API_KEY
```

## Supported Models

| Model Name | Function Call |
|------------|---------------|
| gpt-5.6-sol | `response = completion(model="mizumi/gpt-5.6-sol", messages=messages)` |
| gpt-5.6-terra | `response = completion(model="mizumi/gpt-5.6-terra", messages=messages)` |
| gpt-5.6-luna | `response = completion(model="mizumi/gpt-5.6-luna", messages=messages)` |
| gpt-5.5 | `response = completion(model="mizumi/gpt-5.5", messages=messages)` |
| gpt-5.4 | `response = completion(model="mizumi/gpt-5.4", messages=messages)` |
| gpt-4.1-mini | `response = completion(model="mizumi/gpt-4.1-mini", messages=messages)` |

## Supported OpenAI Parameters

Mizumi supports all standard OpenAI-compatible parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `messages` | array | **Required**. Array of message objects with 'role' and 'content' |
| `model` | string | **Required**. Model ID from the available model list |
| `stream` | boolean | Optional. Enable streaming responses |
| `temperature` | float | Optional. Sampling temperature |
| `top_p` | float | Optional. Nucleus sampling parameter |
| `max_tokens` | integer | Optional. Maximum tokens to generate |
| `frequency_penalty` | float | Optional. Penalize frequent tokens |
| `presence_penalty` | float | Optional. Penalize tokens based on presence |
| `stop` | string/array | Optional. Stop sequences |
| `n` | integer | Optional. Number of completions to generate |
| `tools` | array | Optional. List of available tools/functions |
| `tool_choice` | string/object | Optional. Control tool/function calling |
| `response_format` | object | Optional. Response format specification |
| `user` | string | Optional. User identifier |

## Pricing Model

Mizumi offers a simple, transparent pricing structure:
- **Below Official List Pricing**: 15–28% cheaper than going direct
- **Spend-Based Tiers**: higher volume unlocks deeper discounts
- **$2 Free Trial Credit**: evaluate the API before paying
- **Zero Prompt Retention**: prompts are never stored or used for training

## API Documentation

For detailed API documentation, visit [mizumi.co/docs](https://mizumi.co/docs).

## Additional Resources

- [Mizumi Website](https://mizumi.co)
- [Mizumi API Documentation](https://mizumi.co/docs)
