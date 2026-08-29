import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# FlexAI

## Overview

| Property | Details |
|-------|-------|
| Description | FlexAI's Token Service serves open-weight models behind one OpenAI-compatible API, with per-token pay-as-you-go pricing across chat, embedding, image, transcription, and speech models. |
| Provider Route on LiteLLM | `flexai/` |
| Link to Provider Doc | [FlexAI Documentation ↗](https://docs.flex.ai) |
| Base URL | `https://api.flex.ai/v1` |
| Supported Operations | [`/chat/completions`](#sample-usage), `/responses` |

<br />
<br />

**We support ALL FlexAI chat models, just set `flexai/` as a prefix when sending completion requests**

## Available Models (selection)

The live catalog with pricing is at [platform.flex.ai/models](https://platform.flex.ai/models). Popular chat models:

| Model | Capabilities | Context Window |
|-------|-------------|----------------|
| `flexai/DeepSeek-V4-Flash-0731` | tool use, reasoning | 768K tokens |
| `flexai/gpt-oss-120b` | tool use, structured outputs | 128K tokens |
| `flexai/gemma-4-31b-it` | tool use, reasoning, vision | 256K tokens |
| `flexai/gemma-4-26B-A4B-it` | tool use, vision | 256K tokens |
| `flexai/Qwen3-30B-A3B-Thinking-2507-FP8` | tool use, reasoning | 256K tokens |
| `flexai/Qwen3-Coder-30B-A3B-Instruct-FP8` | tool use, code | 256K tokens |
| `flexai/Qwen3.5-9B` | tool use, reasoning, vision | 250K tokens |
| `flexai/GLM-5.2` | tool use, reasoning | 128K tokens |
| `flexai/Llama-3.3-70B-Instruct-FP8` | tool use | 64K tokens |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["FLEXAI_API_KEY"] = ""  # your FlexAI API key
```

Get an API key from the [FlexAI platform dashboard](https://platform.flex.ai).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="FlexAI Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["FLEXAI_API_KEY"] = ""  # your FlexAI API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# FlexAI call
response = completion(model="flexai/gpt-oss-120b", messages=messages)

print(response)
```

### Streaming

```python showLineNumbers title="FlexAI Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["FLEXAI_API_KEY"] = ""  # your FlexAI API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# FlexAI call with streaming
response = completion(
    model="flexai/gpt-oss-120b",
    messages=messages,
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-oss-120b
    litellm_params:
      model: flexai/gpt-oss-120b
      api_key: os.environ/FLEXAI_API_KEY

  - model_name: deepseek-v4-flash
    litellm_params:
      model: flexai/DeepSeek-V4-Flash-0731
      api_key: os.environ/FLEXAI_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="FlexAI via Proxy"
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key",      # Your proxy API key
)

# Non-streaming response
response = client.chat.completions.create(
    model="gpt-oss-120b",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash showLineNumbers title="FlexAI via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "gpt-oss-120b",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
</Tabs>

## Responses API

FlexAI also serves the OpenAI Responses API, so `litellm.responses()` works with the same `flexai/` prefix:

```python showLineNumbers title="FlexAI Responses API"
import os
import litellm

os.environ["FLEXAI_API_KEY"] = ""  # your FlexAI API key

response = litellm.responses(
    model="flexai/gpt-oss-120b",
    input="Hello, how are you?",
)

print(response)
```

## Additional Notes

- Set `FLEXAI_API_BASE` to point at a different FlexAI endpoint (for example a staging deployment); it defaults to `https://api.flex.ai/v1`.
- Model IDs are used exactly as the Token Service reports them at `GET /v1/models`, so they are case-sensitive and may carry a dated suffix — for example `flexai/GLM-5.2` and `flexai/DeepSeek-V4-Flash-0731`. Check `GET /v1/models` for the current set rather than assuming an ID is stable.
- Beyond chat models, FlexAI serves embedding (`bge-m3`), image (`FLUX.1-schnell`), transcription (`whisper-large-v3-turbo`, `parakeet-tdt-0.6b-v3`) and speech (`Kokoro-82M`) models. Pricing for these is registered in LiteLLM's cost map; routing for non-chat endpoints through the `flexai/` prefix is not wired yet.
