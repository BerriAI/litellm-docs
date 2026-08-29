# AI Power Grid

## Overview

| Property | Details |
|---|---|
| Description | Open-model inference routed across independently operated workers |
| Provider route on LiteLLM | `aipg/` |
| Provider documentation | [AI Power Grid API documentation](https://docs.aipowergrid.io/streaming-api) |
| API console | [AI Power Grid console](https://console.aipowergrid.io/dashboard/api-key) |
| Base URL | `https://api.aipowergrid.io/v1` |
| Supported operations | `/chat/completions`, `/responses` |

The LiteLLM provider covers AI Power Grid's text APIs. Image, video, and audio generation use separate Grid API contracts and are not exposed through this LiteLLM provider.

## Authentication

Create a user API key in the [AI Power Grid console](https://console.aipowergrid.io/dashboard/api-key). User API keys are scoped to `account.read` and `inference.submit`. Keep the key on the server; do not embed it in browser or mobile application bundles.

```bash title="Environment variables"
export AIPG_API_KEY="grid_..."
```

LiteLLM uses `https://api.aipowergrid.io/v1` by default. Self-hosted Grid operators can override it with `AIPG_API_BASE`.

## Available Models

The public catalog can change as workers join and leave. Query the canonical catalog before selecting a model:

```bash title="List public text models"
curl https://api.aipowergrid.io/v1/models
```

The following models were listed on August 28, 2026:

| LiteLLM model | Context window | Input price | Output price |
|---|---:|---:|---:|
| `aipg/gpt-oss-120b` | 60,000 | $0.075 / 1M tokens | $0.30 / 1M tokens |
| `aipg/deepseek-v4-flash-nvfp4` | 262,144 | $0.07 / 1M tokens | $0.14 / 1M tokens |
| `aipg/Smollm-135m` | 2,048 | $0.005 / 1M tokens | $0.01 / 1M tokens |

`aipg/auto` asks the Grid to select an available text model. LiteLLM cannot attach stable model-specific pricing metadata to `auto`, so use an explicit model when exact pre-request cost calculation matters.

## Chat Completions

### Non-streaming

```python showLineNumbers title="AI Power Grid completion"
import os

from litellm import completion

os.environ["AIPG_API_KEY"] = "grid_..."

response = completion(
    model="aipg/gpt-oss-120b",
    messages=[{"role": "user", "content": "Explain proof of stake briefly."}],
    max_tokens=200,
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="AI Power Grid streaming completion"
import os

from litellm import completion

os.environ["AIPG_API_KEY"] = "grid_..."

stream = completion(
    model="aipg/gpt-oss-120b",
    messages=[{"role": "user", "content": "Write a four-line poem."}],
    stream=True,
)

for chunk in stream:
    content = chunk.choices[0].delta.content
    if content:
        print(content, end="", flush=True)
```

## Responses API

```python showLineNumbers title="AI Power Grid Responses API"
import os

import litellm

os.environ["AIPG_API_KEY"] = "grid_..."

response = litellm.responses(
    model="aipg/gpt-oss-120b",
    input="Give me three names for a developer tool.",
    max_output_tokens=100,
)

print(response)
```

## LiteLLM Proxy

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: aipg-gpt-oss
    litellm_params:
      model: aipg/gpt-oss-120b
      api_key: os.environ/AIPG_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy and call it with the public alias:

```bash title="Start LiteLLM Proxy"
litellm --config config.yaml
```

```bash title="Call AI Power Grid through LiteLLM Proxy"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "aipg-gpt-oss",
    "messages": [{"role": "user", "content": "Say hello in one sentence."}],
    "stream": true
  }'
```

## Error Handling

Grid authentication, insufficient-credit, rate-limit, and request errors are mapped to LiteLLM's standard exceptions.

```python showLineNumbers title="Handle AI Power Grid errors"
import litellm
from litellm import completion

try:
    response = completion(
        model="aipg/gpt-oss-120b",
        messages=[{"role": "user", "content": "Hello"}],
    )
except litellm.AuthenticationError:
    print("Check AIPG_API_KEY and its scopes.")
except litellm.RateLimitError:
    print("Retry with backoff.")
except litellm.BadRequestError as exc:
    print(f"The Grid rejected the request: {exc}")
```

An HTTP `402` means the Grid account lacks enough usable credit for the request. Fund the same account in the [AI Power Grid console](https://console.aipowergrid.io/dashboard/funding), then retry with the same account's API key.

## Privacy and Availability

AI Power Grid routes requests to remote community-operated workers. Workers may be able to inspect plaintext prompts and outputs. Do not send secrets, personal data, regulated data, or confidential source code unless your deployment has separately verified confidential-compute guarantees.

Model availability depends on connected workers. Applications should handle temporary unavailability and retry only idempotent requests with bounded backoff. The provider is maintained by the AI Power Grid project and does not imply a partnership with LiteLLM.
