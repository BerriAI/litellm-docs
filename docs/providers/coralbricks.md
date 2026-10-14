import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# CoralBricks

## Overview

| Property | Details |
|-------|-------|
| Description | CoralBricks serves open-weight GLM and DeepSeek models in FP4 over an OpenAI-compatible API |
| Provider Route on LiteLLM | `coralbricks/` |
| Link to Provider Doc | [CoralBricks](https://www.coralbricks.ai) |
| Default Base URL | `https://inference.coralbricks.ai/v1` |
| Supported Operations | `/chat/completions`, `/responses`, `/messages` |

CoralBricks is its own provider on LiteLLM rather than a generic OpenAI-compatible route, so its spend is priced from the CoralBricks cost map entries and reported under `coralbricks` instead of being pooled with OpenAI traffic. `/responses` and `/messages` requests are forwarded to the matching CoralBricks endpoints as they arrive, with no translation through chat completions

## API Key

```python showLineNumbers title="Environment Variables"
import os

os.environ["CORALBRICKS_API_KEY"] = "your-api-key"
os.environ["CORALBRICKS_API_BASE"] = "https://inference.coralbricks.ai/v1"  # optional override
```

## Models

| Model | Input / 1M tokens | Output / 1M tokens | Cache write / 1M tokens | Cache read / 1M tokens |
|-------|-------------------|--------------------|-------------------------|------------------------|
| `coralbricks/glm-5.3-fast` | $1.12 | $4.40 | $1.68 | $0 |
| `coralbricks/deepseek-v4.1-flash-fast` | $0.01 | $1.20 | $0.09 | $0 |

Every model takes up to 1,048,576 input tokens and supports tool calling, reasoning, and prompt caching. Pricing follows the [CoralBricks pricing page](https://www.coralbricks.ai/pricing): cache writes are billed at the cache write rate and cached reads are free. If your contract prices differ, set `input_cost_per_token` / `output_cost_per_token` on the deployment and those override the cost map

CoralBricks still accepts the older `glm-5.3-fp4` and `deepseek-v4.1-flash-fast-fp4` names as deprecated aliases, but LiteLLM prices only the current names above, so use those in new deployments

## Usage - LiteLLM Python SDK

### Chat Completions

```python showLineNumbers title="CoralBricks Chat Completion"
import os
from litellm import completion

os.environ["CORALBRICKS_API_KEY"] = "your-api-key"

response = completion(
    model="coralbricks/deepseek-v4.1-flash-fast",
    messages=[{"role": "user", "content": "Write a python function that reverses a string"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="CoralBricks Streaming Chat Completion"
import os
from litellm import completion

os.environ["CORALBRICKS_API_KEY"] = "your-api-key"

response = completion(
    model="coralbricks/deepseek-v4.1-flash-fast",
    messages=[{"role": "user", "content": "Explain a binary search in two sentences"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Responses API

```python showLineNumbers title="CoralBricks Responses API"
import os
import litellm

os.environ["CORALBRICKS_API_KEY"] = "your-api-key"

response = litellm.responses(
    model="coralbricks/deepseek-v4.1-flash-fast",
    input="Explain a binary search in two sentences",
    max_output_tokens=256,
)

print(response.output_text)
```

## Usage - LiteLLM Proxy

Add CoralBricks to your LiteLLM Proxy configuration:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4.1-flash
    litellm_params:
      model: coralbricks/deepseek-v4.1-flash-fast
      api_key: os.environ/CORALBRICKS_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export CORALBRICKS_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-coralbricks"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="CoralBricks via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-coralbricks",
)

response = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="CoralBricks via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "deepseek-v4.1-flash",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
</Tabs>

You can also add CoralBricks from the Admin UI. Go to Models, then Add Model, pick CoralBricks as the provider, choose one of the `coralbricks/` models, and paste your key

## Responses API

The proxy forwards `/v1/responses` requests to the CoralBricks Responses endpoint:

```bash showLineNumbers title="Responses API through LiteLLM Proxy"
curl http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "deepseek-v4.1-flash",
    "input": "hello from litellm",
    "max_output_tokens": 128
  }'
```

## Anthropic Messages Compatibility

The proxy forwards `/v1/messages` requests to the CoralBricks Messages endpoint, so Anthropic SDK clients work unchanged:

```bash showLineNumbers title="Anthropic Messages through LiteLLM Proxy"
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "deepseek-v4.1-flash",
    "max_tokens": 128,
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

## Cost Tracking

The `coralbricks/` models are registered in LiteLLM's model cost map, so per-request spend is computed automatically on all three endpoints, returned in the `x-litellm-response-cost` response header, and recorded in spend logs under provider `coralbricks`. Cache writes and cached reads are tracked from the usage CoralBricks returns, so a repeated prompt is billed at the free cached read rate for its cached prefix

## Custom Endpoints

Set `CORALBRICKS_API_BASE` or pass `api_base` explicitly to route through a different CoralBricks endpoint. The `coralbricks/` route keeps the provider identity and pricing either way

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4.1-flash
    litellm_params:
      model: coralbricks/deepseek-v4.1-flash-fast
      api_base: https://your-coralbricks-endpoint/v1
      api_key: os.environ/CORALBRICKS_API_KEY
```
