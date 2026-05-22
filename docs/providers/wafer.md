import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Wafer AI

| Property | Details |
|----------|---------|
| Description | Wafer is an OpenAI-compatible inference gateway that serves frontier open models on dedicated GPU fleets and partner-routed serverless endpoints. |
| Provider Route on LiteLLM | `wafer/` |
| Provider Doc | [Wafer Documentation ↗](https://docs.wafer.ai/) |
| API Endpoint for Provider | `https://api.wafer.ai/v1` |
| Supported Endpoints | `/chat/completions`, `/completions`, `/embeddings`, `/models` |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["WAFER_API_KEY"] = ""  # your Wafer API key (get one at https://wafer.ai)
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Wafer Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["WAFER_API_KEY"] = ""  # your Wafer API key

response = completion(
    model="wafer/GLM-5.1",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)

print(response)
```

### Streaming

```python showLineNumbers title="Wafer Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["WAFER_API_KEY"] = ""  # your Wafer API key

response = completion(
    model="wafer/Kimi-K2.6",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Function Calling

All Wafer models support OpenAI-style tool/function calling.

```python showLineNumbers title="Wafer Tool Calling"
import os
from litellm import completion

os.environ["WAFER_API_KEY"] = ""

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }
]

response = completion(
    model="wafer/Qwen3.5-397B-A17B",
    messages=[{"role": "user", "content": "What's the weather in San Francisco?"}],
    tools=tools,
)

print(response)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: wafer-glm-5.1
    litellm_params:
      model: wafer/GLM-5.1
      api_key: os.environ/WAFER_API_KEY

  - model_name: wafer-kimi-k2.6
    litellm_params:
      model: wafer/Kimi-K2.6
      api_key: os.environ/WAFER_API_KEY
```

Start the LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml
```

### Making a request to the LiteLLM Proxy

<Tabs>
<TabItem value="curl" label="curl">

```bash showLineNumbers title="curl Request"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "wafer-glm-5.1",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>

<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    api_key="your-litellm-api-key",
    base_url="http://0.0.0.0:4000",
)

response = client.chat.completions.create(
    model="wafer-glm-5.1",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response)
```

</TabItem>

</Tabs>

## Supported Models

All Wafer models can be listed at `https://api.wafer.ai/v1/models` with a
valid `WAFER_API_KEY`. The current catalog:

| Model | Context Window | Tools | Vision | Reasoning |
|-------|---------------:|:-----:|:------:|:---------:|
| `wafer/GLM-5.1` | 128K | ✅ | — | — |
| `wafer/Qwen3.5-397B-A17B` | 128K | ✅ | ✅ | — |
| `wafer/Qwen3.6-35B-A3B` | 32K | ✅ | ✅ | — |
| `wafer/deepseek-v4-flash` | 128K | ✅ | — | ✅ |
| `wafer/deepseek-v4-pro` | 128K | ✅ | — | ✅ |
| `wafer/qwen3.6-max-preview` | 256K | ✅ | — | ✅ |
| `wafer/Kimi-K2.6` | 262K | ✅ | ✅ | — |

## Advanced - Custom Base URL

If you're running your own Wafer-compatible gateway (e.g. self-hosted
wafer-edge), point LiteLLM at it via `WAFER_API_BASE`:

```python showLineNumbers title="Custom Base URL"
import os
from litellm import completion

os.environ["WAFER_API_KEY"] = "your-key"
os.environ["WAFER_API_BASE"] = "https://your-wafer-gateway.example.com/v1"

response = completion(
    model="wafer/GLM-5.1",
    messages=[{"role": "user", "content": "Hello"}],
)
```
