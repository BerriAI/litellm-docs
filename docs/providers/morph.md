import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Morph

Morph serves open weight models and code editing models through an OpenAI compatible API. Use the `morph/` prefix in LiteLLM requests

| Property | Details |
| --- | --- |
| Provider route on LiteLLM | `morph/` |
| API base | `https://api.morphllm.com/v1` |
| API key | `MORPH_API_KEY` |
| Supported LiteLLM endpoint | `/chat/completions` |
| Morph docs | [Open source models](https://docs.morphllm.com/sdk/components/fast-models) |
| Dedicated capacity | [Dedicated inference](https://www.morphllm.com/dedicated-inference) |

## API key

```bash
export MORPH_API_KEY="your-api-key"
```

## Supported models

The current serverless models are listed below. Morph publishes the live catalog, context windows, and prices at [`/api/models/json`](https://www.morphllm.com/api/models/json)

| Model | LiteLLM model | Context | Input types |
| --- | --- | --- | --- |
| Kimi K3 | `morph/morph-kimik3` | 1M | Text, image |
| Kimi K3 Fast | `morph/morph-kimik3-fast` | 1M | Text, image |
| GLM 5.3 | `morph/morph-glm53-744b` | 1M | Text |
| GLM 5.3 Flash | `morph/morph-glm53flash` | 1M | Text, image, video |
| DeepSeek V4 Flash 0731 | `morph/morph-dsv4flash` | 1M | Text |
| Morph v3 Fast Apply | `morph/morph-v3-fast` | 262K | Text |
| Morph v3 Large Apply | `morph/morph-v3-large` | 262K | Text |

## Python SDK

```python
import os

from litellm import completion

os.environ["MORPH_API_KEY"] = "your-api-key"

response = completion(
    model="morph/morph-glm53-744b",
    messages=[{"role": "user", "content": "Explain prefix caching in two sentences."}],
)

print(response.choices[0].message.content)
```

### Streaming

```python
from litellm import completion

response = completion(
    model="morph/morph-glm53-744b",
    messages=[{"role": "user", "content": "Write a small Python rate limiter."}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## LiteLLM Proxy

Add Morph models to `config.yaml`:

```yaml
model_list:
  - model_name: morph-glm
    litellm_params:
      model: morph/morph-glm53-744b
      api_key: os.environ/MORPH_API_KEY

  - model_name: morph-kimi
    litellm_params:
      model: morph/morph-kimik3
      api_key: os.environ/MORPH_API_KEY
```

Start the proxy:

```bash
litellm --config config.yaml
```

Call it with any OpenAI compatible client:

<Tabs>
<TabItem value="python" label="OpenAI Python">

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-litellm-key",
    base_url="http://localhost:4000",
)

response = client.chat.completions.create(
    model="morph-glm",
    messages=[{"role": "user", "content": "Hello from LiteLLM"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash
curl http://localhost:4000/chat/completions \
  -H "Authorization: Bearer your-litellm-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "morph-glm",
    "messages": [{"role": "user", "content": "Hello from LiteLLM"}]
  }'
```

</TabItem>
</Tabs>

## Dedicated inference endpoints

Morph also offers reserved capacity behind an isolated OpenAI compatible endpoint. Set `api_base` to the URL returned when the endpoint is provisioned and keep the `morph/` provider prefix:

```yaml
model_list:
  - model_name: dedicated-deepseek
    litellm_params:
      model: morph/your-dedicated-model
      api_base: https://your-endpoint.morphllm.com/v1
      api_key: os.environ/MORPH_API_KEY
```

See [Morph dedicated inference](https://www.morphllm.com/dedicated-inference) for available models, capacity planning, and deployment through the Morph CLI

## Custom API base

Set `MORPH_API_BASE` for all Morph requests, or pass `api_base` on one request:

```python
from litellm import completion

response = completion(
    model="morph/morph-glm53-744b",
    messages=[{"role": "user", "content": "Hello"}],
    api_base="https://api.morphllm.com/v1",
)
```
