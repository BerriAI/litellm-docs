# SinoGate

## Overview

| Property | Details |
|-------|-------|
| Description | SinoGate is a hosted, OpenAI-compatible gateway to Chinese model families (DeepSeek, Qwen, GLM, Kimi, MiniMax), with automatic failover across upstreams and USD billing. |
| Provider Route on LiteLLM | `openai/` (OpenAI-compatible, with `api_base`) |
| Link to Provider Doc | [SinoGate ↗](https://sinogate.ai/) |
| Base URL | `https://api.sinogate.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

SinoGate uses the OpenAI Chat Completions API, so LiteLLM calls it through the [OpenAI-compatible route](./openai_compatible): add the `openai/` prefix to a SinoGate model id and set `api_base` to `https://api.sinogate.ai/v1`.

## Available Models

Example model ids (see the public [`/v1/models`](https://api.sinogate.ai/v1/models) endpoint or the [SinoGate model catalog](https://sinogate.ai/models) for the current list):

| Model | Mode |
|-------|------|
| `openai/deepseek-v4-pro` | chat |
| `openai/qwen3.7-max` | chat |
| `openai/glm-5.3` | chat |
| `openai/kimi-k3` | chat |
| `openai/MiniMax-M2.5` | chat |

LiteLLM has no prices for these models, so it records their spend as $0 unless you set a price yourself through `model_info` on the proxy.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["SINOGATE_API_KEY"] = ""  # your SinoGate API key
```

Create an API key at [sinogate.ai](https://sinogate.ai/).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="SinoGate Non-streaming Completion"
import os
from litellm import completion

response = completion(
    model="openai/deepseek-v4-pro",
    api_base="https://api.sinogate.ai/v1",
    api_key=os.environ["SINOGATE_API_KEY"],
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)

print(response)
```

### Streaming

```python showLineNumbers title="SinoGate Streaming Completion"
import os
from litellm import completion

response = completion(
    model="openai/qwen3.7-max",
    api_base="https://api.sinogate.ai/v1",
    api_key=os.environ["SINOGATE_API_KEY"],
    messages=[{"content": "Hello, how are you?", "role": "user"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: sinogate-deepseek
    litellm_params:
      model: openai/deepseek-v4-pro
      api_base: https://api.sinogate.ai/v1
      api_key: os.environ/SINOGATE_API_KEY

  - model_name: sinogate-kimi
    litellm_params:
      model: openai/kimi-k3
      api_base: https://api.sinogate.ai/v1
      api_key: os.environ/SINOGATE_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

Then call the proxy:

```bash showLineNumbers title="SinoGate via Proxy - Chat Completions"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "sinogate-deepseek",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```
