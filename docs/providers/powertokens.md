import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# PowerTokens

## Overview

| Property | Details |
|-------|-------|
| Description | PowerTokens is an API gateway for China-origin models (Z.ai GLM, MiniMax, Alibaba Qwen, BytePlus Seed and DeepSeek). One API key works for every model, over OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages APIs. |
| Provider Route on LiteLLM | `powertokens/` |
| Link to Provider Doc | [PowerTokens Documentation ↗](https://docs.powertokens.ai?utm_source=github&utm_medium=litellm&utm_campaign=litellm) |
| Base URL | `https://api.powertokens.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#anthropic-messages-api) |

<br />
<br />

**We support ALL PowerTokens text models, just set `powertokens/` as a prefix when sending requests**

## Available Models

A few commonly used text models are listed below. The full catalog, with pricing, is at [powertokens.ai/models](https://powertokens.ai/models?utm_source=github&utm_medium=litellm&utm_campaign=litellm), and `GET https://api.powertokens.ai/v1/models` returns the models your key can use.

| Model | Notes |
|-------|-------|
| `powertokens/glm-5.2` | Z.ai GLM-5.2. Default for coding agents. Chat Completions and Messages. |
| `powertokens/glm-5-turbo` | Z.ai GLM-5 Turbo. Faster, lighter tasks. Chat Completions and Messages. |
| `powertokens/MiniMax-M3` | MiniMax M3. Chat Completions, Messages, and Responses. |
| `powertokens/qwen3-coder-plus` | Alibaba Qwen3 Coder Plus. Chat Completions, Messages, and Responses. |
| `powertokens/deepseek-v3-2-251201` | DeepSeek V3.2 served via BytePlus. Chat Completions, Messages, and Responses. |

GLM models are not available on the Responses API. Use Chat Completions or Messages for them. See [Text model protocols and endpoints](https://docs.powertokens.ai/en/ecosystem-tools/text-model-protocols?utm_source=github&utm_medium=litellm&utm_campaign=litellm).

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["POWERTOKENS_API_KEY"] = ""  # your PowerTokens API key
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="PowerTokens Non-streaming Completion"
import os
from litellm import completion

os.environ["POWERTOKENS_API_KEY"] = ""  # your PowerTokens API key

response = completion(
    model="powertokens/glm-5.2",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)

print(response)
```

### Streaming

```python showLineNumbers title="PowerTokens Streaming Completion"
import os
from litellm import completion

os.environ["POWERTOKENS_API_KEY"] = ""  # your PowerTokens API key

response = completion(
    model="powertokens/glm-5.2",
    messages=[{"content": "Write a short story about AI", "role": "user"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Responses API

```python showLineNumbers title="PowerTokens Responses API"
import os
import litellm

os.environ["POWERTOKENS_API_KEY"] = ""  # your PowerTokens API key

response = litellm.responses(
    model="powertokens/MiniMax-M3",
    input="Say hello",
)

print(response.output_text)
```

### Anthropic Messages API

```python showLineNumbers title="PowerTokens Anthropic Messages API"
import asyncio
import os
import litellm

os.environ["POWERTOKENS_API_KEY"] = ""  # your PowerTokens API key

async def main():
    response = await litellm.anthropic.messages.acreate(
        model="powertokens/glm-5.2",
        messages=[{"role": "user", "content": "Say hello"}],
        max_tokens=64,
    )
    print(response["content"][0]["text"])

asyncio.run(main())
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: glm-5.2
    litellm_params:
      model: powertokens/glm-5.2
      api_key: os.environ/POWERTOKENS_API_KEY
  - model_name: minimax-m3
    litellm_params:
      model: powertokens/MiniMax-M3
      api_key: os.environ/POWERTOKENS_API_KEY
```

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-5.2",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

## Custom API Base

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import completion

os.environ["POWERTOKENS_API_BASE"] = "https://api.powertokens.ai/v1"
os.environ["POWERTOKENS_API_KEY"] = ""  # your API key

response = completion(
    model="powertokens/glm-5.2",
    messages=[{"content": "Hello!", "role": "user"}],
)
```
