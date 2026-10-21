import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Baseten

LiteLLM supports both Baseten Model APIs and dedicated deployments with automatic routing.

## API Types

### Model API (Default)
- **URL**: `https://inference.baseten.co/v1`
- **Format**: `baseten/<model-name>` (e.g., `baseten/openai/gpt-oss-120b`)
- **Best for**: Quick access to popular models

### Dedicated Deployments
- **URL**: `https://model-{id}.api.baseten.co/environments/production/sync/v1`
- **Format**: `baseten/{8-digit-alphanumeric-code}` (e.g., `baseten/abcd1234`)
- **Best for**: Custom models, latency SLAs

:::tip
**Automatic Routing**: LiteLLM detects the type based on model format:
- 8-digit alphanumeric codes → Dedicated deployment
- All other formats → Model API
:::


## Quick Start

```python
import os
from litellm import completion

os.environ['BASETEN_API_KEY'] = "your-api-key"

# Model API (default)
response = completion(
    model="baseten/openai/gpt-oss-120b",
    messages=[{"role": "user", "content": "Hello!"}]
)

# Dedicated deployment (8-digit ID)
response = completion(
    model="baseten/abcd1234",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Examples

### Basic Usage
```python
# Model API
response = completion(
    model="baseten/openai/gpt-oss-120b",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    max_tokens=500,
    temperature=0.7
)

# Dedicated deployment
response = completion(
    model="baseten/abcd1234",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    max_tokens=500,
    temperature=0.7
)
```

### Streaming (Model API only)
```python
response = completion(
    model="baseten/openai/gpt-oss-120b",
    messages=[{"role": "user", "content": "Write a poem"}],
    stream=True,
    stream_options={"include_usage": True}
)

for chunk in response:
    if chunk.choices and chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

## Usage with LiteLLM Proxy

1. **Config**:
```yaml
model_list:
  - model_name: baseten-model
    litellm_params:
      model: baseten/openai/gpt-oss-120b
      api_key: your-baseten-api-key
```

2. **Request**:
```python
import openai
client = openai.OpenAI(
    api_key="sk-<your-litellm-api-key>",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="baseten-model",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Responses API (`/v1/responses`)

Baseten's Model API serves `/v1/responses` itself. The `baseten/` provider has no Responses API config of its own, so by default LiteLLM bridges a `/v1/responses` request through `/v1/chat/completions`. To forward it untranslated, add `/v1/responses` to `model_info.supported_endpoints` on the deployment. The deployment keeps the Baseten API base, `BASETEN_API_KEY` and the cost map prices for the model, so this is the way to get native Responses without switching the deployment to `custom_llm_provider: openai`. Available from v1.101.0

```yaml
model_list:
  - model_name: glm-5.2
    litellm_params:
      model: baseten/zai-org/GLM-5.2
      api_key: os.environ/BASETEN_API_KEY
    model_info:
      supported_endpoints: ["/v1/chat/completions", "/v1/responses"]
```

```bash
curl http://0.0.0.0:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "content-type: application/json" \
  -d '{"model": "glm-5.2", "input": "Say hi in three words"}'
```

Model names on the Model API are case sensitive (`zai-org/GLM-5.2`, not `zai-org/glm-5.2`). See [Native /v1/messages and /v1/responses passthrough](../anthropic_unified/native_passthrough.md) for the `/v1/messages` opt-in and the full behavior table.
