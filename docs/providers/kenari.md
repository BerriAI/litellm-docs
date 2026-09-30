# Kenari

## Overview

| Property | Details |
|-------|-------|
| Description | Kenari is an OpenAI-compatible LLM gateway with Indonesian Rupiah (IDR) billing, serving models from DeepSeek, GLM, Kimi, Qwen, Claude, GPT and others through one endpoint. |
| Provider Route on LiteLLM | `kenari/` |
| Link to Provider Doc | [Kenari Docs ↗](https://kenari.id/docs) |
| Base URL | `https://kenari.id/v1` |
| Supported Operations | [`/chat/completions`](#sample-usage) |

<br />

## What is Kenari?

Kenari is an LLM gateway that offers:
- **One API for many models**: DeepSeek, GLM, Kimi, Qwen, Claude, GPT and more behind a single OpenAI-compatible endpoint
- **IDR wallet billing**: prepaid Indonesian Rupiah balance, QRIS top-up
- **OpenAI-compatible API**: works with existing OpenAI SDK code
- **Streaming support**: real-time response streaming
- **Tool calling**: function calling on supported models

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["KENARI_API_KEY"] = ""  # your Kenari API key (kn-...)
```

Get your Kenari API key from the [kenari.id dashboard](https://kenari.id).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Kenari Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["KENARI_API_KEY"] = ""  # your Kenari API key

messages = [{"content": "What is the capital of Indonesia?", "role": "user"}]

# Kenari call
response = completion(
    model="kenari/deepseek-v4-flash",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="Kenari Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["KENARI_API_KEY"] = ""  # your Kenari API key

messages = [{"content": "Write a short poem about the sea.", "role": "user"}]

# Kenari call with streaming
response = completion(
    model="kenari/deepseek-v4-flash",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4-flash
    litellm_params:
      model: kenari/deepseek-v4-flash
      api_key: os.environ/KENARI_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

```python showLineNumbers title="Kenari via Proxy"
import openai

client = openai.OpenAI(
    api_key="your-litellm-proxy-api-key",
    base_url="http://localhost:4000"
)

response = client.chat.completions.create(
    model="deepseek-v4-flash",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

## Overriding the API Base

Point LiteLLM at a different Kenari-compatible deployment with `KENARI_API_BASE`:

```python showLineNumbers title="Custom API Base"
import os

os.environ["KENARI_API_BASE"] = "https://your-deployment.example.com/v1"
```

## Available Models

The live model list is served at [`https://kenari.id/v1/models`](https://kenari.id/v1/models). Use any listed model id with the `kenari/` prefix, for example `kenari/deepseek-v4-pro` or `kenari/glm-5-2`.
