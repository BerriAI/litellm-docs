import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Outer Labs

## Overview

| Property | Details |
|-------|-------|
| Description | Outer Labs is a hosted gateway that serves Anthropic Claude and OpenAI GPT models through one OpenAI-compatible API, at 40% below the direct per-token price |
| Provider Route on LiteLLM | `outerlabs/` |
| Link to Provider Doc | [Outer Labs Documentation](https://outerlabs.ai/docs) |
| Default Base URL | `https://api.outerlabs.ai/v1` |
| Supported Operations | `/chat/completions` |

Outer Labs is its own provider on LiteLLM rather than a generic OpenAI-compatible route, so its spend is priced from the `outerlabs/` cost map entries and reported under provider `outerlabs`.

## API Key

```python showLineNumbers title="Environment Variables"
import os

os.environ["OUTERLABS_API_KEY"] = "your-api-key"
os.environ["OUTERLABS_API_BASE"] = "https://api.outerlabs.ai/v1"  # optional override
```

A call with no Outer Labs key fails with an authentication error. LiteLLM does not fall back to `OPENAI_API_KEY` for this provider.

## Models

| Model | Max input tokens | Input / 1M tokens | Output / 1M tokens | Cache read / 1M tokens |
|-------|------------------|-------------------|--------------------|------------------------|
| `outerlabs/claude-fable-5` | 1,000,000 | $6.00 | $30.00 | $0.60 |
| `outerlabs/claude-fable-5-1` | 1,000,000 | $6.00 | $30.00 | $0.15 |
| `outerlabs/claude-fable-5-2` | 1,000,000 | $4.80 | $24.00 | $0.12 |
| `outerlabs/claude-opus-5` | 1,000,000 | $3.00 | $15.00 | $0.30 |
| `outerlabs/claude-opus-5-5` | 1,000,000 | $2.40 | $12.00 | $0.12 |
| `outerlabs/claude-sonnet-4-6` | 1,000,000 | $1.80 | $9.00 | $0.18 |
| `outerlabs/claude-sonnet-5` | 1,000,000 | $1.20 | $6.00 | $0.12 |
| `outerlabs/claude-sonnet-5-5` | 1,000,000 | $1.20 | $6.00 | $0.06 |
| `outerlabs/claude-haiku-4-5` | 200,000 | $0.60 | $3.00 | $0.06 |
| `outerlabs/claude-haiku-5-5` | 1,000,000 | $0.06 | $0.30 | $0.006 |
| `outerlabs/gpt-6-astra` | 922,000 | $6.00 | $30.00 | $0.60 |
| `outerlabs/gpt-5.6-sol` | 922,000 | $2.40 | $12.00 | $0.24 |
| `outerlabs/gpt-5.6-terra` | 922,000 | $1.20 | $7.20 | $0.12 |
| `outerlabs/gpt-6-sol` | 922,000 | $1.20 | $6.00 | $0.12 |
| `outerlabs/gpt-6.1-sol` | 922,000 | $1.20 | $6.00 | $0.06 |
| `outerlabs/gpt-6.1-terra` | 922,000 | $0.60 | $3.00 | $0.03 |
| `outerlabs/gpt-5.6-luna` | 922,000 | $0.12 | $0.72 | $0.012 |
| `outerlabs/gpt-6-luna` | 922,000 | $0.06 | $0.30 | $0.006 |

Pricing follows the [Outer Labs rate card](https://outerlabs.ai/pricing), which lists each model beside the direct price. Some models charge a higher rate for long prompts; the cost map carries those bands.

The models support `tools` and a `json_schema` `response_format`. Forced `tool_choice` is not available on `claude-fable-5-1`, `claude-fable-5-2`, `claude-opus-5-5`, `claude-sonnet-5-5`; those models accept `auto` and `none`.

## Usage - LiteLLM Python SDK

### Chat Completions

```python showLineNumbers title="Outer Labs Chat Completion" keep-model-ids
import os
from litellm import completion

os.environ["OUTERLABS_API_KEY"] = "your-api-key"

response = completion(
    model="outerlabs/claude-sonnet-5",
    messages=[{"role": "user", "content": "Write a python function that reverses a string"}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Outer Labs Streaming Chat Completion" keep-model-ids
import os
from litellm import completion

os.environ["OUTERLABS_API_KEY"] = "your-api-key"

response = completion(
    model="outerlabs/gpt-6.1-sol",
    messages=[{"role": "user", "content": "Explain a binary search in two sentences"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Tool Calling

```python showLineNumbers title="Outer Labs Tool Calling" keep-model-ids
import os
from litellm import completion

os.environ["OUTERLABS_API_KEY"] = "your-api-key"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the weather for a city",
            "parameters": {
                "type": "object",
                "properties": {"city": {"type": "string"}},
                "required": ["city"],
            },
        },
    }
]

response = completion(
    model="outerlabs/claude-haiku-5-5",
    messages=[{"role": "user", "content": "What is the weather in Paris?"}],
    tools=tools,
)

print(response.choices[0].message.tool_calls)
```

### Prompt Caching

Claude models cache a prefix when a message block carries `cache_control`; LiteLLM passes it through unchanged. GPT models cache automatically. Cached tokens come back in `usage.prompt_tokens_details.cached_tokens` and are priced at the cache read rate.

```python showLineNumbers title="Outer Labs Prompt Caching" keep-model-ids
import os
from litellm import completion

os.environ["OUTERLABS_API_KEY"] = "your-api-key"

response = completion(
    model="outerlabs/claude-haiku-5-5",
    messages=[
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": "<a long, reusable system prompt>",
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        },
        {"role": "user", "content": "Summarize the instructions above"},
    ],
)

print(response.usage)
```

## Usage - LiteLLM Proxy

```yaml showLineNumbers title="config.yaml" keep-model-ids
model_list:
  - model_name: claude-sonnet-5
    litellm_params:
      model: outerlabs/claude-sonnet-5
      api_key: os.environ/OUTERLABS_API_KEY
  - model_name: gpt-6.1-sol
    litellm_params:
      model: outerlabs/gpt-6.1-sol
      api_key: os.environ/OUTERLABS_API_KEY
```

```bash showLineNumbers title="Start the proxy"
litellm --config config.yaml
```

```bash showLineNumbers title="Test Request" keep-model-ids
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "claude-sonnet-5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```
