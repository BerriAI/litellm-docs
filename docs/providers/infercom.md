import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Infercom

## Overview

| Property | Details |
|-------|-------|
| Description | Infercom provides OpenAI-compatible inference APIs for chat completions and agentic Responses API workflows. |
| Provider Route on LiteLLM | `infercom/` |
| Link to Provider Doc | [Infercom Documentation ↗](https://docs.infercom.ai/) |
| Default Base URL | `https://api.infercom.ai/v1` |
| Supported Operations | `/chat/completions`, `/responses` |

**We support Infercom models through LiteLLM's OpenAI-compatible provider route. Use `infercom/` as the model prefix.**

## Required Variables

```python showLineNumbers title="Environment Variables"
import os

os.environ["INFERCOM_API_KEY"] = "your-infercom-api-key"
```

Optional base URL override:

```python showLineNumbers title="Optional Base URL Override"
import os

os.environ["INFERCOM_API_BASE"] = "https://api.infercom.ai/v1"
```

## Available Models

Infercom documents both chat-completions models and Responses API-capable models.

- `infercom/MiniMax-M2.7` - supports `/chat/completions` and `/responses`
- `infercom/MiniMax-M2.5` - supports `/chat/completions` and `/responses`
- `infercom/gpt-oss-120b` - supports `/chat/completions` and `/responses`
- `infercom/DeepSeek-V3.1` - chat completions only
- `infercom/Meta-Llama-3.3-70B-Instruct` - chat completions only

See Infercom's current model catalog for the latest availability:
- [Supported models](https://docs.infercom.ai/en/models/supported-models)
- [Responses API guide](https://docs.infercom.ai/en/features/responses-api)

## Usage - LiteLLM Python SDK

### Chat Completions

```python showLineNumbers title="Infercom Chat Completion"
import os
from litellm import completion

os.environ["INFERCOM_API_KEY"] = "your-infercom-api-key"

response = completion(
    model="infercom/MiniMax-M2.7",
    messages=[{"role": "user", "content": "Say hello in one short sentence."}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Infercom Streaming Chat Completion"
import os
from litellm import completion

os.environ["INFERCOM_API_KEY"] = "your-infercom-api-key"

response = completion(
    model="infercom/MiniMax-M2.7",
    messages=[{"role": "user", "content": "Write a haiku about latency."}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Responses API

```python showLineNumbers title="Infercom Responses API"
import os
import litellm

os.environ["INFERCOM_API_KEY"] = "your-infercom-api-key"

response = litellm.responses(
    model="infercom/MiniMax-M2.7",
    input="Say hello in one short sentence.",
)

print(response.output_text)
```

### Function Calling with Responses API

```python showLineNumbers title="Infercom Responses API with Tools"
import os
import litellm

os.environ["INFERCOM_API_KEY"] = "your-infercom-api-key"

response = litellm.responses(
    model="infercom/MiniMax-M2.7",
    input="What's the weather in Amsterdam?",
    tools=[
        {
            "type": "function",
            "name": "get_weather",
            "description": "Get current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string"}
                },
                "required": ["city"]
            }
        }
    ]
)

print(response.output)
```

## Usage - LiteLLM Proxy

Add Infercom to your LiteLLM Proxy configuration:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: infercom-chat
    litellm_params:
      model: infercom/MiniMax-M2.7
      api_key: os.environ/INFERCOM_API_KEY

  - model_name: infercom-agent
    litellm_params:
      model: infercom/gpt-oss-120b
      api_key: os.environ/INFERCOM_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export INFERCOM_API_KEY="your-infercom-api-key"
export LITELLM_MASTER_KEY="sk-infercom-proxy"
litellm --config config.yaml --port 4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Infercom via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-infercom-proxy",
)

response = client.chat.completions.create(
    model="infercom-chat",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="Infercom via Proxy - LiteLLM SDK"
import litellm

response = litellm.completion(
    model="litellm_proxy/infercom-chat",
    messages=[{"role": "user", "content": "hello from litellm"}],
    api_base="http://localhost:4000",
    api_key="sk-infercom-proxy",
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Infercom via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-infercom-proxy" \
  -d '{
    "model": "infercom-chat",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

```bash showLineNumbers title="Infercom via Proxy - Responses API"
curl http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-infercom-proxy" \
  -d '{
    "model": "infercom-chat",
    "input": "Say hello in one short sentence."
  }'
```

</TabItem>
</Tabs>

## Notes

- Infercom's OpenAI-compatible base URL is `https://api.infercom.ai/v1`.
- LiteLLM supports Infercom through the `infercom/` provider prefix.
- Infercom supports the Responses API for agentic workflows on selected models such as `MiniMax-M2.7`, `MiniMax-M2.5`, and `gpt-oss-120b`.
- Infercom's documented chat-completions temperature range is `0.0` to `1.0`, and LiteLLM clamps requests to that range for this provider.

