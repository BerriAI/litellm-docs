import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Heabsy

## Overview

| Property | Details |
|-------|-------|
| Description | Heabsy is an inference API for open-weight models with OpenAI-compatible and Anthropic-compatible endpoints. |
| Provider Route on LiteLLM | `heabsy/` |
| Link to Provider Doc | [Heabsy API reference ↗](https://api.heabsy.com/docs) |
| Base URL | `https://api.heabsy.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#anthropic-messages-api) |

<br />
<br />

https://heabsy.com/

**We support ALL Heabsy chat models, just set `heabsy/` as a prefix when sending completion requests**

## Available Models

These models run on dedicated GPUs in the EEA, and Heabsy does not store prompts or outputs for them.

| Model | Context window | Max output |
|-------|----------------|------------|
| `heabsy/qwen38` | 262,144 | 32,768 |
| `heabsy/mimo-v26-flash` | 1,048,576 | 65,536 |
| `heabsy/glm53-flash-unc` | 1,048,576 | 131,072 |
| `heabsy/cyberheabsy` | 1,048,576 | 65,536 |

All four support tool calling and reasoning. `qwen38`, `mimo-v26-flash` and `glm53-flash-unc` also accept images.

The [Heabsy model catalog](https://heabsy.com/models) lists every model with its region and price. Models outside the EEA tier, such as `glm-5.3`, are served from other regions or through partners, and the catalog labels each one. `GET https://api.heabsy.com/v1/models` with your key returns the current list of model IDs.

LiteLLM has no prices for Heabsy models yet, so it records their spend as $0 unless you set `input_cost_per_token` and `output_cost_per_token` in the deployment's `model_info`.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["HEABSY_API_KEY"] = ""  # your Heabsy API key
```

Create an API key in the [Heabsy console](https://platform.heabsy.com).

You can overwrite the base url with:

```
os.environ["HEABSY_API_BASE"] = "https://api.heabsy.com/v1"
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Heabsy Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["HEABSY_API_KEY"] = ""  # your Heabsy API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# Heabsy call
response = completion(
    model="heabsy/qwen38",
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="Heabsy Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["HEABSY_API_KEY"] = ""  # your Heabsy API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# Heabsy call with streaming
response = completion(
    model="heabsy/qwen38",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Responses API

Heabsy does not serve the Responses API, so LiteLLM translates `/responses` calls into Heabsy chat completions.

```python showLineNumbers title="Heabsy Responses API"
import os
import litellm

os.environ["HEABSY_API_KEY"] = ""  # your Heabsy API key

response = litellm.responses(
    model="heabsy/qwen38",
    input="Name three primary colors"
)

print(response.output[0].content[0].text)
```

### Anthropic Messages API

LiteLLM sends `/messages` calls to Heabsy's own `/v1/messages` endpoint, so Anthropic-format requests reach Heabsy without translation.

```python showLineNumbers title="Heabsy Messages API"
import asyncio
import os
import litellm

os.environ["HEABSY_API_KEY"] = ""  # your Heabsy API key

async def main():
    response = await litellm.anthropic.messages.acreate(
        model="heabsy/qwen38",
        messages=[{"role": "user", "content": "Name three primary colors"}],
        max_tokens=200
    )
    print(response["content"])

asyncio.run(main())
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: heabsy-qwen
    litellm_params:
      model: heabsy/qwen38
      api_key: os.environ/HEABSY_API_KEY

  - model_name: heabsy-glm-flash
    litellm_params:
      model: heabsy/glm53-flash-unc
      api_key: os.environ/HEABSY_API_KEY
      api_base: os.environ/HEABSY_API_BASE  # optional
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
printf 'Local proxy key: %s\n' "$LITELLM_MASTER_KEY"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

In another terminal, set `LITELLM_API_KEY` to the key printed above, then call the proxy:

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Heabsy via Proxy - Non-streaming"
import os
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",       # Your proxy URL
    api_key=os.environ["LITELLM_API_KEY"]   # The proxy key printed at startup
)

# Non-streaming response
response = client.chat.completions.create(
    model="heabsy-qwen",
    messages=[{"role": "user", "content": "hello from litellm"}]
)

print(response.choices[0].message.content)
```

```python showLineNumbers title="Heabsy via Proxy - Streaming"
import os
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",       # Your proxy URL
    api_key=os.environ["LITELLM_API_KEY"]   # The proxy key printed at startup
)

# Streaming response
response = client.chat.completions.create(
    model="heabsy-glm-flash",
    messages=[{"role": "user", "content": "hello from litellm"}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

</TabItem>
<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="Heabsy via Proxy - LiteLLM SDK"
import os
import litellm

# Configure LiteLLM to use your proxy
response = litellm.completion(
    model="litellm_proxy/heabsy-qwen",
    messages=[{"role": "user", "content": "hello from litellm"}],
    api_base="http://localhost:4000",
    api_key=os.environ["LITELLM_API_KEY"]
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Heabsy via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "heabsy-qwen",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

```bash showLineNumbers title="Heabsy via Proxy - cURL Messages API"
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "heabsy-qwen",
    "max_tokens": 200,
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
</Tabs>

For more detailed information on using the LiteLLM Proxy, see the [LiteLLM Proxy documentation](../providers/litellm_proxy).
