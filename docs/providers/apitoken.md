# apiToken.sale

## Overview

LiteLLM provides Anthropic-spec compatible support for [apiToken.sale](https://apitoken.sale) — a discounted Claude API provider. apiToken.sale serves the identical Anthropic Messages API (same models, request/response format, streaming and tool use) at `https://api.apitoken.sale`, billed from prepaid balance at 60–80% below official Anthropic token prices.

| Property | Details |
|----------|---------|
| Provider route | `apitoken/` |
| Supported endpoints | `/chat/completions`, `/v1/messages` |
| API base | `https://api.apitoken.sale` |
| API key env | `APITOKEN_API_KEY` |
| Get a key | [apitoken.sale](https://apitoken.sale) |

## Supported Models

One key unlocks the full supported Claude line. Prices below are the starting (−60%) tier; higher cumulative top-ups increase the discount to −80%.

| Model | Input Cost (from) | Output Cost (from) | Prompt Caching Read | Prompt Caching Write |
|-------|-------------------|--------------------|---------------------|----------------------|
| **claude-opus-4-8** | $2/M tokens | $10/M tokens | $0.20/M tokens | $2.50/M tokens |
| **claude-opus-4-7** | $2/M tokens | $10/M tokens | $0.20/M tokens | $2.50/M tokens |
| **claude-sonnet-5** | $1.20/M tokens | $6/M tokens | $0.12/M tokens | $1.50/M tokens |
| **claude-sonnet-4-6** | $1.20/M tokens | $6/M tokens | $0.12/M tokens | $1.50/M tokens |
| **claude-haiku-4-5** | $0.40/M tokens | $2/M tokens | $0.04/M tokens | $0.50/M tokens |

## Usage Examples

### Basic Chat Completion

```python
import litellm

response = litellm.completion(
    model="apitoken/claude-opus-4-8",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
    api_key="sk-pool-...",  # your apiToken.sale key
)

print(response.choices[0].message.content)
```

### Using Environment Variables

```bash
export APITOKEN_API_KEY="sk-pool-..."
```

```python
import litellm

response = litellm.completion(
    model="apitoken/claude-haiku-4-5",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

### Streaming

```python
response = litellm.completion(
    model="apitoken/claude-sonnet-5",
    messages=[{"role": "user", "content": "Write a haiku about APIs."}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

### With Tool Calling

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                },
                "required": ["location"]
            }
        }
    }
]

response = litellm.completion(
    model="apitoken/claude-sonnet-5",
    messages=[{"role": "user", "content": "What's the weather in SF?"}],
    tools=tools,
)
```

### Anthropic Messages API (`/v1/messages`)

```python
import litellm

response = litellm.anthropic.messages.acreate(
    model="apitoken/claude-opus-4-8",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=1000,
)
```

### LiteLLM Proxy

```yaml
# config.yaml
model_list:
  - model_name: claude-opus-4-8
    litellm_params:
      model: apitoken/claude-opus-4-8
      api_key: os.environ/APITOKEN_API_KEY
```

## Notes

- The protocol is byte-for-byte the Anthropic Messages API; prompt caching, system prompts, vision and streaming behave exactly as documented by Anthropic.
- Billing: each request is metered at official Anthropic token rates, then the account's progressive discount (60% → 80%) is applied to prepaid balance. Balance never expires; there is no subscription.
- New accounts created with Google or GitHub include $10 of usage at official API prices.
