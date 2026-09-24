# Bitdeer AI

## Overview

| Property | Details |
|-------|-------|
| Description | Bitdeer AI provides serverless inference through an OpenAI-compatible API. |
| Provider Route on LiteLLM | `openai/` |
| Link to Provider Docs | [Bitdeer AI LiteLLM Integration](https://developers.bitdeer.ai/docs/guides/integrations/litellm) |
| Base URL | `https://api-inference.bitdeer.ai/v1` |
| Supported Operations | Chat completions, streaming, tool calling, and multimodal input on supported models |

## API Key

Create an API key in the [Bitdeer AI Console](https://www.bitdeer.ai/model/apikeys), then set it as an environment variable:

```bash
export BITDEER_API_KEY="your-api-key"
```

## Models

Use a model ID from the [Bitdeer AI Model Catalog](https://developers.bitdeer.ai/docs/api/models-catalog). The examples below use `deepseek-ai/DeepSeek-V4-Pro`. Other model IDs include `Qwen/Qwen3.5-397B-A17B` and `moonshotai/Kimi-K2.6`.

Prefix the Bitdeer model ID with `openai/` so LiteLLM routes the request through its OpenAI-compatible adapter.

## Usage with LiteLLM Python SDK

```python showLineNumbers title="Bitdeer Chat Completion"
import os
from litellm import completion

response = completion(
    model="openai/deepseek-ai/DeepSeek-V4-Pro",
    api_base="https://api-inference.bitdeer.ai/v1",
    api_key=os.environ["BITDEER_API_KEY"],
    messages=[{"role": "user", "content": "Explain serverless inference in one sentence."}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Bitdeer Streaming Completion"
import os
from litellm import completion

response = completion(
    model="openai/deepseek-ai/DeepSeek-V4-Pro",
    api_base="https://api-inference.bitdeer.ai/v1",
    api_key=os.environ["BITDEER_API_KEY"],
    messages=[{"role": "user", "content": "Write a short poem about inference."}],
    stream=True,
)

for chunk in response:
    content = chunk.choices[0].delta.content
    if content:
        print(content, end="", flush=True)
```

## Usage with LiteLLM Proxy

Add Bitdeer AI to your LiteLLM Proxy configuration:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: bitdeer-deepseek
    litellm_params:
      model: openai/deepseek-ai/DeepSeek-V4-Pro
      api_base: https://api-inference.bitdeer.ai/v1
      api_key: os.environ/BITDEER_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash
litellm --config config.yaml --port 4000
```

Call the configured model through the proxy:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bitdeer-deepseek",
    "messages": [{"role": "user", "content": "Hello from LiteLLM"}]
  }'
```
