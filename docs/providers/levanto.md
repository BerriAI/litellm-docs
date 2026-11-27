---
title: "Levanto API with LiteLLM: Python SDK and Gateway"
sidebar_label: "Levanto"
description: Call Levanto's open-weight models, its auto router and its Sage decision model through LiteLLM with the Python SDK or Gateway.
---

# Levanto

[Levanto](https://levanto.ai) serves open-weight models (DeepSeek, Kimi, GLM, gpt-oss and others) behind an OpenAI-compatible API, and Sage, a decision model that answers yes/no, choice and score questions. Model `auto` lets Levanto's router pick a model for each request.

<SinceVersion v="1.113.0" />

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `levanto/` |
| API key environment variable | `LEVANTO_API_KEY` |
| Default API base | `https://api.levanto.ai/v1` |
| Optional API base override | `LEVANTO_BASE_URL` or the `api_base` parameter |
| Upstream endpoints | `/chat/completions`, and `/v1/systemone` for Sage |
| Provider documentation | [Levanto LLMs](https://docs.levanto.ai/llms/introduction), [Sage in System One format](https://docs.levanto.ai/systemone) |

## Setup

Create a key in the [Levanto dashboard](https://platform.levanto.ai) and export it:

```bash
export LEVANTO_API_KEY="lv_live_..."
```

The same key works for the LLMs and for Sage. Use `levanto/auto` or a model id from `GET https://api.levanto.ai/v1/models`. Model ids contain a slash, so the full name has two, for example `levanto/deepseek/deepseek-v4-flash`. LiteLLM removes the `levanto/` prefix before it sends the model to Levanto.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="levanto/auto",
    messages=[{"role": "user", "content": "Reply with the word ok."}],
)

print(response.choices[0].message.content)
print(response.model)
```

With `auto`, `response.model` names the model the router picked, and LiteLLM records the cost at that model's price.

`auto` uses the `balanced` spending target unless the key's router sets another. To change it for one call, pass `target` with `economy`, `balanced` or `quality`:

```python
from litellm import completion

response = completion(
    model="levanto/auto",
    messages=[{"role": "user", "content": "Prove that the sum of two even integers is even."}],
    target="quality",
)
```

`stream=True`, `acompletion`, tools and `response_format` with a JSON schema work as they do for OpenAI.

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: levanto-auto
    litellm_params:
      model: levanto/auto
      api_key: os.environ/LEVANTO_API_KEY
```

Start the proxy with the key exported in its environment:

```bash
litellm --config config.yaml
```

Send a request using the configured model name:

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-litellm-key>" \
  -d '{
    "model": "levanto-auto",
    "messages": [{"role": "user", "content": "Reply with the word ok."}],
    "target": "economy"
  }'
```

The proxy also accepts [Anthropic Messages](/docs/anthropic_unified) and [Responses API](/docs/response_api) requests for Levanto models. LiteLLM sends them to Levanto's chat completions endpoint.

## Sage decisions

Sage answers questions about content with probabilities instead of text. Call it through LiteLLM's [decision routes](/docs/decisions) with `levanto/levanto-sage-2` or `levanto/sage-latest`:

```python
import litellm

response = litellm.systemone(
    model="levanto/levanto-sage-2",
    state={"subject": "Duplicate charge", "message": "I was charged twice. Please help."},
    questions={
        "billing": {"type": "noul", "instructions": "Is this message about billing?"},
        "tone": {"type": "choice", "criteria": {"angry": "Upset or hostile", "calm": "Neutral or polite"}},
        "urgency": {"type": "score", "criteria": ["Can wait", "This week", "Today"]},
    },
)

print(response.answers["billing"].noul)
```

`noul` is the probability of yes. `litellm.decisions` takes the same model with OpenAI-format questions, and the proxy serves both formats on `/v1/systemone` and `/v1/decisions`. Sage's own options (reasoning, grounding, tags and sort) are not sent through LiteLLM yet.

The cost map uses the standard plan's 32K context for Sage. Growth plans allow 128K.

### Sage as a guardrail

The [Decision Model guardrail](/docs/proxy/guardrails/decision_model) can use Sage to screen requests or responses. This config blocks a chat request when Sage puts the probability of yes at 0.5 or more:

```yaml
model_list:
  - model_name: levanto-auto
    litellm_params:
      model: levanto/auto
      api_key: os.environ/LEVANTO_API_KEY
  - model_name: sage
    litellm_params:
      model: levanto/levanto-sage-2
      api_key: os.environ/LEVANTO_API_KEY

guardrails:
  - guardrail_name: sage-policy
    litellm_params:
      guardrail: decision_model
      mode: pre_call
      default_on: true
      decision_model: sage
      checks:
        - name: credential_request
          instructions: Does the user ask for someone else's password or login credentials?
          threshold: 0.5
```

A blocked request returns `400` with `Violated decision model guardrail policy`.
