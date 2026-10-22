import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# superbot

[superbot](https://superbot.gg/?utm_source=litellm&utm_medium=registry&utm_campaign=default-slots) is your own AI agent: anything you can do on your computer, it can do, fast, and it runs your recurring tasks on a schedule across all your devices. It also has an OpenAI-compatible API, which is what this page covers.

Try superbot in your browser first: [superbot.gg/chat](https://superbot.gg/chat?utm_source=litellm&utm_medium=registry&utm_campaign=default-slots) is free and needs no account.

## Overview

| Property | Details |
|-------|-------|
| Description | superbot serves its own models and the models on your superbot account over one OpenAI-compatible and Anthropic-compatible API, with one caller key. |
| Provider Route on LiteLLM | `superbot-gg/` |
| Link to Provider Doc | [superbot API ↗](https://superbot.gg/api?utm_source=litellm&utm_medium=registry&utm_campaign=default-slots) |
| Base URL | `https://api.superbot.gg/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#usage---litellm-proxy-server) |

<br />
<br />

**We support the models `GET /v1/models` lists for your key. Set `superbot-gg/` as a prefix when sending requests.**

## Available Models

| Model | Context | Max output | Reasoning effort |
|-------|---------|------------|------------------|
| `superbot-gg/superbot` | 1M | 131,072 | `none`, `low`, `high`, `xhigh`, `max` (default `high`) |
| `superbot-gg/superbot-fast` | 500k | 131,072 | `none`, `low` (default `low`) |

Both models are in LiteLLM's model cost map at superbot's list prices. `GET /v1/models` with your key lists everything else the key can call.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["SUPERBOT_API_KEY"] = ""  # your superbot caller key, it starts with sbc_
os.environ["SUPERBOT_API_BASE"] = ""  # optional, defaults to https://api.superbot.gg/v1
```

Create a caller key under **Account > API** on [superbot.gg](https://superbot.gg/api?utm_source=litellm&utm_medium=registry&utm_campaign=default-slots).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="superbot Non-streaming Completion"
import os
from litellm import completion

os.environ["SUPERBOT_API_KEY"] = ""  # your superbot caller key

response = completion(
    model="superbot-gg/superbot",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="superbot Streaming Completion"
import os
from litellm import completion

os.environ["SUPERBOT_API_KEY"] = ""  # your superbot caller key

response = completion(
    model="superbot-gg/superbot-fast",
    messages=[{"role": "user", "content": "Write a short story about AI"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Reasoning effort

Send the effort in the request's own field. `superbot` runs at `high` when the request names none.

```python showLineNumbers title="superbot Reasoning Effort"
import os
from litellm import completion

os.environ["SUPERBOT_API_KEY"] = ""  # your superbot caller key

response = completion(
    model="superbot-gg/superbot",
    messages=[{"role": "user", "content": "Plan a three step migration"}],
    reasoning_effort="low",
)

print(response.choices[0].message.content)
```

### Responses API

LiteLLM translates `litellm.responses` calls into superbot chat completions and converts the result back into a Responses API object. superbot also answers `/v1/responses` itself.

```python showLineNumbers title="superbot Responses API"
import os
import litellm

os.environ["SUPERBOT_API_KEY"] = ""  # your superbot caller key

response = litellm.responses(
    model="superbot-gg/superbot",
    input="Say hello",
)

print(response.output_text)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: superbot
    litellm_params:
      model: superbot-gg/superbot
      api_key: os.environ/SUPERBOT_API_KEY
  - model_name: superbot-fast
    litellm_params:
      model: superbot-gg/superbot-fast
      api_key: os.environ/SUPERBOT_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export SUPERBOT_API_KEY="your-caller-key"
export LITELLM_MASTER_KEY="sk-local-superbot"
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
    "model": "superbot",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="superbot via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-superbot",
)

response = client.chat.completions.create(
    model="superbot",
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
    "model": "superbot-fast",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

You can also add superbot from the Admin UI. Go to Models, then Add Model, pick `superbot` as the provider, enter a `superbot-gg/superbot` or `superbot-gg/superbot-fast` model id, and paste your key.

## Cost Tracking

`superbot-gg/superbot` and `superbot-gg/superbot-fast` are in the model cost map, so LiteLLM computes spend and returns it in the `x-litellm-response-cost` response header. The rates are the API and MCP lane list prices on [superbot.gg/pricing](https://superbot.gg/pricing?utm_source=litellm&utm_medium=registry&utm_campaign=default-slots), in US dollars per 1M tokens: input 1.00, output 5.00, cache read 0.05, cache write 1.25. Reasoning tokens bill as output. Fast mode bills 2x every rate. Ask for it with `service_tier="priority"`.

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["SUPERBOT_API_BASE"] = "https://custom.superbot.example/v1"
os.environ["SUPERBOT_API_KEY"] = ""  # your API key

response = completion(
    model="superbot-gg/superbot",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="superbot-gg/superbot",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="https://custom.superbot.example/v1",
    api_key="your-api-key",
)
```

Passing `api_base="https://api.superbot.gg/v1"` without the `superbot-gg/` prefix also resolves to the superbot provider, so `model="superbot"` with that base URL is routed to the superbot provider and picks up `SUPERBOT_API_KEY`.
