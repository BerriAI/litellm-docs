import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# APIKO

## Overview

| Property | Details |
|-------|-------|
| Description | APIKO is an AI API gateway with one OpenAI-compatible endpoint and one key for text, image and video models from multiple providers. LiteLLM supports its chat models. |
| Provider Route on LiteLLM | `apiko/` |
| Link to Provider Doc | [APIKO Documentation ↗](https://apiko.app/docs) |
| Base URL | `https://api.apiko.app/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk) |

<br />

**We support all APIKO chat models. Set `apiko/` as a prefix when sending completion requests.**

## Available Models (selection)

The live catalog with prices and availability is at [apiko.app/models](https://apiko.app/models).

| Model | Provider |
|-------|----------|
| `apiko/deepseek-v4-pro` | DeepSeek |
| `apiko/gpt-6-luna` | OpenAI |
| `apiko/claude-haiku-5-5` | Anthropic |
| `apiko/gemini-3.6-flash` | Google |
| `apiko/glm-5.3-flash` | Zhipu |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["APIKO_API_KEY"] = ""  # your APIKO API key
```

Create a key at [apiko.app](https://apiko.app/).

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="APIKO Non-streaming Completion"
import os
from litellm import completion

os.environ["APIKO_API_KEY"] = ""  # your APIKO API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(model="apiko/deepseek-v4-pro", messages=messages)

print(response)
```

### Streaming

```python showLineNumbers title="APIKO Streaming Completion"
import os
from litellm import completion

os.environ["APIKO_API_KEY"] = ""  # your APIKO API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="apiko/deepseek-v4-pro",
    messages=messages,
    stream=True,
)

for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy

Add the model to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4-pro
    litellm_params:
      model: apiko/deepseek-v4-pro
      api_key: os.environ/APIKO_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="APIKO via Proxy"
from openai import OpenAI

client = OpenAI(api_key="your-proxy-api-key", base_url="http://0.0.0.0:4000")

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="curl" label="curl">

```bash showLineNumbers title="APIKO via Proxy"
curl http://0.0.0.0:4000/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{"model": "deepseek-v4-pro", "messages": [{"role": "user", "content": "Hello, how are you?"}]}'
```

</TabItem>
</Tabs>
