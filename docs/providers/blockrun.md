---
title: "BlockRun API with LiteLLM: Python SDK and Gateway"
sidebar_label: "BlockRun"
description: "Call OpenAI, Anthropic, Google, xAI, DeepSeek, Qwen and other models through BlockRun's OpenAI-compatible API from the LiteLLM Python SDK or AI Gateway, with one API key."
---

# BlockRun

[BlockRun](https://blockrun.ai) is an AI gateway with an OpenAI-compatible API. One BlockRun API key reaches models from OpenAI, Anthropic, Google, xAI, DeepSeek, Qwen, Z.ai, NVIDIA and others, billed in USD per call. BlockRun model ids are `provider/model` slugs, so full LiteLLM model ids have three segments, for example `blockrun/openai/gpt-6-luna`. LiteLLM removes only the `blockrun/` prefix before it sends the model value to BlockRun.

Provider support was added in [PR #53695](https://github.com/BerriAI/litellm/pull/53695). Use a build that includes it.

## Overview

| Property | Details |
|----------|---------|
| Provider prefix | `blockrun/` |
| API key environment variable | `BLOCKRUN_API_KEY` |
| Default API base | `https://api.blockrun.ai/v1` |
| Optional API base override | `BLOCKRUN_API_BASE` or the `api_base` parameter |
| Upstream endpoint | `/chat/completions` |
| Model list | [`https://api.blockrun.ai/v1/models`](https://api.blockrun.ai/v1/models), readable without a key |

## Setup

Create an API key on the **Keys** page at [user.blockrun.ai](https://user.blockrun.ai). Keys start with `brk_live_`. Export it before you start the SDK or Gateway:

```bash
export BLOCKRUN_API_KEY="brk_live_..."
```

Pick a model id from `https://api.blockrun.ai/v1/models` and prepend the `blockrun/` prefix, for example `blockrun/openai/gpt-6-luna`.

## LiteLLM Python SDK

```python keep-model-ids
from litellm import completion

response = completion(
    model="blockrun/openai/gpt-6-luna",
    messages=[{"role": "user", "content": "Reply with exactly: hello from blockrun"}],
    max_tokens=800,
)

print(response.choices[0].message.content)
```

For streaming, pass `stream=True` and iterate over the response chunks:

```python keep-model-ids
from litellm import completion

response = completion(
    model="blockrun/openai/gpt-6-luna",
    messages=[{"role": "user", "content": "Reply with exactly: hello from blockrun"}],
    max_tokens=800,
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

Many BlockRun models reason before they answer, and reasoning tokens count toward `max_tokens`. Leave enough room for both, or the response can end before any visible text.

LiteLLM treats every BlockRun model as supporting tool calls, so `tools` and `tool_choice` are sent as you pass them. A model that does not support tools answers with a 400 error from BlockRun.

```python keep-model-ids
from litellm import completion

response = completion(
    model="blockrun/openai/gpt-6-luna",
    messages=[{"role": "user", "content": "What is the weather in Paris? Use the tool."}],
    tools=[{
        "type": "function",
        "function": {
            "name": "get_weather",
            "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
        },
    }],
    tool_choice="required",
)

print(response.choices[0].message.tool_calls[0].function.arguments)
```

## LiteLLM Gateway

Install the proxy with `pip install 'litellm[proxy]'`. Set `BLOCKRUN_API_KEY` on the Gateway process, and set `LITELLM_MASTER_KEY` to a strong key for Gateway clients. The BlockRun key authenticates upstream requests. The master key authenticates your client to LiteLLM.

```bash
export BLOCKRUN_API_KEY="brk_live_..."
export LITELLM_MASTER_KEY="sk-your-strong-master-key"
```

Save this configuration as `config.yaml`:

```yaml keep-model-ids
model_list:
  - model_name: blockrun-gpt-6-luna
    litellm_params:
      model: blockrun/openai/gpt-6-luna
      api_key: os.environ/BLOCKRUN_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash
litellm --config config.yaml --port 4000
```

In a second terminal with `LITELLM_MASTER_KEY` set, send a request using the configured model alias:

```bash keep-model-ids
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "blockrun-gpt-6-luna",
    "messages": [{"role": "user", "content": "Reply with exactly: hello from blockrun"}],
    "max_tokens": 800
  }'
```

The proxy returns an OpenAI-format chat completion:

```json keep-model-ids
{
  "model": "blockrun-gpt-6-luna",
  "choices": [{"message": {"role": "assistant", "content": "hello from blockrun"}, "finish_reason": "stop"}],
  "usage": {"completion_tokens": 7, "prompt_tokens": 14, "total_tokens": 21}
}
```

LiteLLM also accepts [Anthropic Messages](/docs/anthropic_unified) and [Responses API](/docs/response_api) requests for BlockRun models through its translation layer. These requests use BlockRun's chat completions endpoint.

## Supported Models

Every chat model on `https://api.blockrun.ai/v1/models` works with the `blockrun/` prefix. These free models are in the LiteLLM catalog, so LiteLLM knows their context windows and tracks their spend as $0:

| Model | Context window | Max output tokens | Reasoning |
|-------|----------------|-------------------|-----------|
| `blockrun/nvidia/nemotron-3.5-lightning` | 1,000,000 | 16,384 | Yes |
| `blockrun/nvidia/nemotron-3-super-120b` | 131,072 | 16,384 | Yes |
| `blockrun/nvidia/nemotron-3.5-bolt` | 131,072 | 16,384 | No |

BlockRun's prices for paid models are on `https://api.blockrun.ai/v1/models`, and an account can have its own negotiated rates. LiteLLM has no catalog price for paid BlockRun models, so it records their spend as $0 unless you set per-token costs in USD on the deployment. Give the deployment its own `model_name`, since LiteLLM load-balances deployments that share one. The values below are the list price of `openai/gpt-6-luna` on November 22, 2026, so check the model list for current prices and use your own rates if your account has them:

```yaml keep-model-ids
model_list:
  - model_name: blockrun-gpt-6-luna-tracked
    litellm_params:
      model: blockrun/openai/gpt-6-luna
      api_key: os.environ/BLOCKRUN_API_KEY
      input_cost_per_token: 0.0000001
      output_cost_per_token: 0.0000005
      cache_read_input_token_cost: 0.00000001
```

With these rates, a call with 14 prompt tokens and 17 completion tokens returns `x-litellm-response-cost: 9.9e-06`.
