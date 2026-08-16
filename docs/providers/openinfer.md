import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenInfer

## Overview

| Property | Details |
|-------|-------|
| Description | OpenInfer Cloud is a hosted, OpenAI-compatible inference API. |
| Provider Route on LiteLLM | `openinfer/` |
| Link to Provider Doc | [OpenInfer ↗](https://openinfer.ai/) |
| Base URL | `https://api.openinfer.ai/v1` |
| Supported Operations | [`/chat/completions`](#sample-usage) |

<br />
<br />

https://openinfer.ai/

**We support ALL OpenInfer models, just set `openinfer/` as a prefix when sending completion requests**

OpenInfer model IDs use an `@oi/` prefix. LiteLLM catalog keys are `openinfer/@oi/...`, so the `@oi/` prefix is forwarded to the API.

## Available Models

| Model | Context window | Max output |
|-------|----------------|------------|
| `openinfer/@oi/Llama-3.2-1B-Instruct` | 128,000 | 8,192 |
| `openinfer/@oi/Qwen3.5-9B` | 262,144 | 8,192 |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["OPENINFER_API_KEY"] = ""  # your OpenInfer API key
```

Get an API key from the [OpenInfer console](https://console.openinfer.ai/register).

You can overwrite the base url with:

```
os.environ["OPENINFER_API_BASE"] = "https://api.openinfer.ai/v1"
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="OpenInfer Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["OPENINFER_API_KEY"] = ""  # your OpenInfer API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# OpenInfer call
response = completion(
    model="openinfer/@oi/Llama-3.2-1B-Instruct",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="OpenInfer Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["OPENINFER_API_KEY"] = ""  # your OpenInfer API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# OpenInfer call with streaming
response = completion(
    model="openinfer/@oi/Qwen3.5-9B",
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
  - model_name: oi-llama
    litellm_params:
      model: openinfer/@oi/Llama-3.2-1B-Instruct
      api_key: os.environ/OPENINFER_API_KEY

  - model_name: oi-qwen
    litellm_params:
      model: openinfer/@oi/Qwen3.5-9B
      api_key: os.environ/OPENINFER_API_KEY
      api_base: os.environ/OPENINFER_API_BASE  # optional
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="OpenInfer via Proxy - Non-streaming"
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key"       # Your proxy API key
)

# Non-streaming response
response = client.chat.completions.create(
    model="oi-llama",
    messages=[{"role": "user", "content": "hello from litellm"}]
)

print(response.choices[0].message.content)
```

```python showLineNumbers title="OpenInfer via Proxy - Streaming"
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key"       # Your proxy API key
)

# Streaming response
response = client.chat.completions.create(
    model="oi-qwen",
    messages=[{"role": "user", "content": "hello from litellm"}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

</TabItem>
<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="OpenInfer via Proxy - LiteLLM SDK"
import litellm

# Configure LiteLLM to use your proxy
response = litellm.completion(
    model="litellm_proxy/oi-llama",
    messages=[{"role": "user", "content": "hello from litellm"}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key"
)

print(response.choices[0].message.content)
```

```python showLineNumbers title="OpenInfer via Proxy - LiteLLM SDK Streaming"
import litellm

# Configure LiteLLM to use your proxy with streaming
response = litellm.completion(
    model="litellm_proxy/oi-qwen",
    messages=[{"role": "user", "content": "hello from litellm"}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key",
    stream=True
)

for chunk in response:
    if hasattr(chunk.choices[0], 'delta') and chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash showLineNumbers title="OpenInfer via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "oi-llama",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

```bash showLineNumbers title="OpenInfer via Proxy - cURL Streaming"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "oi-qwen",
    "messages": [{"role": "user", "content": "hello from litellm"}],
    "stream": true
  }'
```

</TabItem>
</Tabs>

For more detailed information on using the LiteLLM Proxy, see the [LiteLLM Proxy documentation](../providers/litellm_proxy).
