import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AIHubMix

## Overview

| Property | Details |
|-------|-------|
| Description | AIHubMix is an LLM gateway that provides unified, OpenAI-compatible access to models from OpenAI, Anthropic, Google, DeepSeek, Qwen, Moonshot, xAI, Zhipu and other providers. |
| Provider Route on LiteLLM | `aihubmix/` |
| Link to Provider Doc | [AIHubMix Documentation ↗](https://docs.aihubmix.com/en) |
| Base URL | `https://aihubmix.com/v1` |
| Supported Operations | [`/chat/completions`](#sample-usage) |

<br />
<br />

**We support ALL AIHubMix models, just set `aihubmix/` as a prefix when sending completion requests**

## Available Models

| Model | Description | Context Window |
|-------|-------------|----------------|
| `aihubmix/gpt-6-astra` | OpenAI's flagship agentic model | 1,050,000 tokens |
| `aihubmix/claude-opus-5` | Anthropic's flagship reasoning model | 1,000,000 tokens |
| `aihubmix/claude-sonnet-5` | Anthropic's balanced-tier model | 1,000,000 tokens |
| `aihubmix/gemini-3.8-flash` | Google's fast, agent-oriented model | 1,048,576 tokens |
| `aihubmix/deepseek-v4-pro-0813` | DeepSeek's flagship reasoning model | 1,000,000 tokens |
| `aihubmix/kimi-k3` | Moonshot's always-on reasoning model | 1,048,576 tokens |
| `aihubmix/qwen3.8-max` | Alibaba's flagship Qwen model | 1,000,000 tokens |
| `aihubmix/coding-glm-5.3` | Zhipu's coding-oriented GLM model | 1,048,576 tokens |
| `aihubmix/grok-4.6` | xAI's flagship model | 500,000 tokens |

See the full, up-to-date list at [aihubmix.com/models](https://aihubmix.com/models).

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

# AIHubMix call
response = completion(
    model="aihubmix/claude-sonnet-5",
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

# AIHubMix call with streaming
response = completion(
    model="aihubmix/claude-sonnet-5",
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
    model="aihubmix/gpt-6-astra",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response)
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-sonnet-5
    litellm_params:
      model: aihubmix/claude-sonnet-5
      api_key: os.environ/AIHUBMIX_API_KEY
  - model_name: gpt-6-astra
    litellm_params:
      model: aihubmix/gpt-6-astra
      api_key: os.environ/AIHUBMIX_API_KEY
  - model_name: gemini-3.8-flash
    litellm_params:
      model: aihubmix/gemini-3.8-flash
      api_key: os.environ/AIHUBMIX_API_KEY
  - model_name: deepseek-v4-pro
    litellm_params:
      model: aihubmix/deepseek-v4-pro-0813
      api_key: os.environ/AIHUBMIX_API_KEY
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["AIHUBMIX_API_BASE"] = "https://custom.aihubmix.com/v1"
os.environ["AIHUBMIX_API_KEY"] = ""  # your API key

response = completion(
    model="aihubmix/claude-sonnet-5",
    messages=[{"content": "Hello!", "role": "user"}],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import completion

response = completion(
    model="aihubmix/claude-sonnet-5",
    messages=[{"content": "Hello!", "role": "user"}],
    api_base="https://custom.aihubmix.com/v1",
    api_key="your-api-key",
)
```

## Supported OpenAI Parameters

- `temperature`
- `max_tokens`
- `max_completion_tokens`
- `top_p`
- `frequency_penalty`
- `presence_penalty`
- `stop`
- `n`
- `stream`
- `tools`
- `tool_choice`
- `response_format`
- `seed`
- `user`
- `logit_bias`
- `logprobs`
- `top_logprobs`
