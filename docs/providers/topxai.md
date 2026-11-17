---
title: TopxAI
description: Call TopxAI through LiteLLM with one API key. Configure chat, Responses, current model IDs and route-specific token prices.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# TopxAI

https://api.topxai.xyz/docs

:::tip

Use `model="topxai/<model-id>"` for the text models below. This prefix requires a LiteLLM build that includes the [TopxAI provider](https://github.com/BerriAI/litellm/pull/41919).

:::

| Property | Details |
|-------|-------|
| Description | One OpenAI- and Anthropic-compatible endpoint for Claude, GPT and Grok, and private GLM, Kimi and DeepSeek deployments, at fixed USD prices on prepaid credit. TopxAI processes prompts and completions in memory. Its usage log stores request metadata. Upstream providers have their own retention policies. [TopxAI usage logs](https://api.topxai.xyz/docs/reading-your-usage-log) |
| Provider Route on LiteLLM | `topxai/` |
| Supported Endpoints | `/chat/completions`, `/responses` |
| API Reference | [TopxAI API reference](https://api.topxai.xyz/docs/api-reference) |

## Required Variables

Create a [TopxAI API key](https://api.topxai.xyz/keys) and set it in the shell that runs LiteLLM.

```bash showLineNumbers title="Environment Variables"
export TOPXAI_API_KEY="your-topxai-api-key"
```

`TOPXAI_API_BASE` overrides the default base URL `https://api.topxai.xyz/v1`.

## Available Models

The live table is at https://api.topxai.xyz/pricing and as JSON at `GET https://api.topxai.xyz/api/pricing`. All twelve model IDs and their Auto-route input and output prices were checked on November 18, 2026. Prices are USD per million tokens.

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| `topxai/claude-sonnet-5-5` | $1 | $5 | 1M context; prompt caching through `anthropic/` (see Notes) |
| `topxai/claude-opus-5-5` | $2 | $10 | 1M context; prompt caching through `anthropic/` (see Notes) |
| `topxai/claude-fable-5-2` | $4 | $20 | 1M context; prompt caching through `anthropic/` (see Notes) |
| `topxai/gpt-6.1-terra` | $0.50 | $2.50 | from 272,001 input tokens the whole request bills at $1 / $3.75; also on `/responses` |
| `topxai/gpt-6.2-sol` | $1 | $5 | from 272,001 input tokens the whole request bills at $2 / $7.50; also on `/responses` |
| `topxai/gpt-6.2-astra` | $4 | $20 | from 272,001 input tokens the whole request bills at $8 / $30; also on `/responses` |
| `topxai/grok-4.7` | $1 | $3 | from 200,000 input tokens the whole request bills at $2 / $6; also on `/responses` |
| `topxai/kimi-k3.1-pro` | $0.50 | $5 | 1,048,576 context; 131,072 output; private deployment; also on `/responses` |
| `topxai/deepseek-flash-Abliterated` | $0.42 | $1.50 | 1,048,576 context; 131,072 output; private deployment; also on `/responses` |
| `topxai/deepseek-flash-fast` | $0.02 | $0.16 | 1,048,576 context; 262,144 output; DeepSeek V4.1 Flash on standard weights, private deployment; also on `/responses` |
| `topxai/GLM-5.3-Abliterated` | $3 | $6 | text only; a fine-tuned GLM-5.3 served from a private deployment, not Z.ai's API |
| `topxai/GLM-5.3-Flash-Abliterated` | $0.36 | $1.50 | 1,048,576 context; 131,072 output; text and images; private deployment; also on `/responses` |

A key on TopxAI's Auto route sends each request to the lowest-priced line that serves the model. For Claude, GPT and Grok that is normally the shared pool at 50% of the provider's list price. Keys pinned to their official line pay 90% of list instead. The GLM, Kimi and DeepSeek models are private deployments with their own fixed prices, rather than the original providers' APIs.

Cost tracking in LiteLLM uses the Auto-route prices above. For a key pinned to an official Claude, GPT or Grok line, set that line's prices as described in [Custom Pricing](../proxy/custom_pricing). The DeepSeek models do not use the original DeepSeek model's peak and off-peak schedule.

Cache reads cost $0.30 per million tokens on Kimi, $0.105 on DeepSeek Abliterated, $0.004 on DeepSeek Flash Fast, $0.45 on GLM-5.3-Abliterated and $0.075 on GLM-5.3-Flash-Abliterated. These five publish no cache-write price; caching is automatic. The cost map also includes the published Claude, GPT and Grok cache prices, including Claude's one-hour writes.

Kimi K3.1 Pro always reasons, with `low`, `high` and `max` efforts and `low` as the default. Send images as base64 data URIs. Kimi does not fetch public image URLs. To select one function, pass a `tool_choice` object with `type="function"` and the name in `function.name`. Kimi ignores `tool_choice="none"`, `tool_choice="required"` and the `json_schema` response format. For JSON output, use `json_object` and validate the result in your application. See the [Kimi model guide](https://api.topxai.xyz/docs/kimi-k3-1-pro).

`kimi-k3`, `deepseek-flash`, `deepseek-v4-pro` and `claude-fable-5-1` are retired; Claude Fable 5.2 replaced Fable 5.1 on November 10, 2026. On November 18, `gpt-6.2-astra` replaced `gpt-6-astra` and `gpt-6.2-sol` replaced `gpt-6.1-sol`. Select a current model explicitly. TopxAI rejects retired IDs with HTTP 403 and does not alias them to a replacement.

## Usage - LiteLLM Python SDK

### Text Generation

```python keep-model-ids showLineNumbers title="TopxAI Text Generation"
from litellm import completion

response = completion(
    model="topxai/claude-sonnet-5-5",
    messages=[{"role": "user", "content": "What is LiteLLM?"}]
)
print(response)
```

```python keep-model-ids showLineNumbers title="TopxAI Text Generation - Streaming"
from litellm import completion

stream = completion(
    model="topxai/gpt-6.2-sol",
    messages=[{"role": "user", "content": "What is LiteLLM?"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

### Responses API

The GPT models, `grok-4.7`, `kimi-k3.1-pro`, both DeepSeek models and `GLM-5.3-Flash-Abliterated` are also served on `/v1/responses`. For the GLM, Kimi and DeepSeek models, supply the conversation in `input` and set `store=False`; server-side conversation persistence has not been verified.

```python keep-model-ids showLineNumbers title="TopxAI Responses API"
import litellm

response = litellm.responses(
    model="topxai/gpt-6.2-sol",
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
  - model_name: topxai/gpt-6.2-sol
    litellm_params:
      model: topxai/gpt-6.2-sol
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
    base_url="http://localhost:4000/v1"
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
curl http://localhost:4000/v1/chat/completions \
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

- The current Claude models accept automatic tool selection or `tool_choice="none"`. They reject `required` and forced named-tool calls with HTTP 400. For structured output, use a JSON Schema response format and validate the result in your application; Claude accepts a subset of JSON Schema. See the [structured-output guide](https://api.topxai.xyz/docs/use-topxai-with-langchain).
- The endpoint table above lists the native TopxAI transports used by this provider. LiteLLM's generated endpoint matrix also marks protocol bridges to Chat Completions; those flags do not mean TopxAI exposes those additional endpoints directly.
- Claude models are also served on TopxAI's Anthropic Messages endpoint; use `model="anthropic/claude-sonnet-5-5"` with `api_base="https://api.topxai.xyz"` and your TopxAI key as `api_key` when you want the Messages request shape with `cache_control` breakpoints. LiteLLM prices those calls at Anthropic's list price, twice the shared-pool price, unless you set TopxAI's prices through [Custom Pricing](../proxy/custom_pricing).
- Image generation (`gpt-image-2.6-sunburst`, `gpt-image-2.6-flare`), video generation and TypeSafe's Jev (`/v1/systemone`) are outside the `topxai/` route; see the [API reference](https://api.topxai.xyz/docs/api-reference).
