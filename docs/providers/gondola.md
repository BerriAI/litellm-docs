# Gondola

## Overview

| Property | Details |
|-------|-------|
| Description | Gondola is a marketplace for Venice AI inference. It routes each request to the cheapest available supplier, so prices usually land below Venice's list, and it serves 100+ text models plus image and video, including uncensored models. Paid in USDC on Base, no subscription. |
| Provider Route on LiteLLM | `gondola/` |
| Link to Provider Doc | [Gondola Docs ↗](https://gondola-ai.com/guides) |
| Base URL | `https://api.gondola-ai.com/v1` |
| Supported Operations | [`/chat/completions`](#usage), `/images/generations`, `/images/edits` |

<br />

## What is Gondola?

Gondola is a two-sided marketplace on top of Venice AI: holders of Venice's DIEM compute allowance list their keys, and buyers call one OpenAI-compatible gateway that routes each request to the cheapest available key. Buyers top up a USDC balance on Base and pay the metered cost per request. Because routing always picks the cheapest supplier, effective prices are typically below Venice's own list. Gondola is also Anthropic-compatible (`/v1/messages`). Prompts and completions are never persisted (no content hashing); only per-request metadata like token counts, model, cost, and timing is stored.

The full, live catalog with prices is public and needs no key:

```bash
curl https://api.gondola-ai.com/v1/models
```

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["GONDOLA_API_KEY"] = ""  # your Gondola API key (gnd_...)
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Gondola Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["GONDOLA_API_KEY"] = ""  # gnd_...

response = completion(
    model="gondola/deepseek-v4-flash",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
)
print(response)
```

### Streaming

```python showLineNumbers title="Gondola Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["GONDOLA_API_KEY"] = ""  # gnd_...

response = completion(
    model="gondola/claude-sonnet-5",
    messages=[{"role": "user", "content": "Write a haiku about the sea."}],
    stream=True,
)
for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy Server

### 1. Save key in your environment

```bash
export GONDOLA_API_KEY="gnd_..."
```

### 2. Start the proxy

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gondola-deepseek
    litellm_params:
      model: gondola/deepseek-v4-flash
      api_key: os.environ/GONDOLA_API_KEY
```

### 3. Test it

```bash
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{"model": "gondola-deepseek", "messages": [{"role":"user","content":"Hello"}]}'
```

## Model Categories

Gondola serves the Venice catalog: general chat, coding-optimized models, reasoning models, and an uncensored line (e.g. `hermes-3-llama-3.1-405b`, `venice-uncensored-1-2`, `gemma-4-uncensored`), plus image generation/editing. Use `GET /v1/models` for the authoritative list and per-model capability flags (function calling, reasoning, web search, context length).

## Pricing Model

Prices are metered per request and float with live marketplace supply; the cheapest available supplier is always selected. Fee-inclusive per-model "from" prices are returned by `GET /v1/models` and the public market-data API at `https://api.gondola-ai.com/v1/market/models`.

## Additional Resources

- [Gondola setup guides](https://gondola-ai.com/guides)
- [Public marketplace and prices](https://gondola-ai.com/marketplace)
- [Mint an API key](https://gondola-ai.com/keys)
