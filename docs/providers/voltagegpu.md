import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VoltageGPU

## Overview

| Property | Details |
|-------|-------|
| Description | VoltageGPU serves open models over an OpenAI-compatible API. Every model runs in a trusted execution environment (Intel TDX guests with confidential-computing GPUs); model ids end in `-TEE`, and `GET /v1/attestation` returns the hardware evidence of a model's running instances bound to a nonce you choose. |
| Provider Route on LiteLLM | `voltagegpu/` |
| Link to Provider Doc | [VoltageGPU Documentation ↗](https://docs.voltagegpu.com) |
| Base URL | `https://api.voltagegpu.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />
<br />

**We support ALL VoltageGPU chat models, just set `voltagegpu/` as a prefix when sending requests**

## Available Models

`GET https://api.voltagegpu.com/v1/models` lists the current models with their context length, their price per million tokens and a live `status` (`available`, `busy`, `saturated` or `unavailable`). The table below was read from that endpoint and from [the VoltageGPU pricing snapshot](https://voltagegpu.com/api/pricing/snapshot) on 23 October 2026; prices are in US dollars per million tokens and can change.

| Model | Context | Input $/M | Output $/M |
|-------|---------|-----------|------------|
| `voltagegpu/deepseek-ai/DeepSeek-V3.2-TEE` | 131,072 | 1.85 | 1.85 |
| `voltagegpu/deepseek-ai/DeepSeek-V4-Flash-0731-TEE` | 1,048,576 | 0.81 | 2.44 |
| `voltagegpu/google/gemma-4-31B-turbo-TEE` | 131,072 | 0.22 | 0.68 |
| `voltagegpu/moonshotai/Kimi-K2.6-TEE` | 262,144 | 0.83 | 3.61 |
| `voltagegpu/moonshotai/Kimi-K3-TEE` | 1,048,576 | 3.42 | 17.58 |
| `voltagegpu/Nemotron-3-Nano-Omni-30B-TEE` | not published | 0.05 | 0.18 |
| `voltagegpu/Qwen/Qwen3-235B-A22B-Thinking-2507-TEE` | 262,144 | 0.55 | 2.21 |
| `voltagegpu/Qwen/Qwen3-32B-TEE` | 40,960 | 0.19 | 0.77 |
| `voltagegpu/Qwen/Qwen3.5-397B-A17B-TEE` | 262,144 | 0.83 | 5.55 |
| `voltagegpu/Qwen/Qwen3.6-27B-TEE` | 262,144 | 0.46 | 3.70 |
| `voltagegpu/Qwen/Qwen3.8-27B-TEE` | 262,144 | 0.07 | 2.31 |
| `voltagegpu/unsloth/Mistral-Nemo-Instruct-2407-TEE` | not published | 0.05 | 0.18 |
| `voltagegpu/zai-org/GLM-5.1-TEE` | 202,752 | 1.81 | 5.70 |
| `voltagegpu/zai-org/GLM-5.2-TEE` | 1,048,576 | 2.31 | 7.31 |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["VOLTAGEGPU_API_KEY"] = ""  # your VoltageGPU API key
os.environ["VOLTAGEGPU_API_BASE"] = ""  # optional, defaults to https://api.voltagegpu.com/v1
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="VoltageGPU Non-streaming Completion"
import os
from litellm import completion

os.environ["VOLTAGEGPU_API_KEY"] = ""  # your VoltageGPU API key

response = completion(
    model="voltagegpu/Qwen/Qwen3.8-27B-TEE",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="VoltageGPU Streaming Completion"
import os
from litellm import completion

os.environ["VOLTAGEGPU_API_KEY"] = ""  # your VoltageGPU API key

response = completion(
    model="voltagegpu/Qwen/Qwen3.8-27B-TEE",
    messages=[{"role": "user", "content": "Write a short story about AI"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Fallback models

VoltageGPU retries a saturated model with backoff for up to about 12 seconds. To let it try other models after that, pass `fallback_models` (confidential models only, at most 3, tried in order) through `extra_body`. The model that actually ran comes back in the `X-VoltageGPU-Model` response header and is the one billed.

```python showLineNumbers title="VoltageGPU Fallback Models"
import os
from litellm import completion

os.environ["VOLTAGEGPU_API_KEY"] = ""  # your VoltageGPU API key

response = completion(
    model="voltagegpu/Qwen/Qwen3.8-27B-TEE",
    messages=[{"role": "user", "content": "Hello!"}],
    extra_body={"fallback_models": ["zai-org/GLM-5.1-TEE"]},
)

print(response.choices[0].message.content)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: qwen3.8-27b
    litellm_params:
      model: voltagegpu/Qwen/Qwen3.8-27B-TEE
      api_key: os.environ/VOLTAGEGPU_API_KEY
  - model_name: deepseek-v3.2
    litellm_params:
      model: voltagegpu/deepseek-ai/DeepSeek-V3.2-TEE
      api_key: os.environ/VOLTAGEGPU_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export VOLTAGEGPU_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-voltagegpu"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.8-27b",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="VoltageGPU via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-voltagegpu",
)

response = client.chat.completions.create(
    model="qwen3.8-27b",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

You can also add VoltageGPU from the Admin UI. Go to Models, then Add Model, pick VoltageGPU as the provider, enter a `voltagegpu/` model id, and paste your key.

## Cost Tracking

VoltageGPU models are not in LiteLLM's model cost map, so spend is not computed automatically. VoltageGPU bills per token and publishes each model's rate in the `pricing` object of `GET /v1/models` (`prompt` and `completion`, in US dollars per million tokens) and in [its pricing snapshot](https://voltagegpu.com/api/pricing/snapshot). Pass those values as `input_cost_per_token` and `output_cost_per_token` on the deployment, dividing by 1,000,000, and LiteLLM will track spend for it and return the amount in the `x-litellm-response-cost` response header. Non-streaming responses from VoltageGPU also carry the amount it charged in the `X-VoltageGPU-Cost-USD` header.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: qwen3.8-27b
    litellm_params:
      model: voltagegpu/Qwen/Qwen3.8-27B-TEE
      api_key: os.environ/VOLTAGEGPU_API_KEY
      input_cost_per_token: 0.00000007   # $0.07 / 1M
      output_cost_per_token: 0.00000231  # $2.31 / 1M
  - model_name: deepseek-v3.2
    litellm_params:
      model: voltagegpu/deepseek-ai/DeepSeek-V3.2-TEE
      api_key: os.environ/VOLTAGEGPU_API_KEY
      input_cost_per_token: 0.00000185   # $1.85 / 1M
      output_cost_per_token: 0.00000185  # $1.85 / 1M
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["VOLTAGEGPU_API_BASE"] = "https://custom.voltagegpu.example/v1"
os.environ["VOLTAGEGPU_API_KEY"] = ""  # your API key

response = completion(
    model="voltagegpu/Qwen/Qwen3.8-27B-TEE",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="voltagegpu/Qwen/Qwen3.8-27B-TEE",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="https://custom.voltagegpu.example/v1",
    api_key="your-api-key",
)
```

## Supported OpenAI Parameters

The VoltageGPU chat completions schema documents these request fields:

- `temperature`
- `top_p`
- `n`
- `stream`
- `max_tokens`
- `max_completion_tokens` (sent upstream as `max_tokens`)
- `presence_penalty`
- `frequency_penalty`
- `stop`

VoltageGPU also accepts `fallback_models` (see above); pass it through `extra_body`.
