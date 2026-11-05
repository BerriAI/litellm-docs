---
title: Agentgates
description: Call Agentgates models through LiteLLM with the Python SDK or Gateway. Configure your API key, model name, and optional API base.
---

# Agentgates

[Agentgates](https://agentgates.ai) sells open models by the request to AI agents, paid from a wallet's prepaid USDC balance, through an OpenAI-compatible chat completions API. Use the `agentgates/` prefix with a model id from [its models list](https://api.agentgates.ai/api/inference/v1/models).

Provider support was added in [PR #50256](https://github.com/BerriAI/litellm/pull/50256). Use a build that includes the provider.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `agentgates/` |
| API key environment variable | `AGENTGATES_API_KEY` |
| Default API base | `https://api.agentgates.ai/api/inference/v1` |
| Optional API base override | `AGENTGATES_API_BASE` or the `api_base` parameter |
| Upstream endpoint | `/chat/completions` |
| Provider documentation | [Agentgates inference API](https://api.agentgates.ai/api/inference/docs) |

## Setup

An Agentgates API key spends a wallet's prepaid balance. Connect a wallet at [agentgates.ai/inference](https://agentgates.ai/inference), add to its balance, and mint a key there. The key starts with `ag_` and is shown once. Export it before you start the SDK or proxy:

```bash
export AGENTGATES_API_KEY="your-agentgates-api-key"
```

Use `agentgates/<model-id>`, for example `agentgates/gpt-oss-120b`. LiteLLM removes the `agentgates/` prefix before it sends the model value to Agentgates.

## LiteLLM Python SDK

```python
from litellm import completion

response = completion(
    model="agentgates/gpt-oss-120b",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=500,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python
from litellm import completion

response = completion(
    model="agentgates/gpt-oss-120b",
    messages=[{"role": "user", "content": "Say hello in five words"}],
    max_tokens=500,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

Without `max_tokens`, a request's output ceiling is 1,024 tokens, and reasoning models count their reasoning tokens toward it, so set it to what the answer needs. Before it serves, Agentgates reserves the request's ceiling price from the balance and answers 402 when the balance cannot cover it. Nothing is charged on a 402.

Each request is charged its token cost rounded up to the next $0.001, with a $0.001 minimum. LiteLLM tracks the token cost from its cost map, so on very small requests its tracked spend is lower than the amount charged.

## LiteLLM Gateway

Save this configuration as `config.yaml`:

```yaml
model_list:
  - model_name: gpt-oss-120b
    litellm_params:
      model: agentgates/gpt-oss-120b
      api_key: os.environ/AGENTGATES_API_KEY
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
    "model": "gpt-oss-120b",
    "messages": [{"role": "user", "content": "Reply with one word: hello"}],
    "max_tokens": 200
  }'
```

The proxy returns an OpenAI-format chat completion:

```json
{
  "choices": [{"message": {"role": "assistant", "content": "hello"}}],
  "usage": {
    "completion_tokens": 41,
    "prompt_tokens": 73,
    "total_tokens": 114,
    "prompt_tokens_details": {"cached_tokens": 64}
  }
}
```

If your proxy requires authentication, also send `Authorization: Bearer <your-litellm-key>`. This is your LiteLLM key, not your Agentgates API key.

LiteLLM also accepts [Anthropic Messages](/docs/anthropic_unified) and [Responses API](/docs/response_api) requests for Agentgates models through its translation layer. These requests use Agentgates' chat completions endpoint, not native Agentgates Messages or Responses endpoints.
