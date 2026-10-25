---
title: TopxAI
description: Call TopxAI through LiteLLM with one API key. Configure chat, Responses, current model IDs and route-specific token prices.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# TopxAI

https://ai.topxea.com/docs

:::tip

**We support ALL TopxAI chat models, just set `model=topxai/<any-model-on-topxai>` as a prefix when sending litellm requests**

:::

| Property | Details |
|-------|-------|
| Description | One OpenAI- and Anthropic-compatible endpoint for Claude, GPT, Grok, Kimi, and private DeepSeek and GLM deployments, at fixed USD prices on prepaid credit; prompts and completions are relayed in memory and never stored. |
| Provider Route on LiteLLM | `topxai/` |
| Supported Endpoints | `/chat/completions`, `/responses` |
| API Reference | [TopxAI API reference](https://ai.topxea.com/docs/api-reference) |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["TOPXAI_API_KEY"] = ""  # your TopxAI API key, from https://ai.topxea.com/keys
```

`TOPXAI_API_BASE` overrides the default base URL `https://ai.topxea.com/v1`.

## Available Models

The live table is at https://ai.topxea.com/pricing and as JSON at `GET https://ai.topxea.com/api/pricing`. The following models and Auto-route prices were verified on October 25, 2026. Prices are USD per million tokens.

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| `topxai/claude-sonnet-5-5` | $1 | $5 | 1M context; prompt caching through `anthropic/` (see Notes) |
| `topxai/claude-opus-5-5` | $2 | $10 | 1M context; prompt caching through `anthropic/` (see Notes) |
| `topxai/claude-fable-5-1` | $5 | $25 | 1M context; prompt caching through `anthropic/` (see Notes) |
| `topxai/gpt-6.1-sol` | $1 | $5 | from 272,001 input tokens the whole request bills at $2 / $7.50; also on `/responses` |
| `topxai/gpt-6-astra` | $5 | $25 | from 272,001 input tokens the whole request bills at $10 / $37.50; also on `/responses` |
| `topxai/grok-4.7` | $1 | $3 | from 200,000 input tokens the whole request bills at $2 / $6; also on `/responses` |
| `topxai/kimi-k3.1-pro` | $2.40 | $12 | 1,048,576 context; 131,072 output; also on `/responses` |
| `topxai/deepseek-flash-Abliterated` | $1.20 | $2.40 | 1,048,576 context; 262,144 output; private deployment; also on `/responses` |
| `topxai/GLM-5.3-Abliterated` | $4 | $7 | text only; a fine-tuned GLM-5.3 served from a private deployment, not Z.ai's API |

A key on TopxAI's Auto route sends each request to the lowest-priced line that serves the model. For Claude, GPT and Grok that is normally the shared pool at 50% of the provider's list price. Keys pinned to their official line pay 90% of list instead. Kimi K3.1 Pro has one official line at 120% of Kimi's current list price. GLM-5.3-Abliterated and deepseek-flash-Abliterated are private deployments with their own fixed prices, rather than the original providers' APIs.

Cost tracking in LiteLLM uses the Auto-route prices above. For a key pinned to an official Claude, GPT or Grok line, set that line's prices as described in [Custom Pricing](../proxy/custom_pricing). DeepSeek Abliterated does not use the original DeepSeek model's peak and off-peak schedule.

Kimi's cache read and default five-minute cache write cost $0.24 and $2.40 per million tokens. DeepSeek Abliterated cache reads cost $0.15 per million tokens. The cost map also includes the published Claude, GPT and Grok cache prices, including Claude's one-hour writes.

Kimi K3.1 Pro always reasons, with `low`, `high` and `max` efforts and `max` as the default. Use base64 data URIs for images. Public image URLs, forced named-tool calls and strict response schemas are not covered by this integration's verified capabilities. See the [Kimi model guide](https://ai.topxea.com/docs/kimi-k3-1-pro).

`kimi-k3`, `deepseek-flash` and `deepseek-v4-pro` are retired. Select a current model explicitly. TopxAI rejects retired IDs with HTTP 403 and does not alias them to a replacement.

## Usage - LiteLLM Python SDK

### Text Generation

```python keep-model-ids showLineNumbers title="TopxAI Text Generation"
from litellm import completion
import os

os.environ["TOPXAI_API_KEY"] = ""  # your TopxAI API key
response = completion(
    model="topxai/claude-sonnet-5-5",
    messages=[{"role": "user", "content": "What is LiteLLM?"}]
)
print(response)
```

```python keep-model-ids showLineNumbers title="TopxAI Text Generation - Streaming"
from litellm import completion
import os

os.environ["TOPXAI_API_KEY"] = ""  # your TopxAI API key
stream = completion(
    model="topxai/gpt-6.1-sol",
    messages=[{"role": "user", "content": "What is LiteLLM?"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

### Responses API

The GPT models, `grok-4.7`, `kimi-k3.1-pro` and `deepseek-flash-Abliterated` are also served on `/v1/responses`. For Kimi, supply the conversation in `input` and set `store=False`; server-side conversation persistence has not been verified.

```python keep-model-ids showLineNumbers title="TopxAI Responses API"
import litellm
import os

os.environ["TOPXAI_API_KEY"] = ""  # your TopxAI API key
response = litellm.responses(
    model="topxai/gpt-6.1-sol",
    input="What is LiteLLM?",
    store=False,
)
print(response)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml keep-model-ids showLineNumbers title="config.yaml"
model_list:
  - model_name: topxai/claude-sonnet-5-5
    litellm_params:
      model: topxai/claude-sonnet-5-5
      api_key: os.environ/TOPXAI_API_KEY
  - model_name: topxai/gpt-6.1-sol
    litellm_params:
      model: topxai/gpt-6.1-sol
      api_key: os.environ/TOPXAI_API_KEY
  - model_name: topxai/kimi-k3.1-pro
    litellm_params:
      model: topxai/kimi-k3.1-pro
      api_key: os.environ/TOPXAI_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy Server"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python keep-model-ids showLineNumbers title="TopxAI via Proxy - Non-streaming"
from openai import OpenAI

client = OpenAI(
    api_key="your-proxy-api-key",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="topxai/claude-sonnet-5-5",
    messages=[{"role": "user", "content": "What is LiteLLM?"}]
)
print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash keep-model-ids showLineNumbers title="TopxAI via Proxy - cURL"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "topxai/claude-sonnet-5-5",
    "messages": [{"role": "user", "content": "What is LiteLLM?"}]
  }'
```

</TabItem>
</Tabs>

## Notes

- Claude models are also served on TopxAI's Anthropic Messages endpoint; use `model="anthropic/claude-sonnet-5-5"` with `api_base="https://ai.topxea.com"` and your TopxAI key as `api_key` when you want the Messages request shape with `cache_control` breakpoints. LiteLLM prices those calls at Anthropic's list price, twice the shared-pool price, unless you set TopxAI's prices through [Custom Pricing](../proxy/custom_pricing).
- Image generation (`gpt-image-2.5-sunburst`, `gpt-image-2.5-flare`), video generation and TypeSafe's Jev (`/v1/systemone`) are outside the `topxai/` route; see the [API reference](https://ai.topxea.com/docs/api-reference).
