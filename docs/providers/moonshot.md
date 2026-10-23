import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Moonshot AI

## Overview

| Property | Details |
|-------|-------|
| Description | Moonshot AI provides large language models including the moonshot-v1 series and kimi models. |
| Provider Route on LiteLLM | `moonshot/` |
| Link to Provider Doc | [Moonshot AI ↗](https://platform.moonshot.ai/) |
| Base URL | `https://api.moonshot.ai/` |
| Supported Operations | [`/chat/completions`](/docs/providers/moonshot#usage---litellm-python-sdk) |

<br />
<br />

https://platform.moonshot.ai/

**We support ALL Moonshot AI models, just set `moonshot/` as a prefix when sending completion requests**

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["MOONSHOT_API_KEY"] = ""  # your Moonshot AI API key
```

**ATTENTION:**

Moonshot AI offers two distinct API endpoints: a global one and a China-specific one.
- Global API Base URL: `https://api.moonshot.ai/v1` (This is the one currently implemented)
- China API Base URL: `https://api.moonshot.cn/v1`

You can overwrite the base url with:

```
os.environ["MOONSHOT_API_BASE"] = "https://api.moonshot.cn/v1"
```

## Kimi K3.1 Pro

Use `moonshot/kimi-k3.1-pro` or `moonshot/kimi-k3.1-pro-highspeed` for Kimi K3.1 Pro. Both models support a 1M-token context, image and video input, streaming, and tool calls. See the [provider quickstart](https://platform.kimi.ai/docs/guide/kimi-k3-1-pro-quickstart) and [pricing](https://platform.kimi.ai/docs/pricing/chat).

Thinking is always enabled. Set `reasoning_effort` to `"low"`, `"high"`, or `"max"`; the provider defaults to `"max"` when omitted. Preserve the complete assistant message, including `reasoning_content` and `tool_calls`, when you send conversation history.

<Tabs>
<TabItem value="sdk" label="LiteLLM Python SDK">

Set `MOONSHOT_API_KEY` in your environment, then call the model.

```python showLineNumbers title="Kimi K3.1 Pro"
from litellm import completion

response = completion(
    model="moonshot/kimi-k3.1-pro",
    messages=[{"role": "user", "content": "Explain the tradeoffs of database sharding."}],
    reasoning_effort="high",
    max_completion_tokens=8192,
)

print(response.choices[0].message.content)
```

Use `model="moonshot/kimi-k3.1-pro-highspeed"` for the high-speed variant. Add `stream=True` to stream the response.

</TabItem>
<TabItem value="proxy" label="LiteLLM Proxy">

Add both models to your proxy configuration.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: kimi-k3.1-pro
    litellm_params:
      model: moonshot/kimi-k3.1-pro
      api_key: os.environ/MOONSHOT_API_KEY

  - model_name: kimi-k3.1-pro-highspeed
    litellm_params:
      model: moonshot/kimi-k3.1-pro-highspeed
      api_key: os.environ/MOONSHOT_API_KEY
```

Start the proxy with `litellm --config config.yaml`. Set `LITELLM_API_KEY` to your proxy key, then send a request.

```bash showLineNumbers title="Kimi K3.1 Pro via Proxy"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "kimi-k3.1-pro-highspeed",
    "messages": [{"role": "user", "content": "Explain the tradeoffs of database sharding."}],
    "reasoning_effort": "high",
    "max_completion_tokens": 8192
  }'
```

</TabItem>
</Tabs>

Omit `temperature`, `top_p`, `n`, `presence_penalty`, and `frequency_penalty`. These parameters have fixed values on K3.1 Pro. LiteLLM rejects unsupported overrides unless you set `drop_params=True` on the SDK call or `litellm_settings.drop_params: true` in the proxy configuration.

K3.1 Pro supports `tool_choice="required"` natively. LiteLLM forwards it without adding a prompt hint. Return one tool result with the matching `tool_call_id` for every assistant tool call.

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Moonshot Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["MOONSHOT_API_KEY"] = ""  # your Moonshot AI API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# Moonshot call
response = completion(
    model="moonshot/moonshot-v1-8k", 
    messages=messages
)

print(response)
```

### Streaming

```python showLineNumbers title="Moonshot Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["MOONSHOT_API_KEY"] = ""  # your Moonshot AI API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

# Moonshot call with streaming
response = completion(
    model="moonshot/moonshot-v1-8k", 
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
  - model_name: moonshot-v1-8k
    litellm_params:
      model: moonshot/moonshot-v1-8k
      api_key: os.environ/MOONSHOT_API_KEY

  - model_name: moonshot-v1-32k
    litellm_params:
      model: moonshot/moonshot-v1-32k
      api_key: os.environ/MOONSHOT_API_KEY

  - model_name: moonshot-v1-128k
    litellm_params:
      model: moonshot/moonshot-v1-128k
      api_key: os.environ/MOONSHOT_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Moonshot via Proxy - Non-streaming"
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key"       # Your proxy API key
)

# Non-streaming response
response = client.chat.completions.create(
    model="moonshot-v1-8k",
    messages=[{"role": "user", "content": "hello from litellm"}]
)

print(response.choices[0].message.content)
```

```python showLineNumbers title="Moonshot via Proxy - Streaming"
from openai import OpenAI

# Initialize client with your proxy URL
client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key"       # Your proxy API key
)

# Streaming response
response = client.chat.completions.create(
    model="moonshot-v1-8k",
    messages=[{"role": "user", "content": "hello from litellm"}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

</TabItem>

<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="Moonshot via Proxy - LiteLLM SDK"
import litellm

# Configure LiteLLM to use your proxy
response = litellm.completion(
    model="litellm_proxy/moonshot-v1-8k",
    messages=[{"role": "user", "content": "hello from litellm"}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key"
)

print(response.choices[0].message.content)
```

```python showLineNumbers title="Moonshot via Proxy - LiteLLM SDK Streaming"
import litellm

# Configure LiteLLM to use your proxy with streaming
response = litellm.completion(
    model="litellm_proxy/moonshot-v1-8k",
    messages=[{"role": "user", "content": "hello from litellm"}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key",
    stream=True
)

for chunk in response:
    if hasattr(chunk.choices[0], 'delta') and chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Moonshot via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "moonshot-v1-8k",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

```bash showLineNumbers title="Moonshot via Proxy - cURL Streaming"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "moonshot-v1-8k",
    "messages": [{"role": "user", "content": "hello from litellm"}],
    "stream": true
  }'
```

</TabItem>
</Tabs>

For more detailed information on using the LiteLLM Proxy, see the [LiteLLM Proxy documentation](../providers/litellm_proxy).

## Image / Vision Support

Moonshot vision models (`kimi-k3.1-pro`, `kimi-k3.1-pro-highspeed`, `kimi-k2.5`, `kimi-latest`, `moonshot-v1-*-vision-preview`, etc.) accept the standard OpenAI content array with `image_url` blocks.

LiteLLM automatically detects when your messages contain images and preserves the content array so the image payload reaches the Moonshot API. For text-only requests the content is flattened to a plain string, as required by Moonshot text models.

K3.1 Pro does not accept public image URLs. Use a base64 data URL for an image or an `ms://` file URI after uploading the media to Moonshot. See the [vision input guide](https://platform.kimi.ai/docs/guide/use-kimi-vision-model).

```python showLineNumbers title="Kimi K3.1 Pro Vision Example"
import base64
from pathlib import Path

import litellm

image_data = base64.b64encode(Path("image.png").read_bytes()).decode()

response = litellm.completion(
    model="moonshot/kimi-k3.1-pro",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What is in this image?"},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_data}"},
                },
            ],
        }
    ],
)

print(response.choices[0].message.content)
```

## Moonshot AI Limitations & LiteLLM Handling

LiteLLM automatically handles the following [Moonshot AI limitations](https://platform.moonshot.ai/docs/guide/migrating-from-openai-to-kimi#about-api-compatibility) to keep OpenAI compatibility:

The temperature handling below applies to older Moonshot models. For K3.1 Pro, omit the fixed sampling parameters described above.

### Temperature Range Limitation
**Limitation**: Moonshot AI only supports temperature range [0, 1] (vs OpenAI's [0, 2])  
**LiteLLM Handling**: Automatically clamps any temperature > 1 to 1

### Temperature + Multiple Outputs Limitation  
**Limitation**: If temperature < 0.3 and n > 1, Moonshot AI raises an exception  
**LiteLLM Handling**: Automatically sets temperature to 0.3 when this condition is detected

### Tool Choice "Required"

K3.1 Pro and K3.1 Pro Highspeed support `tool_choice="required"` natively. For older Moonshot models without this capability in the model catalog, LiteLLM removes the parameter and adds the message "Please select a tool to handle the current issue."
