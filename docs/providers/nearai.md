import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# NEAR AI Cloud

## Overview

| Property | Details |
|-------|-------|
| Description | NEAR AI Cloud serves open-weight and frontier models over one OpenAI-compatible API. Its hosted open-weight models run inside GPU trusted execution environments. |
| Provider Route on LiteLLM | `nearai/` |
| Link to Provider Doc | [NEAR AI Cloud docs ↗](https://docs.near.ai/cloud/) |
| Base URL | `https://cloud-api.near.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/embeddings`](#embeddings), [`/responses`](#responses-api), [`/messages`](#usage---litellm-proxy-server) |

<br />
<br />

**We support ALL NEAR AI Cloud models, just set `nearai/` as a prefix when sending requests**

Model ids use NEAR AI's own names, for example `nearai/z-ai/glm-5.3-flash` or `nearai/Qwen/Qwen3-Embedding-0.6B`. Call `GET https://cloud-api.near.ai/v1/models` with your key to list the models available to you.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["NEARAI_API_KEY"] = ""  # your NEAR AI Cloud API key
os.environ["NEARAI_API_BASE"] = ""  # optional, defaults to https://cloud-api.near.ai/v1
```

Create a key in the [NEAR AI Cloud console](https://cloud.near.ai).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="NEAR AI Non-streaming Completion"
import os
from litellm import completion

os.environ["NEARAI_API_KEY"] = ""  # your NEAR AI Cloud API key

response = completion(
    model="nearai/z-ai/glm-5.3-flash",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="NEAR AI Streaming Completion"
import os
from litellm import completion

os.environ["NEARAI_API_KEY"] = ""  # your NEAR AI Cloud API key

response = completion(
    model="nearai/z-ai/glm-5.3-flash",
    messages=[{"role": "user", "content": "Write a short story about AI"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Embeddings

```python showLineNumbers title="NEAR AI Embeddings"
import os
from litellm import embedding

os.environ["NEARAI_API_KEY"] = ""  # your NEAR AI Cloud API key

response = embedding(
    model="nearai/Qwen/Qwen3-Embedding-0.6B",
    input=["Hello, how are you?"],
)

print(response.data[0]["embedding"][:5])
```

### Responses API

NEAR AI Cloud has its own `/v1/responses` route, but its output is not wire-compatible with OpenAI's Responses API. LiteLLM sends `litellm.responses` calls to NEAR AI chat completions instead and converts the result back into a Responses API object.

```python showLineNumbers title="NEAR AI Responses API"
import os
import litellm

os.environ["NEARAI_API_KEY"] = ""  # your NEAR AI Cloud API key

response = litellm.responses(
    model="nearai/z-ai/glm-5.3-flash",
    input="Say hello",
)

print(response.output_text)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: glm-5.3-flash
    litellm_params:
      model: nearai/z-ai/glm-5.3-flash
      api_key: os.environ/NEARAI_API_KEY
  - model_name: qwen3-embedding
    litellm_params:
      model: nearai/Qwen/Qwen3-Embedding-0.6B
      api_key: os.environ/NEARAI_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export NEARAI_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-nearai"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

A chat deployment configured this way serves `/v1/chat/completions`, `/v1/responses`, and `/v1/messages` on the proxy. The embedding deployment serves `/v1/embeddings`.

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-5.3-flash",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="responses" label="Responses">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-5.3-flash",
    "input": "Hello, how are you?"
  }'
```

</TabItem>
<TabItem value="messages" label="Messages">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/messages \
  -H "x-api-key: $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-5.3-flash",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="embeddings" label="Embeddings">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/embeddings \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-embedding",
    "input": ["Hello, how are you?"]
  }'
```

</TabItem>
</Tabs>

You can also add NEAR AI Cloud from the Admin UI. Go to Models, then Add Model, pick NEAR AI Cloud as the provider, enter a `nearai/` model id, and paste your key.

## Cost Tracking

NEAR AI Cloud models are not yet in LiteLLM's model cost map, so spend is not computed automatically. NEAR AI publishes per-model rates in the [NEAR AI Cloud console](https://cloud.near.ai). Pass them as `input_cost_per_token` and `output_cost_per_token` on the deployment and LiteLLM will track spend for it, returning the amount in the `x-litellm-response-cost` response header and recording it in spend logs. Rates listed per million tokens must be divided by 1,000,000 for the per-token value.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: glm-5.3-flash
    litellm_params:
      model: nearai/z-ai/glm-5.3-flash
      api_key: os.environ/NEARAI_API_KEY
      input_cost_per_token: 0.0000002   # replace with the console rate
      output_cost_per_token: 0.0000008  # replace with the console rate
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["NEARAI_API_BASE"] = "https://custom.nearai.example/v1"
os.environ["NEARAI_API_KEY"] = ""  # your API key

response = completion(
    model="nearai/z-ai/glm-5.3-flash",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="nearai/z-ai/glm-5.3-flash",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="https://custom.nearai.example/v1",
    api_key="your-api-key",
)
```

Passing `api_base="https://cloud-api.near.ai/v1"` without the `nearai/` prefix also resolves to the NEAR AI Cloud provider, so `model="z-ai/glm-5.3-flash"` with that base URL is routed as `nearai` and picks up `NEARAI_API_KEY`.

## Not Yet Supported

NEAR AI Cloud also serves image generation, image edits, audio transcription, and rerank. LiteLLM does not route those to NEAR AI yet.
