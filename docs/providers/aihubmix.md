import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AIHubMix

## Overview

| Property | Details |
|-------|-------|
| Description | AIHubMix is an OpenAI-compatible API aggregator that fronts models from OpenAI, Anthropic, Google, and other vendors behind one key and endpoint. |
| Provider Route on LiteLLM | `aihubmix/` |
| Link to Provider Doc | [AIHubMix Documentation ↗](https://docs.aihubmix.com) |
| Base URL | `https://aihubmix.com/v1` |
| Supported Operations | [`/chat/completions`](/docs/providers/aihubmix#usage---litellm-python-sdk) |

<br />
<br />

**We support ALL AIHubMix models, just set `aihubmix/` as a prefix when sending completion requests.** Use the model id exactly as AIHubMix lists it (for example `aihubmix/gpt-4o-mini`).

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["AIHUBMIX_API_KEY"] = ""  # your AIHubMix API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="AIHubMix Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["AIHUBMIX_API_KEY"] = ""  # your AIHubMix API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="aihubmix/gpt-4o-mini",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="AIHubMix Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["AIHUBMIX_API_KEY"] = ""  # your AIHubMix API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

response = completion(
    model="aihubmix/gpt-4o-mini",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Function Calling

```python showLineNumbers title="AIHubMix Function Calling"
import os
import litellm
from litellm import completion

os.environ["AIHUBMIX_API_KEY"] = ""  # your AIHubMix API key

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA"
                }
            },
            "required": ["location"]
        }
    }
}]

messages = [{"role": "user", "content": "What's the weather in Boston?"}]

response = completion(
    model="aihubmix/gpt-4o-mini",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: aihubmix/gpt-4o-mini
      api_key: os.environ/AIHUBMIX_API_KEY
  - model_name: claude-sonnet
    litellm_params:
      model: aihubmix/claude-sonnet-4-5
      api_key: os.environ/AIHUBMIX_API_KEY
```

```bash showLineNumbers title="Start proxy"
litellm --config /path/to/config.yaml
```

```bash showLineNumbers title="Test request"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["AIHUBMIX_API_BASE"] = "https://your-aihubmix-endpoint/v1"
os.environ["AIHUBMIX_API_KEY"] = ""  # your API key

response = completion(
    model="aihubmix/gpt-4o-mini",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="aihubmix/gpt-4o-mini",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://your-aihubmix-endpoint/v1",
    api_key="your-api-key",
)
```

## Supported OpenAI Parameters

AIHubMix is registered as an OpenAI-compatible provider, so LiteLLM forwards the standard OpenAI chat parameters (`temperature`, `max_tokens`, `top_p`, `stop`, `n`, `stream`, `tools`, `tool_choice`, `response_format`, `seed`, `user`, and friends) unchanged. Whether a given parameter is honored depends on the upstream model AIHubMix routes to.
