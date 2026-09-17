import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# sference

| Property | Details |
|-------|-------|
| Description | sference provides managed European inference for open-weight models behind an OpenAI-compatible API, with realtime, flex, and async processing modes. |
| Provider Route on LiteLLM | `sference/` |
| Supported Endpoints | `/chat/completions`, `/v1/messages` |
| API Reference | [sference API Reference ↗](https://sference.com/docs) |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["SFERENCE_API_KEY"] = ""  # your sference API key
```

Requests go to `https://api.sference.com/v1` by default. Set `SFERENCE_API_BASE` to override the API base.

## Supported Models

:::info
We actively maintain the list of models, pricing, token window, etc. [here](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json).
:::

| Model ID | Input context length | Input Modalities | Output Modalities |
| --- | --- | --- | --- |
| `moonshotai/Kimi-K3` | 1M | Text | Text |
| `zai-org/GLM-5.3` | 1M | Text | Text |
| `zai-org/GLM-5.2` | 1M | Text | Text |
| `zai-org/GLM-5.3-Flash` | 1M | Text, Image | Text |
| `deepseek-ai/DeepSeek-V4.1-Flash` | 1M | Text, Image | Text |
| `deepseek-ai/DeepSeek-V4-Flash` | 1M | Text | Text |
| `deepseek-ai/DeepSeek-V4-Flash-0731` | 1M | Text | Text |

All models support function calling, prompt caching, and reasoning. Reasoning controls vary by model family: DeepSeek and Kimi models accept `enable_thinking` plus named `reasoning_effort` levels, while the GLM-5.3 family (GLM-5.3, GLM-5.3-Flash, and the GLM-5.2 alias) always reasons and rejects thinking-off requests with a 400. See the [sference docs](https://sference.com/docs/models) for the per-model control surface.

Custom (BYOM) models deployed on sference also work: tool calling is assumed for any `sference/` model that is not in the catalog above.

The API also natively exposes the Anthropic Messages format, so LiteLLM forwards `/v1/messages` requests to `https://api.sference.com/v1/messages` untranslated, preserving Anthropic-only features like thinking blocks.

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="sference Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["SFERENCE_API_KEY"] = ""  # your sference API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(model="sference/deepseek-ai/DeepSeek-V4-Flash", messages=messages)
```

### Streaming

```python showLineNumbers title="sference Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["SFERENCE_API_KEY"] = ""  # your sference API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="sference/deepseek-ai/DeepSeek-V4-Flash",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Reasoning Effort

DeepSeek and Kimi models accept named `reasoning_effort` levels (`low`, `high`, `xhigh`); DeepSeek-V4.1-Flash additionally accepts an integer budget in [1, 100]. The GLM-5.3 family always reasons — it takes no effort control and rejects thinking-off requests with a 400.

```python showLineNumbers title="sference Reasoning Effort"
import os
import litellm
from litellm import completion

os.environ["SFERENCE_API_KEY"] = ""  # your sference API key

messages = [{"content": "What is 15% of 2840?", "role": "user"}]

response = completion(
    model="sference/deepseek-ai/DeepSeek-V4.1-Flash",
    messages=messages,
    reasoning_effort="high"
)

print(response.choices[0].message.content)
```

### Flex Processing

Pass `service_tier="flex"` for discounted, lower-priority processing.

```python showLineNumbers title="sference Flex Processing"
import os
import litellm
from litellm import completion

os.environ["SFERENCE_API_KEY"] = ""  # your sference API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="sference/deepseek-ai/DeepSeek-V4-Flash",
    messages=messages,
    service_tier="flex"
)
```

## Usage - LiteLLM Proxy

Add sference models to your proxy config.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: sference-flash
    litellm_params:
      model: sference/deepseek-ai/DeepSeek-V4-Flash
      api_key: os.environ/SFERENCE_API_KEY
```

```bash showLineNumbers title="Start the proxy"
litellm --config config.yaml
```

### Chat Completions

```bash showLineNumbers title="POST /v1/chat/completions"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{"model": "sference-flash", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Anthropic Messages

```bash showLineNumbers title="POST /v1/messages"
curl http://localhost:4000/v1/messages \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model": "sference-flash", "max_tokens": 100, "messages": [{"role": "user", "content": "Hello"}]}'
```
