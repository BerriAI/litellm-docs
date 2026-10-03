import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# FutureInfra

## Overview

| Property | Details |
|-------|-------|
| Description | FutureInfra is a Korean cloud provider whose AI router serves 300+ models from multiple vendors behind one OpenAI-compatible API, billed per call from a prepaid wallet. |
| Provider Route on LiteLLM | `futureinfra/` |
| Link to Provider Doc | [FutureInfra Documentation](https://futureinfra.ai/docs/) |
| Base URL | `https://futureinfra.ai/v1/ai` |
| Supported Operations | `/chat/completions` |

<br />

**We support ALL FutureInfra models, just set `futureinfra/` as a prefix when sending requests**

## Models

FutureInfra model ids use a `vendor/model` format, for example `openai/gpt-4o-mini` or `anthropic/claude-sonnet-4`. Add the `futureinfra/` prefix in front of the id, so `openai/gpt-4o-mini` becomes `futureinfra/openai/gpt-4o-mini`. The full catalog is at `GET https://futureinfra.ai/v1/ai/models`.

## API Key

Create a key in the [FutureInfra console](https://futureinfra.ai/console/?screen=ai-router) under AI Router. Keys start with `pk_live_`.

```python showLineNumbers title="Environment Variables"
import os

os.environ["FUTUREINFRA_API_KEY"] = "pk_live_..."
os.environ["FUTUREINFRA_API_BASE"] = "https://futureinfra.ai/v1/ai"  # optional override
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="FutureInfra Chat Completion"
import os
from litellm import completion

os.environ["FUTUREINFRA_API_KEY"] = "pk_live_..."

response = completion(
    model="futureinfra/openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="FutureInfra Streaming Chat Completion"
import os
from litellm import completion

os.environ["FUTUREINFRA_API_KEY"] = "pk_live_..."

response = completion(
    model="futureinfra/openai/gpt-4o-mini",
    messages=[{"role": "user", "content": "Write a short poem about the sea"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy

Add FutureInfra models to your LiteLLM Proxy configuration:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: futureinfra/openai/gpt-4o-mini
      api_key: os.environ/FUTUREINFRA_API_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="FutureInfra via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-1234",  # your LiteLLM proxy key
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash showLineNumbers title="FutureInfra via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
</Tabs>

## Pricing

FutureInfra bills each call from a prepaid wallet in the FutureInfra console. LiteLLM does not ship a cost map for FutureInfra models; to track spend on the proxy, set `input_cost_per_token` and `output_cost_per_token` in `litellm_params`.
