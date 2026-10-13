# Vynaris

## Overview

| Property | Details |
|-------|-------|
| Description | Vynaris hosts powerful uncensored models for authorized security testing, red-teaming, and research (Qwen3.8-27B, DeepSeek-V4-Flash, Qwen3.6-35B-A3B), plus a routed model catalog, over an OpenAI-compatible Chat Completions API. |
| Provider Route on LiteLLM | `vynaris/` |
| Link to Provider Doc | [Vynaris Documentation ↗](https://vynaris.com/docs) |
| Base URL | `https://api.vynaris.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

**We support ALL Vynaris models, just set `vynaris/` as a prefix when sending requests**

## Available Models

Use `vynaris/auto` to let Vynaris route each request, or address a hosted model directly with its Vynaris model ID after the prefix, for example `vynaris/vynaris/qwen3.6-35b-a3b-uncensored`. See the [Vynaris model list](https://vynaris.com/models) and [pricing](https://vynaris.com/pricing) for current IDs and per-token rates. For spend tracking, pass `input_cost_per_token` and `output_cost_per_token` in `litellm_params`.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["VYNARIS_API_KEY"] = ""  # your Vynaris API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Vynaris Non-streaming Completion"
import os
from litellm import completion

os.environ["VYNARIS_API_KEY"] = ""  # your Vynaris API key

response = completion(
    model="vynaris/auto",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)

print(response)
```

### Streaming

```python showLineNumbers title="Vynaris Streaming Completion"
import os
from litellm import completion

os.environ["VYNARIS_API_KEY"] = ""  # your Vynaris API key

response = completion(
    model="vynaris/auto",
    messages=[{"content": "Write a short story about AI", "role": "user"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: vynaris-auto
    litellm_params:
      model: vynaris/auto
      api_key: os.environ/VYNARIS_API_KEY
```

```bash
litellm --config config.yaml
```
