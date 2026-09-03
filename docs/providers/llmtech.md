# LLM Tech

## Overview

| Property | Details |
|-------|-------|
| Description | LLM Tech is an EU-based inference provider serving open-weight models from European hardware with zero data retention. |
| Provider Route on LiteLLM | `llmtech/` |
| Link to Provider Doc | [LLM Tech Website ↗](https://llmtech.eu) |
| Base URL | `https://api.llmtech.eu/v1` |
| Supported Operations | [`/chat/completions`](/docs/providers/llmtech#usage---litellm-python-sdk) |

<br />

## What is LLM Tech?

LLM Tech serves open-weight language models from EU hardware:

- **OpenAI-Compatible API**: Drop-in integration with existing code
- **Streaming Support**: SSE streaming in OpenAI format
- **Prompt Caching**: Automatic, billed at a reduced cached-input rate
- **Zero Data Retention**: Prompts and completions are never written to disk, logs or analytics
- **EU Hosting**: All compute in the European Union, GDPR-ready with a signable DPA
- **Measured Performance**: Live latency and throughput published at [llmtech.eu/status](https://llmtech.eu/status)

Currently served model: `unsloth/Qwen3.8-27B-NVFP4` (262,144-token context). Model list and pricing: [llmtech.eu/models/qwen3.8-27b](https://llmtech.eu/models/qwen3.8-27b/).

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["LLMTECH_API_KEY"] = ""  # your LLM Tech API key
```

API keys are issued by email while the service is in early production — request one at [artem@llmtech.eu](mailto:artem@llmtech.eu).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="LLM Tech Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["LLMTECH_API_KEY"] = ""  # your LLM Tech API key

messages = [{"content": "What is the capital of France?", "role": "user"}]

response = completion(
    model="llmtech/unsloth/Qwen3.8-27B-NVFP4",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="LLM Tech Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["LLMTECH_API_KEY"] = ""  # your LLM Tech API key

messages = [{"content": "Write a short poem about AI", "role": "user"}]

response = completion(
    model="llmtech/unsloth/Qwen3.8-27B-NVFP4",
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
  - model_name: qwen3.8-27b
    litellm_params:
      model: llmtech/unsloth/Qwen3.8-27B-NVFP4
      api_key: os.environ/LLMTECH_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

```python showLineNumbers title="LLM Tech via Proxy - Python SDK"
import openai

client = openai.OpenAI(
    api_key="anything",  # proxy handles auth
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="qwen3.8-27b",
    messages=[{"role": "user", "content": "Hello"}]
)

print(response.choices[0].message.content)
```

## Reasoning Control

The served model supports adaptive reasoning. Control it via `chat_template_kwargs`:

```python showLineNumbers title="Disable or tune reasoning"
response = completion(
    model="llmtech/unsloth/Qwen3.8-27B-NVFP4",
    messages=[{"role": "user", "content": "2+2?"}],
    chat_template_kwargs={"enable_thinking": False},
)
```

Supported keys: `enable_thinking` (bool), `reasoning_effort` (`low` / `medium` / `xhigh`).
