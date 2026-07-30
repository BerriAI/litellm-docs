# Scalattice

## Overview

| Property | Details |
|-------|-------|
| Description | Scalattice is a managed OpenAI-compatible inference API. Send chat completions with model, region, and security settings; Scalattice routes capacity on the network and bills per token from prepaid credits. |
| Provider Route on LiteLLM | `scalattice/` |
| Link to Provider Doc | [Scalattice Docs](https://scalattice.cloud/docs/developers) ↗ |
| Base URL | `https://api.scalattice.cloud/v1` |
| Supported Operations | `/chat/completions` |

https://scalattice.com

**We support ALL Scalattice catalog models — set `scalattice/` as a prefix when sending completion requests.**

## Available Models

Popular catalog models (IDs for `scalattice/<model>`). Full live list: `GET https://api.scalattice.cloud/v1/models`.

| Model | Description | Context Window | Input / Output per 1M tokens |
|-------|-------------|----------------|------------------------------|
| `scalattice/qwen-3-8b` | Qwen3 8B — strong small general | 40,960 | $1.00 / $3.00 |
| `scalattice/deepseek-r1-7b` | DeepSeek R1 7B distill — reasoning | 65,536 | $1.20 / $3.60 |
| `scalattice/qwen-2.5-coder-7b` | Qwen2.5 Coder 7B | 32,768 | $1.10 / $3.30 |
| `scalattice/qwen-3-14b` | Qwen3 14B | 40,960 | $1.30 / $3.90 |
| `scalattice/gemma-3-27b` | Gemma 3 27B | 131,072 | $1.50 / $4.50 |
| `scalattice/qwen-3-32b` | Qwen3 32B | 40,960 | $1.70 / $5.10 |
| `scalattice/llama-3.3-70b` | Llama 3.3 70B Instruct | 131,072 | $2.00 / $6.00 |

Pricing is prepaid credits (USD). Rates can change with demand and capacity — see [Scalattice pricing](https://scalattice.com/pricing/).

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["SCALATTICE_API_KEY"] = ""  # your Scalattice API key (slt_...)
# optional override:
# os.environ["SCALATTICE_API_BASE"] = "https://api.scalattice.cloud/v1"
```

Create a key in the [Developers dashboard](https://scalattice.cloud/developers) or with [`scalattice setup`](https://scalattice.com/cli/).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Scalattice Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["SCALATTICE_API_KEY"] = ""  # your Scalattice API key (slt_...)

messages = [{"content": "What is the capital of France?", "role": "user"}]

response = completion(
    model="scalattice/qwen-3-8b",
    messages=messages,
)
print(response)
```

### Streaming

```python showLineNumbers title="Scalattice Streaming Completion"
import os
from litellm import completion

os.environ["SCALATTICE_API_KEY"] = ""  # your Scalattice API key (slt_...)

messages = [{"content": "Write a short poem about distributed inference", "role": "user"}]

response = completion(
    model="scalattice/qwen-3-8b",
    messages=messages,
    stream=True,
)
for chunk in response:
    print(chunk)
```

### Async

```python showLineNumbers title="Scalattice Async Completion"
import os
import litellm

os.environ["SCALATTICE_API_KEY"] = ""  # your Scalattice API key (slt_...)

response = await litellm.acompletion(
    model="scalattice/deepseek-r1-7b",
    messages=[{"role": "user", "content": "Explain chain-of-thought briefly."}],
)
print(response.choices[0].message.content)
```

## Usage - LiteLLM Proxy

Add Scalattice models to your LiteLLM Proxy config:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: qwen-scalattice
    litellm_params:
      model: scalattice/qwen-3-8b
      api_key: os.environ/SCALATTICE_API_KEY
  - model_name: coder-scalattice
    litellm_params:
      model: scalattice/qwen-2.5-coder-7b
      api_key: os.environ/SCALATTICE_API_KEY
  - model_name: reason-scalattice
    litellm_params:
      model: scalattice/deepseek-r1-7b
      api_key: os.environ/SCALATTICE_API_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

### OpenAI SDK

```python showLineNumbers title="Scalattice via Proxy - Non-streaming"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="your-proxy-api-key",
)

response = client.chat.completions.create(
    model="qwen-scalattice",
    messages=[{"role": "user", "content": "Explain quantum computing in simple terms"}],
)
print(response.choices[0].message.content)
```

```python showLineNumbers title="Scalattice via Proxy - Streaming"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="your-proxy-api-key",
)

response = client.chat.completions.create(
    model="coder-scalattice",
    messages=[{"role": "user", "content": "Write a Python function to sort a list"}],
    stream=True,
)
for chunk in response:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

### LiteLLM SDK

```python showLineNumbers title="Scalattice via Proxy - LiteLLM SDK"
import litellm

response = litellm.completion(
    model="litellm_proxy/qwen-scalattice",
    messages=[{"role": "user", "content": "What are the benefits of renewable energy?"}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key",
)
print(response.choices[0].message.content)
```

### cURL

```bash showLineNumbers title="Scalattice via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "qwen-scalattice",
    "messages": [{"role": "user", "content": "What is machine learning?"}]
  }'
```

For more on the proxy, see [LiteLLM Proxy](../providers/litellm_proxy).

## Supported OpenAI Parameters

Scalattice is OpenAI-compatible for chat completions. Common parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `messages` | array | Required. Message objects with `role` and `content` |
| `model` | string | Required. Catalog model ID (with `scalattice/` prefix in LiteLLM) |
| `stream` | boolean | Optional. SSE streaming |
| `temperature` | float | Optional. Sampling temperature |
| `top_p` | float | Optional. Nucleus sampling |
| `max_tokens` | integer | Optional. Max tokens to generate |
| `stop` | string/array | Optional. Stop sequences |
| `tools` | array | Optional. Tool / function definitions |
| `tool_choice` | string/object | Optional. Tool choice control |
| `response_format` | object | Optional. Structured output |
| `user` | string | Optional. End-user identifier |

## Advanced Usage

### Custom API Base

```python showLineNumbers title="Custom API Base"
import litellm

response = litellm.completion(
    model="scalattice/qwen-3-8b",
    messages=[{"role": "user", "content": "Hello"}],
    api_base="https://api.scalattice.cloud/v1",
    api_key="slt_...",
)
```

### Open WebUI

Point Open WebUI at Scalattice directly (`https://api.scalattice.cloud/v1` + `slt_...` key), or put LiteLLM Proxy in front and select a Scalattice-backed model. See [Scalattice + Open WebUI](https://scalattice.cloud/docs/developers#open-webui).

## Getting Started

1. Create an account at [scalattice.cloud](https://scalattice.cloud)
2. Add prepaid credits (or a model grant)
3. Create a developer API key (`slt_...`)
4. Call LiteLLM with `model="scalattice/<catalog-id>"` and `SCALATTICE_API_KEY`

## Additional Resources

- [Scalattice website](https://scalattice.com)
- [Cloud developer docs](https://scalattice.cloud/docs/developers)
- [LiteLLM + Open WebUI guide](https://scalattice.com/blog/litellm-open-webui/)
- [CLI](https://scalattice.com/cli/)
- [Pricing](https://scalattice.com/pricing/)
