---
title: "RedRouter API with LiteLLM"
sidebar_label: "RedRouter"
description: "Connect RedRouter to LiteLLM with an OpenAI-compatible endpoint, an environment-held API key, streamed responses and a gateway deployment."
---

# RedRouter

{/* keep-version-note */}

This guide uses LiteLLM's existing [OpenAI-compatible interface](./openai_compatible). First-class `redrouter/` provider support is pending in [LiteLLM PR #53176](https://github.com/BerriAI/litellm/pull/53176). Released packages do not recognize that prefix until the integration ships.

[RedRouter](https://redrouter.org) provides a paid inference API for coding and authorized security work. Its `red-cyber-1` model is a text-only beta with function calling. Check the [public catalog](https://redrouter.org/api/catalog) for current models, capabilities, prices and limits.

## Python SDK

Create a key at [RedRouter](https://redrouter.org/keys), then set it in the process environment.

```bash
export REDROUTER_API_KEY="YOUR_REDROUTER_API_KEY"
pip install litellm
```

```python
import os
from litellm import completion

response = completion(
    model="openai/red-cyber-1",
    api_base="https://redrouter.org/v1",
    api_key=os.environ["REDROUTER_API_KEY"],
    messages=[{"role": "user", "content": "Reply with hello."}],
    max_tokens=128,
)
print(response.choices[0].message.content)
```

The `openai/` prefix selects LiteLLM's compatibility adapter. The model ID sent to RedRouter is `red-cyber-1`. This configuration uses RedRouter credits or eligible trial usage. The output cap in this example keeps the first request small.

For streamed output, add `stream=True` and `stream_options={"include_usage": True}`. Consume text from `chunk.choices[0].delta.content` when choices are present; the final usage chunk can have an empty choices list.

## Gateway

Install `litellm[proxy]`. Set `REDROUTER_API_KEY` and a strong `LITELLM_MASTER_KEY` on the gateway process, then save this configuration:

```yaml
model_list:
  - model_name: redrouter-chat
    litellm_params:
      model: openai/red-cyber-1
      api_base: https://redrouter.org/v1
      api_key: os.environ/REDROUTER_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

```bash
litellm --config config.yaml --port 4000
```

Send requests to the gateway with `model="redrouter-chat"` and authenticate with its master or virtual key. Keep the RedRouter key on the gateway. Set an explicit output cap in your client request.

## Native provider support

The pending integration registers `redrouter/red-cyber-1`, reads `REDROUTER_API_KEY`, and sets the endpoint automatically. It adds published pricing and routes Chat Completions, Responses and Messages to RedRouter's native endpoints. The generic configuration above requires explicit model pricing if you need LiteLLM to calculate cost.

RedRouter's Responses API is stateless. Use `store=False` and replay the conversation; stored response retrieval, `previous_response_id` and hosted OpenAI tools are unavailable. See [RedRouter's compatibility reference](https://docs.redrouter.org/compatibility) before changing API protocols.

## Troubleshooting

For HTTP 401, check `REDROUTER_API_KEY` in the gateway environment. For HTTP 402, check credits or trial eligibility. For a key spending limit or HTTP 429, inspect the key and account limits. A large requested output can exceed the amount a limited key can reserve even when the eventual answer is short. See [RedRouter's troubleshooting guide](https://docs.redrouter.org/troubleshooting).
