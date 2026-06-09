import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# UOMI

## Overview

| Property | Details |
|-------|-------|
| Description | UOMI provides OpenAI-compatible access to actively served open-source language models through the UOMI gateway. |
| Provider Route on LiteLLM | `uomi/` |
| Link to Provider Doc | [UOMI Model Catalog ↗](https://gateway.uomi.ai/v1/models) |
| Base URL | `https://gateway.uomi.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/completions`](#legacy-completions) |

<br />
<br />

https://gateway.uomi.ai/v1/models

**We support UOMI models from the active model catalog. Set `uomi/` as a prefix when sending completion requests.**

## Available Models

UOMI model availability is driven by the live catalog at [`/v1/models`](https://gateway.uomi.ai/v1/models). LiteLLM includes an initial static snapshot of ready models for pricing and model metadata.

| Model | Context Window | Max Output |
|-------|----------------|------------|
| `uomi/deepseek/deepseek-v4-flash` | 1,048,576 tokens | 8,192 tokens |
| `uomi/deepseek/deepseek-v4-pro` | 1,048,576 tokens | 8,192 tokens |
| `uomi/xiaomi/mimo-v2.5` | 1,048,576 tokens | 8,192 tokens |
| `uomi/nvidia/nemotron-3-super-120b-a12b` | 1,000,000 tokens | 8,192 tokens |
| `uomi/google/gemma-4-26b-a4b-it` | 262,144 tokens | 8,192 tokens |
| `uomi/google/gemma-4-31B-it` | 262,144 tokens | 8,192 tokens |
| `uomi/qwen/qwen3-235b-a22b-2507` | 262,144 tokens | 8,192 tokens |
| `uomi/qwen/qwen3.5-397b-a17b` | 262,144 tokens | 8,192 tokens |
| `uomi/qwen/qwen3.6-27b` | 262,144 tokens | 8,192 tokens |
| `uomi/qwen/qwen3.6-35b-a3b` | 262,144 tokens | 8,192 tokens |
| `uomi/xiaomi/mimo-v2-flash` | 262,144 tokens | 8,192 tokens |
| `uomi/minimax/minimax-m2.5` | 204,800 tokens | 8,192 tokens |
| `uomi/minimax/minimax-m2.7` | 204,800 tokens | 8,192 tokens |
| `uomi/z-ai/glm-4.7` | 202,752 tokens | 8,192 tokens |
| `uomi/z-ai/glm-5` | 202,752 tokens | 8,192 tokens |
| `uomi/z-ai/glm-5.1` | 202,752 tokens | 8,192 tokens |
| `uomi/deepseek/deepseek-chat-v3-0324` | 163,840 tokens | 8,192 tokens |
| `uomi/deepseek/deepseek-v3.2` | 131,072 tokens | 8,192 tokens |
| `uomi/mistralai/mistral-nemo` | 131,072 tokens | 8,192 tokens |
| `uomi/openai/gpt-oss-120b` | 131,072 tokens | 8,192 tokens |
| `uomi/z-ai/glm-4.5-air` | 131,072 tokens | 8,192 tokens |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["UOMI_API_KEY"] = ""  # your UOMI API key
```

Create an API key from the [UOMI API Keys dashboard ↗](https://uomirouter.uomi.ai/dashboard/keys).

You can overwrite the base URL with:

```python showLineNumbers title="Optional Base URL Override"
os.environ["UOMI_API_BASE"] = "https://gateway.uomi.ai/v1"
```

UOMI charges requests against your prepaid balance. Add funds from the [UOMI wallet dashboard ↗](https://uomirouter.uomi.ai/dashboard/wallet).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="UOMI Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["UOMI_API_KEY"] = ""  # your UOMI API key

messages = [{"content": "What is the capital of Italy?", "role": "user"}]

response = completion(
    model="uomi/deepseek/deepseek-v4-flash",
    messages=messages,
)

print(response)
```

### Streaming

```python showLineNumbers title="UOMI Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["UOMI_API_KEY"] = ""  # your UOMI API key

messages = [{"content": "Count to 5", "role": "user"}]

response = completion(
    model="uomi/deepseek/deepseek-v4-flash",
    messages=messages,
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Legacy Completions

UOMI also supports the OpenAI-compatible legacy `/v1/completions` endpoint.

```python showLineNumbers title="UOMI Legacy Text Completion"
import os
import litellm
from litellm import text_completion

os.environ["UOMI_API_KEY"] = ""  # your UOMI API key

response = text_completion(
    model="uomi/deepseek/deepseek-v4-flash",
    prompt="The capital of France is",
    max_tokens=8,
)

print(response)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: uomi-deepseek-v4-flash
    litellm_params:
      model: uomi/deepseek/deepseek-v4-flash
      api_key: os.environ/UOMI_API_KEY

  - model_name: uomi-qwen-3-6-27b
    litellm_params:
      model: uomi/qwen/qwen3.6-27b
      api_key: os.environ/UOMI_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="UOMI via Proxy - Non-streaming"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="your-proxy-api-key",
)

response = client.chat.completions.create(
    model="uomi-deepseek-v4-flash",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

```python showLineNumbers title="UOMI via Proxy - Streaming"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="your-proxy-api-key",
)

response = client.chat.completions.create(
    model="uomi-deepseek-v4-flash",
    messages=[{"role": "user", "content": "hello from litellm"}],
    stream=True,
)

for chunk in response:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

</TabItem>

<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="UOMI via Proxy - LiteLLM SDK"
import litellm

response = litellm.completion(
    model="litellm_proxy/uomi-deepseek-v4-flash",
    messages=[{"role": "user", "content": "hello from litellm"}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key",
)

print(response.choices[0].message.content)
```

```python showLineNumbers title="UOMI via Proxy - LiteLLM SDK Streaming"
import litellm

response = litellm.completion(
    model="litellm_proxy/uomi-deepseek-v4-flash",
    messages=[{"role": "user", "content": "hello from litellm"}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key",
    stream=True,
)

for chunk in response:
    if hasattr(chunk.choices[0], "delta") and chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="UOMI via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "uomi-deepseek-v4-flash",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

```bash showLineNumbers title="UOMI via Proxy - cURL Streaming"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "uomi-deepseek-v4-flash",
    "messages": [{"role": "user", "content": "hello from litellm"}],
    "stream": true
  }'
```

</TabItem>
</Tabs>

For more detailed information on using the LiteLLM Proxy, see the [LiteLLM Proxy documentation](../providers/litellm_proxy).
