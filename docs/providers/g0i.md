import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# g0i

[g0i](https://g0i.ai) is an OpenAI-compatible and Anthropic-compatible AI gateway with 470+ models — Claude Opus 4.7, Claude Sonnet 4.6, Claude Haiku 4.5, GPT-5.x family (including GPT-5 Codex), Gemini 3 Pro, Qwen3, Kimi K2, DeepSeek V3, Mistral Large, and more — behind a single API key.

Because g0i exposes a standard OpenAI-compatible endpoint at `https://api.g0i.ai/v1`, LiteLLM connects via the existing `openai/` provider prefix with `api_base`. No custom code path required.

## Quick Start

```python
import os
from litellm import completion

os.environ["OPENAI_API_KEY"] = "sk-..."  # your g0i.ai API key

response = completion(
    model="openai/claude-opus-4-7",
    api_base="https://api.g0i.ai/v1",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response)
```

## Usage with LiteLLM Proxy

In `config.yaml`:

```yaml
model_list:
  - model_name: claude-opus-4-7
    litellm_params:
      model: openai/claude-opus-4-7
      api_base: https://api.g0i.ai/v1
      api_key: os.environ/G0I_API_KEY

  - model_name: gpt-5.5
    litellm_params:
      model: openai/gpt-5.5
      api_base: https://api.g0i.ai/v1
      api_key: os.environ/G0I_API_KEY

  - model_name: claude-sonnet-4-6
    litellm_params:
      model: openai/claude-sonnet-4-6
      api_base: https://api.g0i.ai/v1
      api_key: os.environ/G0I_API_KEY
```

## Streaming

```python
import os
from litellm import completion

os.environ["OPENAI_API_KEY"] = "sk-..."

response = completion(
    model="openai/claude-sonnet-4-6",
    api_base="https://api.g0i.ai/v1",
    messages=[{"role": "user", "content": "Write a haiku"}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="", flush=True)
```

## Tool Use / Function Calling

```python
import os
from litellm import completion

os.environ["OPENAI_API_KEY"] = "sk-..."

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string"},
            },
            "required": ["location"],
        },
    },
}]

response = completion(
    model="openai/claude-opus-4-7",
    api_base="https://api.g0i.ai/v1",
    messages=[{"role": "user", "content": "What's the weather in Paris?"}],
    tools=tools,
)
print(response)
```

## Vision

Most modern models on g0i support vision. Pass image content the same way you would with OpenAI:

```python
import os
from litellm import completion

os.environ["OPENAI_API_KEY"] = "sk-..."

response = completion(
    model="openai/gpt-5.4",
    api_base="https://api.g0i.ai/v1",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {"type": "image_url", "image_url": {"url": "https://example.com/image.png"}},
        ],
    }],
)
print(response)
```

## Embeddings

```python
import os
from litellm import embedding

os.environ["OPENAI_API_KEY"] = "sk-..."

response = embedding(
    model="openai/text-embedding-3-small",
    api_base="https://api.g0i.ai/v1",
    input=["Hello", "World"],
)
print(response)
```

## Image Generation

```python
import os
from litellm import image_generation

os.environ["OPENAI_API_KEY"] = "sk-..."

response = image_generation(
    model="openai/NanoBanana",
    api_base="https://api.g0i.ai/v1",
    prompt="A cat in a top hat, vintage oil painting",
    n=1,
)
print(response)
```

## g0i — Featured Models

🚨 **g0i supports 470+ models.** Use the model ID exactly as it appears on [g0i.ai/models](https://g0i.ai/models). A representative selection:

| Model Name (g0i)            | Function Call                                                                                                       |
|-----------------------------|---------------------------------------------------------------------------------------------------------------------|
| `claude-opus-4-7`           | `completion('openai/claude-opus-4-7', messages, api_base='https://api.g0i.ai/v1')`           |
| `claude-sonnet-4-6`         | `completion('openai/claude-sonnet-4-6', messages, api_base='https://api.g0i.ai/v1')`         |
| `claude-haiku-4-5`          | `completion('openai/claude-haiku-4-5', messages, api_base='https://api.g0i.ai/v1')`          |
| `gpt-5.5`                   | `completion('openai/gpt-5.5', messages, api_base='https://api.g0i.ai/v1')`                   |
| `gpt-5.4`                   | `completion('openai/gpt-5.4', messages, api_base='https://api.g0i.ai/v1')`                   |
| `gpt-5-codex`               | `completion('openai/gpt-5-codex', messages, api_base='https://api.g0i.ai/v1')`               |
| `gemini-3.1-pro-preview`    | `completion('openai/gemini-3.1-pro-preview', messages, api_base='https://api.g0i.ai/v1')`    |
| `gemini-2.5-pro`            | `completion('openai/gemini-2.5-pro', messages, api_base='https://api.g0i.ai/v1')`            |
| `qwen3.6:35b`               | `completion('openai/qwen3.6:35b', messages, api_base='https://api.g0i.ai/v1')`               |
| `kimi-k2.6`                 | `completion('openai/kimi-k2.6', messages, api_base='https://api.g0i.ai/v1')`                 |
| `deepseek-v3.1:671b-cloud`  | `completion('openai/deepseek-v3.1:671b-cloud', messages, api_base='https://api.g0i.ai/v1')`  |
| `mistral-large`             | `completion('openai/mistral-large', messages, api_base='https://api.g0i.ai/v1')`             |

Browse the full live catalog (with pricing per million tokens) at [g0i.ai/models](https://g0i.ai/models).

## Anthropic-format endpoint

g0i also speaks the native Anthropic Messages API at `https://api.g0i.ai/v1/messages` for clients that need it (Claude Code CLI, Anthropic SDK):

```python
import anthropic

client = anthropic.Anthropic(
    api_key="sk-...",
    base_url="https://api.g0i.ai",
)

message = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
print(message)
```

## Pricing & Limits

- **Pay-as-you-go** from $40/month for full platform access (excluding Opus)
- **OpusPro** at $100/month for Claude Opus 4.7 included
- Free trial credits, no credit card required
- Cryptocurrency payments accepted (BTC, ETH, USDT and 50+ others)

See [g0i.ai/pricing](https://g0i.ai/pricing) for the live rate card.
