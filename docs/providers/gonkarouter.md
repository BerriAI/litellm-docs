# GonkaRouter

LiteLLM supports chat completions through [GonkaRouter ↗](https://gonkarouter.io), an OpenAI-compatible AI model router that provides unified access to open-source models running on the decentralized [Gonka ↗](https://gonka.ai) network. The always-current model catalog is published at [`GET /v1/models` ↗](https://api.gonkarouter.io/v1/models); reference any model as `gonkarouter/<model-id>`.

## Usage with LiteLLM Python SDK

```python
import os
from litellm import completion

os.environ["GONKAROUTER_API_KEY"] = "your-gonkarouter-api-key"

messages = [{"role": "user", "content": "Write a short poem"}]
response = completion(model="gonkarouter/MiniMaxAI/MiniMax-M2.7", messages=messages)
print(response)
```

### Streaming

```python
import os
from litellm import completion

os.environ["GONKAROUTER_API_KEY"] = "your-gonkarouter-api-key"

response = completion(
    model="gonkarouter/moonshotai/Kimi-K2.6",
    messages=[{"role": "user", "content": "Write a short poem"}],
    stream=True,
)
for chunk in response:
    print(chunk)
```

## Usage with LiteLLM Proxy

### 1. Set GonkaRouter models in config.yaml

```yaml
model_list:
  - model_name: gonkarouter-model
    litellm_params:
      model: gonkarouter/MiniMaxAI/MiniMax-M2.7
      api_key: "os.environ/GONKAROUTER_API_KEY" # ensure you have `GONKAROUTER_API_KEY` in your .env
```

### 2. Start proxy

```bash
litellm --config config.yaml
```

### 3. Query proxy

Assuming the proxy is running on [http://localhost:4000](http://localhost:4000):

```bash
curl http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LITELLM_MASTER_KEY" \
  -d '{
    "model": "gonkarouter-model",
    "messages": [
      {
        "role": "system",
        "content": "You are a helpful assistant."
      },
      {
        "role": "user",
        "content": "Write a short poem"
      }
    ]
  }'
```

`-H "Authorization: Bearer YOUR_LITELLM_MASTER_KEY"` is only required if you have set a LiteLLM master key

## Supported models

GonkaRouter serves open-source models on the Gonka network, and the live list changes over time. The authoritative, always-current catalog is the public [`GET /v1/models` ↗](https://api.gonkarouter.io/v1/models) endpoint. Reference any entry as `gonkarouter/<model-id>`, for example `gonkarouter/MiniMaxAI/MiniMax-M2.7`.

## Supported features

GonkaRouter is OpenAI-compatible and supports chat completions, streaming, and tool calling.
