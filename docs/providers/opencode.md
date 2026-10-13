import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OpenCode

## Overview

| Property | Details |
|-------|-------|
| Description | OpenCode runs two managed inference services: Zen, a pay-as-you-go gateway to curated models from OpenAI, Anthropic, Google and others, and Go, a subscription covering open coding models. |
| Provider Route on LiteLLM | `opencode/` for Zen, `opencode_go/` for Go |
| Link to Provider Doc | [OpenCode Zen ↗](https://opencode.ai/docs/zen) and [OpenCode Go ↗](https://opencode.ai/docs/go) |
| Base URL | `https://opencode.ai/zen/v1` for Zen, `https://opencode.ai/zen/go/v1` for Go |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#usage---litellm-python-sdk) |

<br />

## Required Environment Variables

One OpenCode account key authenticates both services, so a single variable covers them:

```python
import os

os.environ["OPENCODE_API_KEY"] = ""  # your OpenCode API key
```

Get a key from the [OpenCode console](https://opencode.ai/auth). Zen bills per token from a prepaid balance, Go is a monthly subscription. You never set a base URL: LiteLLM picks the right one from the model prefix.

## Usage - LiteLLM Python SDK

<Tabs>
<TabItem value="zen" label="OpenCode Zen">

```python showLineNumbers title="OpenCode Zen Completion"
import os
import litellm

os.environ["OPENCODE_API_KEY"] = ""

response = litellm.completion(
    model="opencode/claude-opus-5",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
)
print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="go" label="OpenCode Go">

```python showLineNumbers title="OpenCode Go Completion"
import os
import litellm

os.environ["OPENCODE_API_KEY"] = ""

response = litellm.completion(
    model="opencode_go/kimi-k3",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
)
print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="streaming" label="Streaming">

```python showLineNumbers title="OpenCode Streaming"
import os
import litellm

os.environ["OPENCODE_API_KEY"] = ""

for chunk in litellm.completion(
    model="opencode_go/glm-5.3-flash",
    messages=[{"role": "user", "content": "Write a haiku about code."}],
    stream=True,
):
    print(chunk.choices[0].delta.content or "", end="")
```

</TabItem>
</Tabs>

## Keeping a conversation on one upstream

OpenCode requires an `x-opencode-session` header on every request, and uses it to pin a conversation to one upstream provider so its prompt cache stays warm. LiteLLM always sends the header, but it can only keep the value stable across turns if you tell it which turns belong together. Pass `litellm_session_id` for that:

```python showLineNumbers title="Stable session across turns"
import litellm

session_id = "conversation-42"

first = litellm.completion(
    model="opencode_go/kimi-k3",
    messages=[{"role": "user", "content": "Summarise this repo."}],
    litellm_session_id=session_id,
)

second = litellm.completion(
    model="opencode_go/kimi-k3",
    messages=[{"role": "user", "content": "Now list its dependencies."}],
    litellm_session_id=session_id,
)
```

Without `litellm_session_id`, LiteLLM falls back to `metadata.session_id`, then the trace id, then the per-request call id. The header is always present, so requests never fail, but each turn looks like a new conversation to OpenCode and you lose the cache discount.

## Usage - LiteLLM Proxy

Add OpenCode models to your `config.yaml`:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: kimi-k3
    litellm_params:
      model: opencode_go/kimi-k3
      api_key: os.environ/OPENCODE_API_KEY

  - model_name: claude-opus-5
    litellm_params:
      model: opencode/claude-opus-5
      api_key: os.environ/OPENCODE_API_KEY
```

Start the proxy:

```bash
litellm --config config.yaml
```

Send a request:

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-1234" \
  -d '{
    "model": "kimi-k3",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "litellm_session_id": "conversation-42"
  }'
```

## Available Models

OpenCode moves models in and out regularly, so treat the live lists as authoritative rather than any table here:

- Zen: https://opencode.ai/zen/v1/models
- Go: https://opencode.ai/zen/go/v1/models

Use the model id exactly as those endpoints report it, with the provider prefix in front. `opencode/gpt-5.6-luna` and `opencode_go/minimax-m3` are both valid.

## Endpoint routing

OpenCode serves different models on different API shapes, and the split is per model rather than per family. On Go, for instance, qwen and minimax are served on the Anthropic-shaped endpoint while glm, kimi and deepseek are served on the OpenAI-compatible one. LiteLLM records each model's endpoint alongside its pricing and routes accordingly, so you call every model the same way and do not need to know which shape it uses.

Calling a model on the wrong endpoint yourself returns a 500, or a `not supported for format oa-compat` error.

## Cost tracking

Pricing for every model on both services ships with LiteLLM, including the higher rates that apply above a model's context tier, so spend appears on the proxy's logs page without extra configuration.

Two things to know. OpenCode Go is a monthly subscription with usage caps, and its API reports a cost of zero on each request; LiteLLM still tracks the published per-token rates, so reported spend reflects usage rather than what the subscription charges you. DeepSeek models are also billed at a higher rate during peak UTC hours, and the shipped rates are the off-peak ones.
