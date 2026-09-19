import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# TopxAI

https://ai.topxea.com/docs

:::tip

**We support ALL TopxAI models, just set `model=topxai/<any-model-on-topxai>` as a prefix when sending litellm requests**

:::

| Property | Details |
|-------|-------|
| Description | One OpenAI- and Anthropic-compatible endpoint for Claude, GPT, Grok, Kimi and a fine-tuned GLM at fixed USD prices on prepaid credit; prompts and completions are relayed in memory and never stored. |
| Provider Route on LiteLLM | `topxai/` |
| Supported Endpoints | `/chat/completions`, `/responses` |
| API Reference | [TopxAI API reference](https://ai.topxea.com/docs/api-reference) |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["TOPXAI_API_KEY"] = ""  # your TopxAI API key, from https://ai.topxea.com/keys
```

`TOPXAI_API_BASE` overrides the default base URL `https://ai.topxea.com/v1`.

## Available Models

The live table is at https://ai.topxea.com/pricing and as JSON at `GET https://ai.topxea.com/api/pricing`. The models registered in LiteLLM's cost map, with the Auto-route price per million tokens:

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| `topxai/claude-sonnet-5` | $1 | $5 | 1M context, prompt caching |
| `topxai/claude-opus-5` | $2.50 | $12.50 | 1M context, prompt caching |
| `topxai/claude-fable-5-1` | $5 | $25 | 1M context, prompt caching |
| `topxai/claude-fable-5` | $5 | $25 | 1M context, prompt caching |
| `topxai/gpt-5.6-sol` | $2 | $10 | whole request at 2x input from 272K input tokens; also on `/responses` |
| `topxai/gpt-6-astra` | $5 | $25 | whole request at 2x input from 272K input tokens; also on `/responses` |
| `topxai/grok-4.6` | $1 | $3 | whole request at 2x input from 200K input tokens; also on `/responses` |
| `topxai/kimi-k3` | $2.40 | $12 | 1M context |
| `topxai/GLM-5.3-Abliterated` | $4 | $7 | text only; a fine-tuned GLM-5.3 on TopxAI's private deployment |

A key on TopxAI's Auto route sends each request to the lowest-priced line that serves the model; keys pinned to the official line pay 90% of the provider's list price instead. Cost tracking in LiteLLM uses the Auto-route prices above.

## Usage - LiteLLM Python SDK

### Text Generation

```python showLineNumbers title="TopxAI Text Generation"
from litellm import completion
import os

os.environ["TOPXAI_API_KEY"] = ""  # your TopxAI API key
response = completion(
    model="topxai/claude-sonnet-5",
    messages=[{"role": "user", "content": "What is LiteLLM?"}]
)
print(response)
```

```python showLineNumbers title="TopxAI Text Generation - Streaming"
from litellm import completion
import os

os.environ["TOPXAI_API_KEY"] = ""  # your TopxAI API key
stream = completion(
    model="topxai/gpt-5.6-sol",
    messages=[{"role": "user", "content": "What is LiteLLM?"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

### Responses API

The GPT models and `grok-4.6` are also served on `/v1/responses`:

```python showLineNumbers title="TopxAI Responses API"
import litellm
import os

os.environ["TOPXAI_API_KEY"] = ""  # your TopxAI API key
response = litellm.responses(
    model="topxai/gpt-5.6-sol",
    input="What is LiteLLM?",
)
print(response)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: topxai/claude-sonnet-5
    litellm_params:
      model: topxai/claude-sonnet-5
      api_key: os.environ/TOPXAI_API_KEY
  - model_name: topxai/gpt-5.6-sol
    litellm_params:
      model: topxai/gpt-5.6-sol
      api_key: os.environ/TOPXAI_API_KEY
  - model_name: topxai/kimi-k3
    litellm_params:
      model: topxai/kimi-k3
      api_key: os.environ/TOPXAI_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy Server"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="TopxAI via Proxy - Non-streaming"
from openai import OpenAI

client = OpenAI(
    api_key="your-proxy-api-key",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="topxai/claude-sonnet-5",
    messages=[{"role": "user", "content": "What is LiteLLM?"}]
)
print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="TopxAI via Proxy - cURL"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "topxai/claude-sonnet-5",
    "messages": [{"role": "user", "content": "What is LiteLLM?"}]
  }'
```

</TabItem>
</Tabs>

## Notes

- Claude models are also served on TopxAI's Anthropic Messages endpoint; use `model="anthropic/claude-sonnet-5"` with `api_base="https://ai.topxea.com"` when you want the Messages request shape with `cache_control` breakpoints.
- Image generation (`gpt-image-2.5-sunburst`, `gpt-image-2.5-flare`), video generation and TypeSafe's Jev (`/v1/systemone`) are outside the `topxai/` route; see the [API reference](https://ai.topxea.com/docs/api-reference).
