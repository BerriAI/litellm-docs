import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AI Stupid Level

## Overview

| Property | Details |
|-------|-------|
| Description | AI Stupid Level is an OpenAI-compatible router. It sends each request to the model that currently scores best on continuously re-run coding, reasoning and tool-use benchmarks, using your own provider keys (OpenAI, Anthropic, Google, DeepSeek, Kimi, GLM). |
| Provider Route on LiteLLM | `aistupidlevel/` |
| Link to Provider Doc | [AI Stupid Level Router API ↗](https://aistupidlevel.info/router/docs) |
| Base URL | `https://aistupidlevel.info/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#usage---litellm-proxy-server) |

<br />
<br />

**Use a routing mode as the model id, or any real model id to pin that model. Just set `aistupidlevel/` as a prefix.**

## Models

| Model | Routes to |
|-------|-----------|
| `aistupidlevel/auto-coding` | the top model on the coding benchmark |
| `aistupidlevel/auto-reasoning` | the top model on the reasoning benchmark |
| `aistupidlevel/auto-tooling` | the top model on the tool-use benchmark |
| `aistupidlevel/auto-best` | the highest combined score |
| `aistupidlevel/auto-value` | the most benchmark points per measured dollar, among models within 5 points of the best |
| `aistupidlevel/auto` | the routing strategy saved on your account |
| `aistupidlevel/claude-opus-5-5`, `aistupidlevel/gpt-6-sol`, ... | that model, without routing |

`GET https://aistupidlevel.info/v1/models` lists every routing mode and model id. The response's
`model` field is the model that actually answered, for example `aistupidlevel/claude-opus-5-5`.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["AISTUPIDLEVEL_API_KEY"] = ""  # your router key (aism_...)
os.environ["AISTUPIDLEVEL_API_BASE"] = ""  # optional, defaults to https://aistupidlevel.info/v1
```

Create a router key at [aistupidlevel.info/router/keys](https://aistupidlevel.info/router/keys) and add at least one provider key to your account.

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="AI Stupid Level Non-streaming Completion"
import os
from litellm import completion

os.environ["AISTUPIDLEVEL_API_KEY"] = ""  # your router key

response = completion(
    model="aistupidlevel/auto-coding",
    messages=[{"role": "user", "content": "Fix the off-by-one error in this loop: ..."}],
)

print(response.model)  # the model that answered
print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="AI Stupid Level Streaming Completion"
import os
from litellm import completion

os.environ["AISTUPIDLEVEL_API_KEY"] = ""  # your router key

response = completion(
    model="aistupidlevel/auto-best",
    messages=[{"role": "user", "content": "Write a short story about AI"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Tool Calling

```python showLineNumbers title="AI Stupid Level Tool Calling"
import os
from litellm import completion

os.environ["AISTUPIDLEVEL_API_KEY"] = ""  # your router key

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}]

response = completion(
    model="aistupidlevel/auto-tooling",
    messages=[{"role": "user", "content": "What is the weather in Oslo?"}],
    tools=tools,
)

print(response.choices[0].message.tool_calls)
```

A multi-turn tool loop stays on the model that started it.

### Responses API

AI Stupid Level does not serve `/v1/responses`, so LiteLLM translates `litellm.responses` calls into chat completions and converts the result back into a Responses API object.

```python showLineNumbers title="AI Stupid Level Responses API"
import os
import litellm

os.environ["AISTUPIDLEVEL_API_KEY"] = ""  # your router key

response = litellm.responses(
    model="aistupidlevel/auto-reasoning",
    input="Say hello",
)

print(response.output_text)
```

### Testing without spending

Send the header `X-ASL-Sandbox: true` to run the real routing and get a mock answer. No provider is called, no provider key is needed, and nothing is counted against your plan.

```python showLineNumbers title="Sandbox"
response = completion(
    model="aistupidlevel/auto-coding",
    messages=[{"role": "user", "content": "Hello"}],
    extra_headers={"X-ASL-Sandbox": "true"},
)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: best-coding
    litellm_params:
      model: aistupidlevel/auto-coding
      api_key: os.environ/AISTUPIDLEVEL_API_KEY
  - model_name: best-value
    litellm_params:
      model: aistupidlevel/auto-value
      api_key: os.environ/AISTUPIDLEVEL_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export AISTUPIDLEVEL_API_KEY="aism_..."
export LITELLM_MASTER_KEY="sk-local-asl"
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
    "model": "best-coding",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="AI Stupid Level via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-local-asl",
)

response = client.chat.completions.create(
    model="best-coding",
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
    "model": "best-coding",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

You can also add AI Stupid Level from the Admin UI. Go to Models, then Add Model, pick AI Stupid Level as the provider, enter an `aistupidlevel/` model id, and paste your router key.

## Cost Tracking

AI Stupid Level routes to a different model per request and uses your own provider keys, so the token cost is billed by the provider that answered, to your own provider account. The router itself is a subscription. Routing modes are therefore not in LiteLLM's model cost map. To track spend for a pinned model, set `input_cost_per_token` and `output_cost_per_token` on that deployment.

## Custom API Base

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["AISTUPIDLEVEL_API_BASE"] = "https://custom.example/v1"
os.environ["AISTUPIDLEVEL_API_KEY"] = ""  # your router key

response = completion(
    model="aistupidlevel/auto-coding",
    messages=[{"role": "user", "content": "Hello!"}],
)
```
