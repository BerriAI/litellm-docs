import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# apimodels.app

## Overview

| Property | Details |
|-------|-------|
| Description | apimodels.app is a multi-model API gateway: one API key and OpenAI- and Anthropic-compatible endpoints for about 150 image, video, audio and language models. |
| Provider Route on LiteLLM | `apimodels/` |
| Link to Provider Doc | [apimodels.app Documentation ↗](https://apimodels.app/docs) |
| Base URL | `https://api.apimodels.app/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#anthropic-messages-api) |

<br />
<br />

**We support ALL apimodels.app language models, just set `apimodels/` as a prefix when sending requests**

## Available Models

`GET https://api.apimodels.app/v1/models` lists every model id. Language models include, for example:

| Model | Description |
|-------|-------------|
| `apimodels/claude-opus-5-5` | Claude Opus 5.5 |
| `apimodels/claude-sonnet-5-5` | Claude Sonnet 5.5 |
| `apimodels/gpt-6.1-sol` | GPT-6.1 Sol |
| `apimodels/gemini-3.1-pro-preview` | Gemini 3.1 Pro Preview |
| `apimodels/deepseek-v4.1-flash` | DeepSeek V4.1 Flash |
| `apimodels/grok-4.6` | Grok 4.6 |

LiteLLM does not ship apimodels.app pricing, so for spend tracking pass `input_cost_per_token` and `output_cost_per_token` in `litellm_params`. Current prices are on each model page at [apimodels.app/models](https://apimodels.app/models).

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["APIMODELS_API_KEY"] = ""  # your apimodels.app API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="apimodels.app Non-streaming Completion"
import os
from litellm import completion

os.environ["APIMODELS_API_KEY"] = ""  # your apimodels.app API key

response = completion(
    model="apimodels/claude-opus-5-5",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)

print(response)
```

### Streaming

```python showLineNumbers title="apimodels.app Streaming Completion"
import os
from litellm import completion

os.environ["APIMODELS_API_KEY"] = ""  # your apimodels.app API key

response = completion(
    model="apimodels/claude-sonnet-5-5",
    messages=[{"content": "Write a short story about AI", "role": "user"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Responses API

`litellm.responses` calls are bridged to apimodels.app chat completions, so they work for every language model on it, including Claude.

```python showLineNumbers title="apimodels.app Responses API"
import os
import litellm

os.environ["APIMODELS_API_KEY"] = ""  # your apimodels.app API key

response = litellm.responses(
    model="apimodels/claude-opus-5-5",
    input="Say hello",
)

print(response.output_text)
```

### Anthropic Messages API

`litellm.anthropic.messages.acreate` calls are bridged to apimodels.app chat completions the same way.

```python showLineNumbers title="apimodels.app Anthropic Messages API"
import asyncio
import os
import litellm

os.environ["APIMODELS_API_KEY"] = ""  # your apimodels.app API key

async def main():
    response = await litellm.anthropic.messages.acreate(
        model="apimodels/claude-sonnet-5-5",
        messages=[{"role": "user", "content": "Say hello"}],
        max_tokens=64,
    )
    print(response["content"][0]["text"])

asyncio.run(main())
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-opus-5-5
    litellm_params:
      model: apimodels/claude-opus-5-5
      api_key: os.environ/APIMODELS_API_KEY
  - model_name: gpt-6.1-sol
    litellm_params:
      model: apimodels/gpt-6.1-sol
      api_key: os.environ/APIMODELS_API_KEY
```

A deployment configured this way serves all three endpoints on the proxy: `/v1/chat/completions`, `/v1/responses`, and `/v1/messages`.

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-5-5",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="responses" label="Responses">

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/responses \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-5-5",
    "input": "Hello, how are you?"
  }'
```

</TabItem>
<TabItem value="messages" label="Messages">

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/messages \
  -H "x-api-key: $LITELLM_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-5-5",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["APIMODELS_API_BASE"] = "https://api.apimodels.app/v1"
os.environ["APIMODELS_API_KEY"] = ""  # your API key

response = completion(
    model="apimodels/claude-opus-5-5",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="apimodels/claude-opus-5-5",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://api.apimodels.app/v1",
    api_key="your-api-key",
)
```

## Supported OpenAI Parameters

Which parameters take effect depends on the underlying model.

- `temperature`
- `max_tokens`
- `max_completion_tokens`
- `top_p`
- `stop`
- `stream`
- `stream_options`
- `tools`
- `tool_choice`
- `response_format`
- `reasoning_effort`
