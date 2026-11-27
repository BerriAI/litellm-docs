---
title: c0mpute
description: Call open-weight models on the c0mpute peer-to-peer network through LiteLLM with the Python SDK or Gateway. Configure your API key, model name, and optional API base.
---

# c0mpute

[c0mpute](https://c0mpute.com) is a decentralized, peer-to-peer network of everyday computers that serves open-weight models through an OpenAI-compatible chat completions API. Use the `c0mpute/` prefix with a model name from the network.

Provider support was added in [PR #53568](https://github.com/BerriAI/litellm/pull/53568). Use a release that includes it.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `c0mpute/` |
| API key environment variable | `C0MPUTE_API_KEY` |
| Default API base | `https://c0mpute.com/v1` |
| Optional API base override | `C0MPUTE_API_BASE` or the `api_base` parameter |
| Upstream endpoint | `/chat/completions` |
| Provider documentation | [c0mpute docs](https://c0mpute.com/docs) |

## How c0mpute differs from a hosted API

Requests run on nodes that other people operate. Each job is a sealed-bid auction among the nodes that serve the model, and the lowest bid under your cap wins, so there is no fixed rate card. LiteLLM has no per-token prices for c0mpute and reports no cost for these calls.

Models are open-weight, mostly between 0.5B and 30B parameters. Quality and speed depend on which node picks up the job, and a request can take from a few seconds to over a minute while the auction and queue run. A model listed by `GET https://c0mpute.com/v1/models` may have no live node at a given moment, in which case c0mpute returns an error.

The API takes `model`, `messages`, `stream`, `temperature` and `max_tokens`, and drops other fields. Tool and function calling do not work through the API: `tools` and `tool_choice` are ignored and a `tool` role message is rejected. Message content must be a plain string, so image input is not supported. LiteLLM joins a content list that holds only text parts into one string before sending it. `max_tokens` is capped at 8192.

## Setup

Sign in at [c0mpute.com/chat](https://c0mpute.com/chat), create a key in the keys tab, and export it before you start the SDK or proxy:

```bash
export C0MPUTE_API_KEY="your-c0mpute-api-key"
```

Use `c0mpute/auto` to let the c0mpute router pick a model for each request. The router also accepts `auto:fast`, `auto:standard`, `auto:high` and `auto:max`, and you can name a concrete model such as `c0mpute/qwen3:4b`. LiteLLM removes the `c0mpute/` prefix before it sends the model value to c0mpute.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="c0mpute/auto",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=256,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks. Text often arrives in a few large chunks instead of token by token:

```python
from litellm import completion

response = completion(
    model="c0mpute/auto",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=256,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: c0mpute-auto
    litellm_params:
      model: c0mpute/auto
      api_key: os.environ/C0MPUTE_API_KEY
```

Start the proxy with the API key exported in its environment:

```bash
litellm --config config.yaml
```

Send a request using the configured model alias:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "c0mpute-auto",
    "messages": [{"role": "user", "content": "Say hello in five words"}],
    "max_tokens": 256
  }'
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your c0mpute API key.

LiteLLM also accepts [Anthropic Messages](/docs/anthropic_unified) and [Responses API](/docs/response_api) requests for c0mpute models through its translation layer. These requests use c0mpute's chat completions endpoint, and the same limits apply, so tool use does not work there either.

## Run a node

Anyone can add a computer to the network and earn from the jobs it wins:

```bash
curl -fsSL https://c0mpute.com/install.sh | sh
```
