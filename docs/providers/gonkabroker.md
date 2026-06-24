# Gonka Broker

LiteLLM supports chat completions through [Gonka Broker ↗](https://gonkabroker.com), an OpenAI-compatible gateway to open-source models running on the decentralized [Gonka ↗](https://gonka.ai) network. The always-current model catalog is published at [`GET /v1/models` ↗](https://proxy.gonkabroker.com/v1/models); reference any model as `gonkabroker/<model-id>`.

## Usage with LiteLLM Python SDK

```python
import os
from litellm import completion

os.environ["GONKABROKER_API_KEY"] = "your-gonkabroker-api-key"

messages = [{"role": "user", "content": "Write a short poem"}]
response = completion(model="gonkabroker/Qwen/Qwen3-235B-A22B-Instruct-2507-FP8", messages=messages)
print(response)
```

### Streaming

```python
import os
from litellm import completion

os.environ["GONKABROKER_API_KEY"] = "your-gonkabroker-api-key"

response = completion(
    model="gonkabroker/moonshotai/Kimi-K2.6",
    messages=[{"role": "user", "content": "Write a short poem"}],
    stream=True,
)
for chunk in response:
    print(chunk)
```

## Usage with LiteLLM Proxy

### 1. Set Gonka Broker models in config.yaml

```yaml
model_list:
  - model_name: gonkabroker-model
    litellm_params:
      model: gonkabroker/Qwen/Qwen3-235B-A22B-Instruct-2507-FP8
      api_key: "os.environ/GONKABROKER_API_KEY" # ensure you have `GONKABROKER_API_KEY` in your .env
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
    "model": "gonkabroker-model",
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

Gonka Broker serves open-source models on the Gonka network, and the live list changes over time. The authoritative, always-current catalog is the public [`GET /v1/models` ↗](https://proxy.gonkabroker.com/v1/models) endpoint. Reference any entry as `gonkabroker/<model-id>`, for example `gonkabroker/Qwen/Qwen3-235B-A22B-Instruct-2507-FP8`.

## Supported features

Gonka Broker is OpenAI-compatible and supports chat completions, streaming, and tool calling.
