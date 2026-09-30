import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# byesu

## Overview

| Property | Details |
|-------|-------|
| Description | byesu is an AI API gateway that exposes an OpenAI-compatible endpoint (and an Anthropic-native `/v1/messages` endpoint) behind a single base URL, giving access to a broad catalog of chat, reasoning, and multimodal models. |
| Provider Route on LiteLLM | `byesu/` |
| Link to Provider Doc | [byesu ↗](https://docs.byesu.com/en/clients/litellm) |
| Base URL | `https://byesu.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api) |

<br />
<br />

https://byesu.com

**We support ALL byesu models — just set `byesu/` as a prefix when sending completion requests.**

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["BYESU_API_KEY"] = ""  # your byesu API key
```

You can overwrite the base url with:

```python
os.environ["BYESU_API_BASE"] = "https://byesu.com/v1"
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="byesu Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["BYESU_API_KEY"] = ""  # your byesu API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# byesu call
response = completion(
    model="byesu/gpt-4o-mini",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="byesu Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["BYESU_API_KEY"] = ""  # your byesu API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# byesu call with streaming
response = completion(
    model="byesu/gpt-4o-mini",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: my-model
    litellm_params:
      model: byesu/gpt-4o-mini
      api_key: os.environ/BYESU_API_KEY

  - model_name: my-reasoning-model
    litellm_params:
      model: byesu/claude-sonnet-4-5
      api_key: os.environ/BYESU_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="byesu via Proxy - Non-streaming"
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key"       # Your proxy API key
)

# Non-streaming response
response = client.chat.completions.create(
    model="my-model",
    messages=[{"role": "user", "content": "hello from litellm"}]
)

print(response.choices[0].message.content)
```

```python showLineNumbers title="byesu via Proxy - Streaming"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key"       # Your proxy API key
)

response = client.chat.completions.create(
    model="my-model",
    messages=[{"role": "user", "content": "hello from litellm"}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

</TabItem>

<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="byesu via Proxy - LiteLLM SDK"
import litellm

response = litellm.completion(
    model="litellm_proxy/my-model",
    messages=[{"role": "user", "content": "hello from litellm"}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key"
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="byesu via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "my-model",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
</Tabs>

## Responses API

byesu also routes the OpenAI Responses API, so you can call it directly through LiteLLM:

```python showLineNumbers title="byesu Responses API"
import os
import litellm

os.environ["BYESU_API_KEY"] = ""  # your byesu API key

response = litellm.responses(
    model="byesu/gpt-4o-mini",
    input="Write a haiku about open-source software."
)

print(response)
```

For more detailed information on using the LiteLLM Proxy, see the [LiteLLM Proxy documentation](../providers/litellm_proxy).
