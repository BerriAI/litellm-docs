import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# OceanToken

## Overview

| Property | Details |
|-------|-------|
| Description | OceanToken is a pay-as-you-go API for models from many labs (DeepSeek, Qwen, Kimi, MiniMax, Claude, GPT, Gemini and others) with one API key and a prepaid balance. |
| Provider Route on LiteLLM | `oceantoken/` |
| Link to Provider Doc | [OceanToken docs ↗](https://docs.oceantoken.ai) |
| Base URL | `https://api.oceantoken.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#anthropic-messages-api) |

<br />
<br />

**We support ALL OceanToken chat models, just set `oceantoken/` as a prefix when sending requests**

## Available Models

Model ids keep their publisher prefix, so the full LiteLLM model name has two slashes, e.g. `oceantoken/deepseek/deepseek-v4-pro`. The [OceanToken models page](https://docs.oceantoken.ai/models) lists every model with its current price, and `GET https://api.oceantoken.ai/v1/models` returns the ids your key can use. A few examples:

| Model | Context |
|-------|---------|
| `oceantoken/deepseek/deepseek-v4-pro` | 1M |
| `oceantoken/deepseek/deepseek-v4-flash` | 1M |
| `oceantoken/moonshotai/kimi-k3` | 1M |
| `oceantoken/anthropic/claude-sonnet-5.5` | 1M |
| `oceantoken/openai/gpt-5.5` | 1M |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["OCEANTOKEN_API_KEY"] = ""  # your OceanToken API key
os.environ["OCEANTOKEN_API_BASE"] = ""  # optional, defaults to https://api.oceantoken.ai/v1
```

Create a key in the OceanToken console after you sign up at [app.oceantoken.ai](https://app.oceantoken.ai/ui/signup/) and add credit. A key can carry its own credit limit if you want to cap what LiteLLM can spend.

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="OceanToken Non-streaming Completion"
import os
from litellm import completion

os.environ["OCEANTOKEN_API_KEY"] = ""  # your OceanToken API key

response = completion(
    model="oceantoken/deepseek/deepseek-v4-pro",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="OceanToken Streaming Completion"
import os
from litellm import completion

os.environ["OCEANTOKEN_API_KEY"] = ""  # your OceanToken API key

response = completion(
    model="oceantoken/deepseek/deepseek-v4-flash",
    messages=[{"role": "user", "content": "Write a short story about AI"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Responses API

OceanToken serves `/v1/responses`, so `litellm.responses` calls are sent to it as is.

```python showLineNumbers title="OceanToken Responses API"
import os
import litellm

os.environ["OCEANTOKEN_API_KEY"] = ""  # your OceanToken API key

response = litellm.responses(
    model="oceantoken/openai/gpt-5.5",
    input="Say hello",
)

print(response.output_text)
```

### Anthropic Messages API

OceanToken also serves the Anthropic Messages API at `/v1/messages`, so `litellm.anthropic.messages` calls reach it in Anthropic format without a translation to chat completions.

```python showLineNumbers title="OceanToken Messages API"
import asyncio
import os
import litellm

os.environ["OCEANTOKEN_API_KEY"] = ""  # your OceanToken API key


async def main():
    response = await litellm.anthropic.messages.acreate(
        model="oceantoken/anthropic/claude-sonnet-5.5",
        messages=[{"role": "user", "content": "Say hello"}],
        max_tokens=64,
    )
    print(response["content"][0]["text"])


asyncio.run(main())
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4-pro
    litellm_params:
      model: oceantoken/deepseek/deepseek-v4-pro
      api_key: os.environ/OCEANTOKEN_API_KEY
  - model_name: claude-sonnet-5.5
    litellm_params:
      model: oceantoken/anthropic/claude-sonnet-5.5
      api_key: os.environ/OCEANTOKEN_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export OCEANTOKEN_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-oceantoken"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="OceanToken via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-oceantoken",
)

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="messages" label="Messages">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/messages \
  -H "x-api-key: $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-5.5",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

You can also add OceanToken from the Admin UI. Go to Models, then Add Model, pick OceanToken as the provider, enter an `oceantoken/` model id, and paste your key.

## Cost Tracking

OceanToken models are not yet in LiteLLM's model cost map, so spend is not computed automatically. OceanToken bills each call per token at the rate shown on its [models page](https://docs.oceantoken.ai/models). Pass that rate as `input_cost_per_token` and `output_cost_per_token` on the deployment and LiteLLM will track spend for it, returning the amount in the `x-litellm-response-cost` response header and recording it in spend logs. The models page lists rates per million tokens; divide by 1,000,000 for the per-token value.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4-pro
    litellm_params:
      model: oceantoken/deepseek/deepseek-v4-pro
      api_key: os.environ/OCEANTOKEN_API_KEY
      input_cost_per_token: 0.00000115   # $1.15 / 1M
      output_cost_per_token: 0.00000255  # $2.55 / 1M
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["OCEANTOKEN_API_BASE"] = "https://custom.oceantoken.example/v1"
os.environ["OCEANTOKEN_API_KEY"] = ""  # your API key

response = completion(
    model="oceantoken/deepseek/deepseek-v4-pro",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="oceantoken/deepseek/deepseek-v4-pro",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="https://custom.oceantoken.example/v1",
    api_key="your-api-key",
)
```
