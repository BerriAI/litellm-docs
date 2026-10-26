import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Inference APIs

Available from v1.107.0.

## Overview

| Property | Details |
|-------|-------|
| Description | Inference APIs serves open-weight models (DeepSeek, Qwen, GLM, Llama, gpt-oss, MiniMax, Kimi) over one OpenAI-compatible API. |
| Provider Route on LiteLLM | `inferenceapis/` |
| Link to Provider Doc | [Inference APIs docs ↗](https://inferenceapis.com/docs) |
| Base URL | `https://api.inferenceapis.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#usage---litellm-proxy-server) |

<br />
<br />

**We support ALL Inference APIs chat models, just set `inferenceapis/` as a prefix when sending requests**

## Available Models

Model ids keep their organization prefix, so the full LiteLLM model name has two slashes, e.g. `inferenceapis/openai/gpt-oss-120b`.

| Model | Context | Input $/1M | Output $/1M |
|-------|---------|------------|-------------|
| `inferenceapis/deepseek-ai/DeepSeek-V4-Flash` | 1M | 0.19 | 0.38 |
| `inferenceapis/deepseek-ai/DeepSeek-V4.1-Flash` | 1M | 0.40 | 1.60 |
| `inferenceapis/deepseek-ai/DeepSeek-V4-Pro` | 1M | 1.72 | 5.15 |
| `inferenceapis/zai-org/GLM-5.3` | 1M | 1.82 | 5.72 |
| `inferenceapis/zai-org/GLM-5.3-Flash` | 1M | 0.20 | 0.66 |
| `inferenceapis/Qwen/Qwen3.8-Flash` | 1M | 0.15 | 0.50 |
| `inferenceapis/Qwen/Qwen3-VL-235B-A22B-Instruct` | 262k | 0.26 | 1.15 |
| `inferenceapis/MiniMaxAI/MiniMax-M3` | 524k | 0.39 | 1.56 |
| `inferenceapis/moonshotai/Kimi-K2.7-Code` | 262k | 0.89 | 4.42 |
| `inferenceapis/meta-llama/Llama-3.3-70B-Instruct-Turbo` | 131k | 0.20 | 0.50 |
| `inferenceapis/openai/gpt-oss-120b` | 131k | 0.20 | 0.80 |
| `inferenceapis/openai/gpt-oss-20b` | 131k | 0.04 | 0.19 |

Inference APIs also accepts short aliases for these models, such as `inferenceapis/deepseek-chat` or `inferenceapis/glm-5.3`, and LiteLLM prices each alias like its canonical model. `GET https://api.inferenceapis.com/v1/models` lists every alias next to its canonical id.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["INFERENCEAPIS_API_KEY"] = ""  # your Inference APIs key
os.environ["INFERENCEAPIS_API_BASE"] = ""  # optional, defaults to https://api.inferenceapis.com/v1
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Inference APIs Non-streaming Completion"
import os
from litellm import completion

os.environ["INFERENCEAPIS_API_KEY"] = ""  # your Inference APIs key

response = completion(
    model="inferenceapis/deepseek-ai/DeepSeek-V4-Flash",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Inference APIs Streaming Completion"
import os
from litellm import completion

os.environ["INFERENCEAPIS_API_KEY"] = ""  # your Inference APIs key

response = completion(
    model="inferenceapis/deepseek-ai/DeepSeek-V4-Flash",
    messages=[{"role": "user", "content": "Write a short story about AI"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Responses API

Inference APIs serves `/v1/responses` natively, so LiteLLM sends `litellm.responses` calls straight to it.

```python showLineNumbers title="Inference APIs Responses API"
import os
import litellm

os.environ["INFERENCEAPIS_API_KEY"] = ""  # your Inference APIs key

response = litellm.responses(
    model="inferenceapis/deepseek-ai/DeepSeek-V4-Flash",
    input="Say hello",
)

print(response.output_text)
```

Inference APIs does not store responses, so `previous_response_id` returns a 400. Send the earlier turns in `input` instead.

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4-flash
    litellm_params:
      model: inferenceapis/deepseek-ai/DeepSeek-V4-Flash
      api_key: os.environ/INFERENCEAPIS_API_KEY
  - model_name: gpt-oss-120b
    litellm_params:
      model: inferenceapis/openai/gpt-oss-120b
      api_key: os.environ/INFERENCEAPIS_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export INFERENCEAPIS_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-inferenceapis"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

A deployment configured this way serves `/v1/chat/completions`, `/v1/responses`, and `/v1/messages` on the proxy. Each request goes to the matching Inference APIs endpoint as is, with no translation between API shapes.

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Inference APIs via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-inferenceapis",
)

response = client.chat.completions.create(
    model="deepseek-v4-flash",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="responses" label="Responses">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash",
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
    "model": "deepseek-v4-flash",
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

You can also add Inference APIs from the Admin UI. Go to Models, then Add Model, pick Inference APIs as the provider, enter an `inferenceapis/` model id, and paste your key.

## Cost Tracking

LiteLLM's model cost map has prices for the 12 chat models above and their aliases, so spend is tracked without extra config. Cached prompt tokens are billed at each model's cached-input rate where the model has one. The cost is returned in the `x-litellm-response-cost` response header and recorded in spend logs.

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["INFERENCEAPIS_API_BASE"] = "https://custom.inferenceapis.example/v1"
os.environ["INFERENCEAPIS_API_KEY"] = ""  # your API key

response = completion(
    model="inferenceapis/deepseek-ai/DeepSeek-V4-Flash",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="inferenceapis/deepseek-ai/DeepSeek-V4-Flash",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="https://custom.inferenceapis.example/v1",
    api_key="your-api-key",
)
```
