# Skypool

## Overview

| Property | Details |
|-------|-------|
| Description | Skypool Token provides OpenAI-compatible chat completions for open-weight models served through a decentralized provider network. |
| Provider Route on LiteLLM | `skypool/` |
| Link to Provider | [Skypool](https://skypool.xyz) |
| Base URL | `https://a.skypool.xyz/v1` |
| Supported Operations | `/chat/completions` |

## Required Variables

```python showLineNumbers title="Environment Variables"
import os

os.environ["SKYPOOL_API_KEY"] = ""  # your Skypool Consumer API key
```

You can optionally override the default base URL:

```bash
export SKYPOOL_API_BASE="https://a.skypool.xyz/v1"
```

## Usage - LiteLLM Python SDK

```python showLineNumbers title="Skypool Chat Completion"
import os
from litellm import completion

os.environ["SKYPOOL_API_KEY"] = ""  # your Skypool Consumer API key

response = completion(
    model="skypool/gemma4:26b",
    messages=[{"role": "user", "content": "Hello, introduce Skypool in one sentence."}],
)

print(response)
```

### Streaming

```python showLineNumbers title="Skypool Streaming Completion"
import os
from litellm import completion

os.environ["SKYPOOL_API_KEY"] = ""  # your Skypool Consumer API key

response = completion(
    model="skypool/qwen3.6:35b",
    messages=[{"role": "user", "content": "Write a short poem about distributed AI."}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy Server

### 1. Save your key in the environment

```bash
export SKYPOOL_API_KEY=""
```

### 2. Add Skypool to your proxy config

```yaml
model_list:
  - model_name: skypool-gemma4-26b
    litellm_params:
      model: skypool/gemma4:26b
      api_key: os.environ/SKYPOOL_API_KEY
```

### 3. Start the proxy

```bash
litellm --config /path/to/config.yaml
```

### 4. Test it

```bash
curl --location "http://0.0.0.0:4000/chat/completions" \
  --header "Content-Type: application/json" \
  --data '{
    "model": "skypool-gemma4-26b",
    "messages": [
      {
        "role": "user",
        "content": "Hello, introduce Skypool in one sentence."
      }
    ]
  }'
```

## Supported Models

| Model | Context Window | Max Output Tokens | Input Price | Output Price |
|-------|---------------:|------------------:|------------:|-------------:|
| `skypool/gemma4:26b` | 131,072 | 65,536 | 45 credits / 1M tokens | 210 credits / 1M tokens |
| `skypool/qwen3.5:9b` | 131,072 | 65,536 | 60 credits / 1M tokens | 90 credits / 1M tokens |
| `skypool/qwen3.6:35b` | 65,536 | 65,536 | 90 credits / 1M tokens | 480 credits / 1M tokens |
| `skypool/qwen3.5:122b` | 131,072 | 65,536 | 150 credits / 1M tokens | 1,200 credits / 1M tokens |

## Supported OpenAI Parameters

Skypool supports these OpenAI-compatible chat completion parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `messages` | array | Required. Array of chat messages. |
| `model` | string | Required. Skypool model ID. |
| `stream` | boolean | Optional. Enable streaming responses. |
| `max_tokens` | integer | Optional. Maximum tokens to generate. |
| `temperature` | float | Optional. Sampling temperature. |
| `top_p` | float | Optional. Nucleus sampling parameter. |
| `stop` | string/array | Optional. Stop sequences. |
| `seed` | integer | Optional. Deterministic sampling seed when supported by the model runtime. |
| `tools` | array | Optional. List of available tools/functions. |
| `tool_choice` | string/object | Optional. Control tool/function calling. |

## Direct API Check

You can also verify your key directly against the Skypool OpenAI-compatible endpoint:

```bash
curl --location "https://a.skypool.xyz/v1/chat/completions" \
  --header "Authorization: Bearer $SKYPOOL_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "model": "gemma4:26b",
    "messages": [
      {
        "role": "user",
        "content": "Hello from LiteLLM."
      }
    ]
  }'
```
