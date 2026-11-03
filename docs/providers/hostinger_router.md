import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Hostinger AI Router

<SinceVersion v="1.109.0" />

## Overview

| Property | Details |
|-------|-------|
| Description | Hostinger AI Router is a hosted, OpenAI-compatible gateway to OpenAI, Anthropic, Google, and other model families, billed in Hostinger credits. |
| Provider Route on LiteLLM | `hostinger_router/` |
| Link to Provider Doc | [Hostinger AI Router ↗](https://www.hostinger.com/ai-router) |
| Base URL | `https://router.hostinger.com/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#responses-api), [`/messages`](#anthropic-messages-api), [`/embeddings`](#embeddings) |

<br />
<br />

**We support ALL Hostinger AI Router models, just set `hostinger_router/` as a prefix when sending requests.** The router's own model ids, such as `claude-sonnet-5` or `gpt-5.2`, go after the prefix.

## Available Models

| Model | Mode |
|-------|------|
| `hostinger_router/claude-sonnet-5` | chat |
| `hostinger_router/gpt-5.2` | chat |
| `hostinger_router/text-embedding-3-small` | embedding |
| `hostinger_router/text-embedding-3-large` | embedding |

LiteLLM tracks spend for the models above, counting one Hostinger credit as $0.01. Any other model in the router's catalog also works with the `hostinger_router/` prefix, but LiteLLM records its spend as $0 until a price is added, which you can set yourself through `model_info` on the proxy.

Every chat model works on `/chat/completions`, `/responses`, and `/messages`. When LiteLLM knows a model serves `/v1/responses` or `/v1/messages` on the router, such as `gpt-5.2` on `/responses` or `claude-sonnet-5` on `/messages`, it calls that route directly. For every other model, LiteLLM converts the call and sends it through the router's `/v1/chat/completions`.

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["HOSTINGER_ROUTER_API_KEY"] = ""  # your Hostinger AI Router API key
```

Create an API key in the AI Router section of hPanel.

You can overwrite the base url with:

```
os.environ["HOSTINGER_ROUTER_API_BASE"] = "https://router.hostinger.com/v1"
```

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers keep-model-ids title="Hostinger AI Router Non-streaming Completion"
import os
from litellm import completion

os.environ["HOSTINGER_ROUTER_API_KEY"] = ""  # your Hostinger AI Router API key

response = completion(
    model="hostinger_router/claude-sonnet-5",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)

print(response)
```

### Streaming

```python showLineNumbers title="Hostinger AI Router Streaming Completion"
import os
from litellm import completion

os.environ["HOSTINGER_ROUTER_API_KEY"] = ""  # your Hostinger AI Router API key

response = completion(
    model="hostinger_router/gpt-5.2",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Responses API

LiteLLM sends `/responses` calls for `gpt-5.2` to the router's own `/v1/responses` endpoint, and converts calls for other models through `/v1/chat/completions`.

```python showLineNumbers title="Hostinger AI Router Responses API"
import os
import litellm

os.environ["HOSTINGER_ROUTER_API_KEY"] = ""  # your Hostinger AI Router API key

response = litellm.responses(
    model="hostinger_router/gpt-5.2",
    input="Name three primary colors",
)

print(response.output[0].content[0].text)
```

### Anthropic Messages API

LiteLLM sends `/messages` calls for `claude-sonnet-5` to the router's own `/v1/messages` endpoint, and converts calls for other models through `/v1/chat/completions`.

```python showLineNumbers keep-model-ids title="Hostinger AI Router Messages API"
import asyncio
import os
import litellm

os.environ["HOSTINGER_ROUTER_API_KEY"] = ""  # your Hostinger AI Router API key

async def main():
    response = await litellm.anthropic.messages.acreate(
        model="hostinger_router/claude-sonnet-5",
        messages=[{"role": "user", "content": "Name three primary colors"}],
        max_tokens=200,
    )
    print(response["content"])

asyncio.run(main())
```

### Embeddings

```python showLineNumbers title="Hostinger AI Router Embeddings"
import os
import litellm

os.environ["HOSTINGER_ROUTER_API_KEY"] = ""  # your Hostinger AI Router API key

response = litellm.embedding(
    model="hostinger_router/text-embedding-3-small",
    input=["hello from litellm"],
)

print(len(response.data[0]["embedding"]))
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers keep-model-ids title="config.yaml"
model_list:
  - model_name: hostinger-claude
    litellm_params:
      model: hostinger_router/claude-sonnet-5
      api_key: os.environ/HOSTINGER_ROUTER_API_KEY

  - model_name: hostinger-gpt
    litellm_params:
      model: hostinger_router/gpt-5.2
      api_key: os.environ/HOSTINGER_ROUTER_API_KEY

  - model_name: hostinger-embedding
    litellm_params:
      model: hostinger_router/text-embedding-3-small
      api_key: os.environ/HOSTINGER_ROUTER_API_KEY
```

You can also add these models from the Admin UI. Open Models, click Add Model, pick Hostinger Router as the provider, and paste your API key.

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
printf 'Local proxy key: %s\n' "$LITELLM_MASTER_KEY"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

In another terminal, set `LITELLM_API_KEY` to the key printed above, then call the proxy:

<Tabs>
<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Hostinger AI Router via Proxy - Chat Completions"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "hostinger-claude",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

```bash showLineNumbers title="Hostinger AI Router via Proxy - Responses API"
curl http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "hostinger-gpt",
    "input": "hello from litellm"
  }'
```

```bash showLineNumbers title="Hostinger AI Router via Proxy - Messages API"
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "hostinger-claude",
    "max_tokens": 200,
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

```bash showLineNumbers title="Hostinger AI Router via Proxy - Embeddings"
curl http://localhost:4000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "hostinger-embedding",
    "input": ["hello from litellm"]
  }'
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Hostinger AI Router via Proxy - OpenAI SDK"
import os
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key=os.environ["LITELLM_API_KEY"],
)

response = client.chat.completions.create(
    model="hostinger-claude",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

For more detailed information on using the LiteLLM Proxy, see the [LiteLLM Proxy documentation](../providers/litellm_proxy).
