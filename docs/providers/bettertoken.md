import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# BetterToken

## Overview

| Property | Details |
|-------|-------|
| Description | BetterToken is a multi-model API gateway: one API key and one balance for Claude, GPT, Kimi, GLM, DeepSeek, MiniMax and Qwen models over OpenAI- and Anthropic-compatible endpoints. |
| Provider Route on LiteLLM | `bettertoken/` |
| Link to Provider Doc | [BetterToken Documentation ↗](https://docs.bettertoken.ai) |
| Base URL | `https://bettertoken.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), `/responses`, `/messages` |
| Pricing | [bettertoken.ai/pricing](https://bettertoken.ai/pricing) |

**We support ALL BetterToken chat models, just set `bettertoken/` as a prefix when sending completion requests.** The live model list is at `GET https://bettertoken.ai/v1/models`.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["BETTERTOKEN_API_KEY"] = ""  # your BetterToken API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="BetterToken Non-streaming Completion"
import os
from litellm import completion

os.environ["BETTERTOKEN_API_KEY"] = ""

response = completion(
    model="bettertoken/claude-sonnet-5-5",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)
print(response)
```

### Streaming

```python showLineNumbers title="BetterToken Streaming Completion"
response = completion(
    model="bettertoken/gpt-6-sol",
    messages=[{"role": "user", "content": "Write a haiku about routers"}],
    stream=True,
)
for chunk in response:
    print(chunk)
```

### Responses API

```python showLineNumbers title="BetterToken Responses API"
import litellm

response = litellm.responses(model="bettertoken/gpt-6-sol", input="Hello")
print(response)
```

## Usage - LiteLLM Proxy

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-sonnet-5-5
    litellm_params:
      model: bettertoken/claude-sonnet-5-5
      api_key: os.environ/BETTERTOKEN_API_KEY
```

```bash
litellm --config config.yaml
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-5-5", "messages": [{"role": "user", "content": "Hello"}]}'
```
