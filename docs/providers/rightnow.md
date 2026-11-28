---
title: "RightNow API with LiteLLM: Python SDK and Gateway"
sidebar_label: "RightNow"
description: "Call RightNow's open-weight models, such as GLM 5.3, Kimi K3.1 Pro and DeepSeek V4.1 Flash, with streaming, tool calling, prompt caching and spend tracking."
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# RightNow

LiteLLM supports the chat models served through the RightNow API.

| Property | Details |
|-------|-------|
| Description | RightNow serves open-weight models through an OpenAI-compatible API. |
| Provider Route on LiteLLM | `rightnow/` |
| Provider Doc | [RightNow docs](https://www.rightnowai.co/docs/open-models) |
| API Endpoint for Provider | https://api.rightnowai.co/v1 |
| Supported OpenAI Endpoints | `/chat/completions` |

## API Key

Create an API key as the [RightNow authentication guide](https://www.rightnowai.co/docs/open-models/authentication) describes, then set it in your environment.

```python
import os

os.environ["RIGHTNOW_API_KEY"] = "your-api-key"
```

## Usage

```python
from litellm import completion
import os

os.environ["RIGHTNOW_API_KEY"] = "your-api-key"

response = completion(
    model="rightnow/deepseek-v4-1-flash-1017",
    messages=[{"role": "user", "content": "What is LiteLLM?"}],
)
print(response)
```

## Streaming

```python
from litellm import completion
import os

os.environ["RIGHTNOW_API_KEY"] = "your-api-key"

stream = completion(
    model="rightnow/deepseek-v4-1-flash-1017",
    messages=[{"role": "user", "content": "What is LiteLLM?"}],
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

## Usage with LiteLLM Proxy

1. Add the model to your `config.yaml`.

```yaml
model_list:
  - model_name: deepseek-v4-1-flash-1017
    litellm_params:
      model: rightnow/deepseek-v4-1-flash-1017
      api_key: os.environ/RIGHTNOW_API_KEY
```

2. Start the proxy.

```bash
litellm --config /path/to/config.yaml
```

3. Send a request.

<Tabs>
<TabItem value="curl" label="Curl">

```bash
curl http://0.0.0.0:4000/v1/chat/completions   -H "Content-Type: application/json"   -H "Authorization: Bearer sk-1234"   -d '{
    "model": "deepseek-v4-1-flash-1017",
    "messages": [{"role": "user", "content": "What is LiteLLM?"}]
  }'
```

</TabItem>
<TabItem value="openai" label="OpenAI SDK">

```python
from openai import OpenAI

client = OpenAI(base_url="http://0.0.0.0:4000", api_key="sk-1234")

response = client.chat.completions.create(
    model="deepseek-v4-1-flash-1017",
    messages=[{"role": "user", "content": "What is LiteLLM?"}],
)
print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

## Supported Models

| Model | LiteLLM model name | Context window | Max output tokens | Image input |
|-------|-------|-------|-------|-------|
| GLM 5.3 | `rightnow/glm-5-3` | 1,048,576 | 65,536 | No |
| GLM 5.3 Flash | `rightnow/glm-5-3-flash` | 1,048,576 | 65,536 | Yes |
| Kimi K3.1 Pro | `rightnow/kimi-k3-1-pro` | 1,048,576 | 32,768 | Yes |
| DeepSeek V4.1 Flash | `rightnow/deepseek-v4-1-flash` | 1,048,576 | 65,536 | No |
| DeepSeek V4.1 Flash 1017 | `rightnow/deepseek-v4-1-flash-1017` | 1,048,576 | 65,536 | Yes |
| Qwen3.8 27B | `rightnow/qwen3-8-27b` | 262,144 | 32,768 | Yes |
| Nemotron 3.5 Lightning 30B | `rightnow/nemotron-3-5-lightning-30b` | 262,144 | 65,536 | No |
| Ornith 1.5 35B | `rightnow/ornith-1-5-35b` | 262,144 | 65,536 | Yes |

All models support tool calling, structured output, streaming and prompt caching. Image input takes png, jpeg, webp or gif. Current prices are on the [RightNow models page](https://www.rightnowai.co/models).
