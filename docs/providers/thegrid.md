---
title: The Grid AI
description: Call The Grid AI's market instruments through LiteLLM with the Python SDK or Gateway, using chat completions, the Responses API or Anthropic Messages.
---

# The Grid AI

[The Grid AI](https://thegrid.ai) is an OpenAI-compatible inference marketplace. Use the `thegrid/` prefix with an instrument id such as `thegrid/text-standard`.

Provider support was added in [PR #39907](https://github.com/BerriAI/litellm/pull/39907). Use a build that includes it.

## Instruments, not fixed models

An id on The Grid AI names a **market instrument**, not one fixed model. `text-standard`, `code-prime` and `agent-max` combine a task type (text, code, agent) with a quality tier (standard, prime, max). Whichever supplier is competitive at that moment fills the request, so the model that serves a request can differ from one call to the next. Lab instruments such as `claude-opus-latest`, `kimi-latest` and `glm-latest` keep routing within one model family.

`GET https://api.thegrid.ai/v1/models` lists the current instruments with their limits and prices.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `thegrid/` |
| API key environment variable | `THEGRID_API_KEY` |
| Default API base | `https://api.thegrid.ai/v1` |
| Optional API base override | `THEGRID_API_BASE` or the `api_base` parameter |
| Upstream endpoints | `/chat/completions`, `/responses`, `/messages` |
| Provider documentation | [The Grid AI](https://thegrid.ai) |

## Setup

```bash
export THEGRID_API_KEY="your-grid-api-key"
```

LiteLLM removes the `thegrid/` prefix before it sends the model value to The Grid AI. A request without a Grid key fails with an authentication error before anything is sent. LiteLLM never falls back to `OPENAI_API_KEY` or `OPENAI_ORGANIZATION` for this provider.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="thegrid/text-standard",
    messages=[{"role": "user", "content": "Say hello in five words"}],
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the chunks:

```python
from litellm import completion

response = completion(
    model="thegrid/code-prime",
    messages=[{"role": "user", "content": "Write a haiku about routers"}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

Instruments reason before they answer, and reasoning tokens count toward the output budget. Leave room in `max_tokens` or `max_completion_tokens`, or the answer can be cut short.

### Responses API

The Grid AI serves `/v1/responses` natively:

```python
import litellm

response = litellm.responses(model="thegrid/agent-prime", input="Plan a three step research task")
print(response.output_text)
```

### Anthropic Messages

The Grid AI also serves `/v1/messages` natively, so LiteLLM forwards Anthropic Messages requests as they are, including Anthropic-only fields such as `thinking` and `top_k`:

```python
import litellm

response = await litellm.anthropic.messages.acreate(
    model="thegrid/claude-opus-latest",
    messages=[{"role": "user", "content": "Summarise the CAP theorem"}],
    max_tokens=2048,
    thinking={"type": "enabled", "budget_tokens": 1024},
)
```

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: text-standard
    litellm_params:
      model: thegrid/text-standard
      api_key: os.environ/THEGRID_API_KEY
```

To expose every instrument at once, use a wildcard. `/v1/models` then lists all of them:

```yaml
model_list:
  - model_name: thegrid/*
    litellm_params:
      model: thegrid/*
      api_key: os.environ/THEGRID_API_KEY
```

Start the proxy and send a request:

```bash
litellm --config config.yaml
```

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-litellm-key>" \
  -d '{
    "model": "text-standard",
    "messages": [{"role": "user", "content": "Say hello in five words"}]
  }'
```

The bearer token here is your LiteLLM key, not your Grid key.

## Spend tracking

LiteLLM prices The Grid AI requests from its own cost map (`thegrid/*` rows), not from the `usage.cost` field in The Grid AI's response. Instrument prices are set by the market and move over time, so the cost map is a recent snapshot. For an exact figure, compare with your usage in The Grid AI's console. To pin your own rates, set `input_cost_per_token` and `output_cost_per_token` on the deployment.
