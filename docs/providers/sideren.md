import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Sideren

## Overview

| Property | Details |
|-------|-------|
| Description | Sideren serves open and frontier coding models (DeepSeek, GLM, Kimi, MiniMax, Qwen, GPT, Gemini, Grok and more) over one OpenAI-compatible API. |
| Provider Route on LiteLLM | `sideren/` |
| Link to Provider Doc | [Sideren docs ↗](https://docs.sideren.io) |
| Base URL | `https://api.sideren.io/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#usage---litellm-proxy-server) |

<br />
<br />

**We support ALL Sideren models, just set `sideren/` as a prefix when sending requests**

## Available Models

Model ids are Sideren's public ids. `GET https://api.sideren.io/v1/models` lists every model your key can call.

| Model | Context |
|-------|---------|
| `sideren/@sdn/deepseek-v4.1-flash-1017` | 272k |
| `sideren/gpt-6-luna` | 272k |
| `sideren/@sdn/minimax-m3.1-flash` | 300k |
| `sideren/@sdn/kimi-k2.5` | 262k |
| `sideren/@sdn/qwen3-coder-next` | 262k |
| `sideren/@sdn/minimax-m2.5` | 196k |
| `sideren/@sdn/gpt-oss-120b` | 128k |
| `sideren/@sdn/devstral-2-123b` | 262k |
| `sideren/@sdn/glm-5.3` | 1M |
| `sideren/@sdn/glm-5.3-flash` | 1M |
| `sideren/@sdn/glm-5.2` | 131k |
| `sideren/@sdn/deepseek-v4-pro` | 1M |
| `sideren/@sdn/deepseek-v4-flash` | 1M |
| `sideren/@sdn/kimi-k2.7-code` | 131k |
| `sideren/@sdn/qwen3.8-27b` | 262k |
| `sideren/gpt-6-sol` | 272k |
| `sideren/gpt-5.6-terra` | 272k |
| `sideren/gpt-5.3-codex` | 400k |
| `sideren/gpt-5.4` | 272k |
| `sideren/gpt-5.4-mini` | 400k |
| `sideren/gemini-3.8-flash` | 1M |
| `sideren/mistral-medium-3.5` | 256k |
| `sideren/gpt-6.1-sol` | 272k |
| `sideren/gpt-5.6-sol` | 272k |
| `sideren/grok-4.7` | 200k |
| `sideren/grok-4.6` | 500k |
| `sideren/grok-4.1-fast` | 2M |
| `sideren/muse-spark-1.3` | 1M |
| `sideren/muse-wonder-1.0` | 1M |
| `sideren/gpt-6-astra` | 272k |
| `sideren/gpt-5.5` | 272k |
| `sideren/gemini-4-argon` | 1M |

Which models a key can call depends on its plan ([Sideren pricing](https://sideren.io/pricing)).

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["SIDEREN_API_KEY"] = ""  # your Sideren API key
os.environ["SIDEREN_API_BASE"] = ""  # optional, defaults to https://api.sideren.io/v1
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Sideren Non-streaming Completion"
import os
from litellm import completion

os.environ["SIDEREN_API_KEY"] = ""  # your Sideren API key

response = completion(
    model="sideren/@sdn/deepseek-v4.1-flash-1017",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Sideren Streaming Completion"
import os
from litellm import completion

os.environ["SIDEREN_API_KEY"] = ""  # your Sideren API key

response = completion(
    model="sideren/@sdn/glm-5.3",
    messages=[{"role": "user", "content": "Write a short story about AI"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Tool calling

Every model listed above supports tool calls.

```python showLineNumbers title="Sideren Tool Calling"
import os
from litellm import completion

os.environ["SIDEREN_API_KEY"] = ""  # your Sideren API key

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Current weather for a city",
        "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
    },
}]

response = completion(
    model="sideren/@sdn/glm-5.3",
    messages=[{"role": "user", "content": "What is the weather in Paris?"}],
    tools=tools,
)

print(response.choices[0].message.tool_calls)
```

### Responses API

Sideren serves `/v1/responses` natively, so `litellm.responses` calls go straight to it.

```python showLineNumbers title="Sideren Responses API"
import os
import litellm

os.environ["SIDEREN_API_KEY"] = ""  # your Sideren API key

response = litellm.responses(
    model="sideren/@sdn/deepseek-v4.1-flash-1017",
    input="Say hello",
)

print(response.output_text)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4.1-flash
    litellm_params:
      model: sideren/@sdn/deepseek-v4.1-flash-1017
      api_key: os.environ/SIDEREN_API_KEY
  - model_name: glm-5.3
    litellm_params:
      model: sideren/@sdn/glm-5.3
      api_key: os.environ/SIDEREN_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export SIDEREN_API_KEY="your-api-key"
export LITELLM_MASTER_KEY="sk-local-sideren"
litellm --config config.yaml --port 4000

# RUNNING on http://0.0.0.0:4000
```

A deployment configured this way serves `/v1/chat/completions`, `/v1/responses`, and `/v1/messages` on the proxy.

<Tabs>
<TabItem value="chat" label="Chat Completions">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-5.3",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="messages" label="Messages">

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/messages \
  -H "x-api-key: $LITELLM_MASTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-5.3",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

You can also add Sideren from the Admin UI. Go to Models, then Add Model, pick Sideren as the provider, enter a `sideren/` model id, and paste your key.

## Cost Tracking

Sideren bills by plan and credits rather than per token, so Sideren models are not in LiteLLM's model cost map and LiteLLM does not compute spend for them. Usage per key is shown in the Sideren dashboard.

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["SIDEREN_API_BASE"] = "https://custom.sideren.example/v1"
os.environ["SIDEREN_API_KEY"] = ""  # your API key

response = completion(
    model="sideren/@sdn/deepseek-v4.1-flash-1017",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="sideren/@sdn/deepseek-v4.1-flash-1017",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="https://custom.sideren.example/v1",
    api_key="your-api-key",
)
```

Passing `api_base="https://api.sideren.io/v1"` without the `sideren/` prefix also resolves to the Sideren provider and picks up `SIDEREN_API_KEY`.
