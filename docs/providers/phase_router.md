---
title: Phase Router
description: Call Phase Router models through LiteLLM with the Python SDK or Gateway. Configure PHASE_API_KEY, pick a model or let the router choose with auto.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Phase Router

<SinceVersion v="1.111.0" />

## Overview

| Property | Details |
|-------|-------|
| Description | Phase Router is an OpenAI-compatible model router with about 400 models: open models such as Llama, Qwen, DeepSeek, gpt-oss, Kimi and GLM, plus closed models through your own provider keys (BYOK). The `auto` model lets the router pick a model per request. |
| Provider Route on LiteLLM | `phase_router/` |
| Link to Provider Doc | [Phase Router docs ↗](https://router.phase.xyz/docs) |
| Model list | [router.phase.xyz/models ↗](https://router.phase.xyz/models), or `GET https://router.phase.xyz/v1/models` (public, no key needed) |
| Base URL | `https://router.phase.xyz/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/embeddings`](#embeddings), [`/responses`](#responses-api), [`/messages`](#usage---litellm-proxy-server) |

<br />

**We support ALL Phase Router models, just set `phase_router/` as a prefix when sending requests**

## Model Selection

Pass any model id from the [model list](https://router.phase.xyz/models), for example `phase_router/gpt-oss-120b` or `phase_router/llama-3.3-70b`. Phase Router also exposes routing classes as model ids: `auto` picks a model per request by task complexity, `eco` prefers the cheapest suitable model, `premium` routes to flagship models, and `agentic` only uses models with reliable tool calling.

Streaming, tool calling and JSON mode work on the models that support them; the `capabilities` field on `GET /v1/models` lists what each model supports.

## Required Variables

Create a key (it starts with `phk_`) on the [Phase Router dashboard](https://router.phase.xyz/dashboard).

```python showLineNumbers title="Environment Variables"
os.environ["PHASE_API_KEY"] = ""  # your Phase Router key, phk_...
os.environ["PHASE_API_BASE"] = ""  # optional, defaults to https://router.phase.xyz/v1
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Phase Router Non-streaming Completion"
import os
from litellm import completion

os.environ["PHASE_API_KEY"] = ""  # your Phase Router key

response = completion(
    model="phase_router/auto",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Phase Router Streaming Completion"
import os
from litellm import completion

os.environ["PHASE_API_KEY"] = ""  # your Phase Router key

response = completion(
    model="phase_router/gpt-oss-120b",
    messages=[{"role": "user", "content": "Write a short story about AI"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Embeddings

```python showLineNumbers title="Phase Router Embeddings"
import os
from litellm import embedding

os.environ["PHASE_API_KEY"] = ""  # your Phase Router key

response = embedding(
    model="phase_router/bge-m3",
    input=["Hello world"],
)

print(len(response.data[0]["embedding"]))
```

### Responses API

Phase Router does not serve `/v1/responses` natively, so LiteLLM translates `litellm.responses` calls into Phase Router chat completions and converts the result back into a Responses API object.

```python showLineNumbers title="Phase Router Responses API"
import os
import litellm

os.environ["PHASE_API_KEY"] = ""  # your Phase Router key

response = litellm.responses(
    model="phase_router/auto",
    input="Say hello",
)

print(response.output_text)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: phase-auto
    litellm_params:
      model: phase_router/auto
      api_key: os.environ/PHASE_API_KEY
  - model_name: gpt-oss-120b
    litellm_params:
      model: phase_router/gpt-oss-120b
      api_key: os.environ/PHASE_API_KEY
  - model_name: bge-m3
    litellm_params:
      model: phase_router/bge-m3
      api_key: os.environ/PHASE_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export PHASE_API_KEY="phk_..."
export LITELLM_MASTER_KEY="sk-local-phase"
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
    "model": "phase-auto",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Phase Router via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-phase",
)

response = client.chat.completions.create(
    model="phase-auto",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="embeddings" label="Embeddings">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/embeddings \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bge-m3",
    "input": ["Hello world"]
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
    "model": "gpt-oss-120b",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

You can also add Phase Router from the Admin UI. Go to Models, then Add Model, pick Phase Router as the provider, enter a `phase_router/` model id, and paste your key.

## Cost Tracking

LiteLLM's model cost map has per-token rates for a few Phase Router models (`phase_router/gpt-oss-120b`, `phase_router/llama-3.3-70b`, `phase_router/qwen3-235b`, `phase_router/deepseek-v3.2`, `phase_router/kimi-k2.6`, `phase_router/glm-4.7` and the `phase_router/bge-m3` embedding model), so spend for those is computed automatically. Every Phase Router response also carries the amount charged for that request in US dollars in `usage.cost`, the same field OpenRouter uses.

For any other model, take the rates from the [model list](https://router.phase.xyz/models) or from `GET /v1/models`, where `phase.input_per_m` and `phase.output_per_m` are micro-dollars per million tokens; divide by 1e12 for the per-token dollar value, and set them on the deployment:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: qwen3-coder-480b
    litellm_params:
      model: phase_router/qwen3-coder-480b
      api_key: os.environ/PHASE_API_KEY
      input_cost_per_token: 0.000000312   # input_per_m 312000
      output_cost_per_token: 0.00000104   # output_per_m 1040000
```

The `auto`, `eco`, `premium` and `agentic` classes route to different models per request, so they have no fixed rate; use `usage.cost` for those.

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["PHASE_API_BASE"] = "https://custom.phase.example/v1"
os.environ["PHASE_API_KEY"] = ""  # your Phase Router key

response = completion(
    model="phase_router/auto",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="phase_router/auto",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="https://custom.phase.example/v1",
    api_key="phk_...",
)
```

Passing `api_base="https://router.phase.xyz/v1"` without the `phase_router/` prefix also resolves to the Phase Router provider and picks up `PHASE_API_KEY`.

## More Examples

The [phase-router-skills](https://github.com/devcells/phase-router-skills) repository has more examples of using Phase Router.
