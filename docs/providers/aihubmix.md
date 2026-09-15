import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AIHubMix

## Overview

| Property | Details |
|-------|-------|
| Description | AIHubMix is an OpenAI-compatible AI model aggregation gateway, providing access to models from OpenAI, Anthropic, Google, and more through a unified API. |
| Provider Route on LiteLLM | `aihubmix/` |
| Link to Provider Doc | [AIHubMix Docs ↗](https://docs.aihubmix.com) |
| Base URL | `https://aihubmix.com/v1` |
| Supported Operations | [`/chat/completions`](#sample-usage) |

<br />

**We support ALL AIHubMix models — set `aihubmix/` as a prefix when sending completion requests.**

Get your API key from [console.aihubmix.com](https://console.aihubmix.com/token).

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["AIHUBMIX_API_KEY"] = ""  # your AIHubMix API key
```

You can overwrite the base url with:

```python
os.environ["AIHUBMIX_API_BASE"] = "https://aihubmix.com/v1"
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
    model="aihubmix/gpt-5.5",
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

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="aihubmix/claude-opus-4-7",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

## Usage - LiteLLM Proxy Server

### 1. Save key in your environment

```bash
export AIHUBMIX_API_KEY=""
```

### 2. Configure the proxy

```yaml
model_list:
  - model_name: gpt-5.5
    litellm_params:
      model: aihubmix/gpt-5.5
      api_key: os.environ/AIHUBMIX_API_KEY
  - model_name: claude-opus-4-7
    litellm_params:
      model: aihubmix/claude-opus-4-7
      api_key: os.environ/AIHUBMIX_API_KEY
```

### 3. Start the proxy

```bash
litellm --config /path/to/config.yaml
```

### 4. Send a request

<Tabs>
<TabItem value="curl" label="cURL">

```shell
curl -X POST 'http://0.0.0.0:4000/chat/completions' \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-5.5",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

</TabItem>
<TabItem value="openai" label="OpenAI Python SDK">

```python showLineNumbers
import openai

client = openai.OpenAI(
    api_key="sk-1234",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response)
```

</TabItem>
</Tabs>

## Additional Resources

- [AIHubMix Website](https://aihubmix.com)
- [AIHubMix Documentation](https://docs.aihubmix.com)
