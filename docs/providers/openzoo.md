import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenZoo

## Overview

| Property | Details |
|-------|-------|
| Description | OpenZoo is a pay-per-call AI gateway. The default target is the local `npx openzoo` proxy, which is OpenAI-compatible and pays each call over x402 from a local burner wallet. No account. The proxy ignores the API key, so any non-empty value works. |
| Provider Route on LiteLLM | `openzoo/` |
| Link to Provider Doc | [OpenZoo Documentation ↗](https://openzoo.fun) |
| Base URL | `http://localhost:8402/v1` (the local `npx openzoo` proxy; override with `OPENZOO_API_BASE`) |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

**We support ALL OpenZoo chat models, just set `openzoo/` as a prefix when sending completion requests**

The live model catalog, including current per-token pricing, is served at `GET /v1/models` on both the local proxy and the hosted `https://api.openzoo.fun/v1/models` (free, no key).

## Available Models

| Model | Description | Context Window | Max Output |
|-------|-------------|----------------|------------|
| `openzoo/z-ai/glm-5.3-flash` | Z.ai GLM-5.3 Flash, a fast agentic coding model | 1,310,720 tokens | 131,072 tokens |
| `openzoo/qwen/qwen3.7-flash` | Alibaba Qwen3.7 Flash, a low-cost general model | 1,000,000 tokens | 65,536 tokens |
| `openzoo/nvidia/nemotron-3.5-lightning` | NVIDIA Nemotron 3.5 Lightning, a compact reasoning model | 262,144 tokens | 131,072 tokens |

All three models support reasoning and function calling.

## Required Variables

Start the local proxy first. It listens on `http://localhost:8402/v1` and pays each call over x402 from a local burner wallet, so there is no account and no key to fetch.

```shell showLineNumbers title="Start the OpenZoo proxy"
npx openzoo
```

The proxy ignores the API key, but LiteLLM still needs a value, so set any non-empty string.

```python showLineNumbers title="Environment Variables"
os.environ["OPENZOO_API_KEY"] = "sk-openzoo"  # any value works with the local proxy
```

If LiteLLM runs in Docker, point `OPENZOO_API_BASE` at `http://host.docker.internal:8402/v1`.

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="OpenZoo Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["OPENZOO_API_KEY"] = "sk-openzoo"  # any value works with the local proxy

messages = [{"content": "Hello, how are you?", "role": "user"}]

# OpenZoo call
response = completion(
    model="openzoo/z-ai/glm-5.3-flash",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="OpenZoo Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["OPENZOO_API_KEY"] = "sk-openzoo"  # any value works with the local proxy

messages = [{"content": "Write a short story about AI", "role": "user"}]

# OpenZoo call with streaming
response = completion(
    model="openzoo/z-ai/glm-5.3-flash",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="OpenZoo Function Calling"
import os
import litellm
from litellm import completion

os.environ["OPENZOO_API_KEY"] = "sk-openzoo"  # any value works with the local proxy

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
                    "description": "The city, e.g. Toronto"
                }
            },
            "required": ["city"]
        }
    }
}]

messages = [{"role": "user", "content": "What's the weather in Toronto?"}]

response = completion(
    model="openzoo/z-ai/glm-5.3-flash",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: glm-5.3-flash
    litellm_params:
      model: openzoo/z-ai/glm-5.3-flash
      api_key: os.environ/OPENZOO_API_KEY
  - model_name: qwen3.7-flash
    litellm_params:
      model: openzoo/qwen/qwen3.7-flash
      api_key: os.environ/OPENZOO_API_KEY
```

## Hosted Endpoint and Custom API Base

The hosted gateway at `https://api.openzoo.fun/v1` answers `POST /v1/chat/completions` with `402 Payment Required` unless the caller pays over x402 or presents an OpenZoo subscription key of the form `ozk_live_...`. LiteLLM cannot pay x402 itself, so use the hosted endpoint only with a subscription key. Any other compatible base URL is set the same way.

**Option 1: Environment variables**

```python showLineNumbers title="Hosted endpoint via env vars"
import os
from litellm import completion

os.environ["OPENZOO_API_BASE"] = "https://api.openzoo.fun/v1"
os.environ["OPENZOO_API_KEY"] = "ozk_live_..."  # subscription key required on the hosted endpoint

response = completion(
    model="openzoo/z-ai/glm-5.3-flash",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Hosted endpoint via parameters"
from litellm import completion

response = completion(
    model="openzoo/z-ai/glm-5.3-flash",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://api.openzoo.fun/v1",
    api_key="ozk_live_...",
)
```

## Supported OpenAI Parameters

- `temperature`
- `max_tokens`
- `max_completion_tokens`
- `top_p`
- `frequency_penalty`
- `presence_penalty`
- `stop`
- `n`
- `stream`
- `stream_options`
- `tools`
- `tool_choice`
- `response_format`
- `seed`
- `logit_bias`
- `logprobs`
- `top_logprobs`

`max_completion_tokens` is sent upstream as `max_tokens`.
