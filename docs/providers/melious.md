import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Melious

## Overview

| Property | Details |
|-------|-------|
| Description | Melious provides European open-weight AI inference with OpenAI-compatible chat completions, embeddings, image generation, and audio transcription APIs. |
| Provider Route on LiteLLM | `melious/` |
| Link to Provider Doc | [Melious Documentation](https://melious.ai/docs/reference) |
| Default Base URL | `https://api.melious.ai/v1` |
| Supported Operations | `/chat/completions`, `/messages`, `/embeddings`, `/images/generations`, `/audio/transcriptions` |

**We support Melious models through LiteLLM's OpenAI-compatible provider route. Use `melious/` as the model prefix.**

## Required Variables

```python showLineNumbers title="Environment Variables"
import os

os.environ["MELIOUS_API_KEY"] = "your-melious-api-key"
```

Optional base URL override:

```python showLineNumbers title="Optional Base URL Override"
import os

os.environ["MELIOUS_API_BASE"] = "https://api.melious.ai/v1"
```

## Available Models

Melious exposes a dynamic model catalog through `GET /v1/models`. Use the model IDs returned by Melious with the `melious/` route prefix.

```bash showLineNumbers title="List Melious Models"
curl "https://api.melious.ai/v1/models?include_meta=true" \
  -H "Authorization: Bearer $MELIOUS_API_KEY"
```

Melious model metadata includes `_meta.type`, which tells you which upstream endpoint to use. LiteLLM supports Melious chat models through `completion()`, Anthropic-compatible messages through `/v1/messages`, embedding models through `embedding()`, image generation models through `image_generation()`, and speech-to-text models through `transcription()`.

## Usage - LiteLLM Python SDK

### Chat Completions

```python showLineNumbers title="Melious Chat Completion"
import os
from litellm import completion

os.environ["MELIOUS_API_KEY"] = "your-melious-api-key"

response = completion(
    model="melious/<your-chat-model>",
    messages=[{"role": "user", "content": "Say hello in one short sentence."}],
)

print(response.choices[0].message.content)
```

### Streaming

```python showLineNumbers title="Melious Streaming Chat Completion"
import os
from litellm import completion

os.environ["MELIOUS_API_KEY"] = "your-melious-api-key"

response = completion(
    model="melious/<your-chat-model>",
    messages=[{"role": "user", "content": "Write a haiku about efficient inference."}],
    stream=True,
)

for chunk in response:
    print(chunk)
```

### Embeddings

```python showLineNumbers title="Melious Embeddings"
import os
from litellm import embedding

os.environ["MELIOUS_API_KEY"] = "your-melious-api-key"

response = embedding(
    model="melious/<your-embedding-model>",
    input=["A Hanseatic city is a city that...", "Hamburg is a port city..."],
)

print(len(response.data), "vectors")
```

### Image Generation

```python showLineNumbers title="Melious Image Generation"
import os
from litellm import image_generation

os.environ["MELIOUS_API_KEY"] = "your-melious-api-key"

response = image_generation(
    model="melious/<your-image-model>",
    prompt="A compact solar-powered data center in the Netherlands",
)

print(response.data[0])
```

### Audio Transcription

```python showLineNumbers title="Melious Audio Transcription"
import os
from litellm import transcription

os.environ["MELIOUS_API_KEY"] = "your-melious-api-key"

with open("audio.mp3", "rb") as audio_file:
    response = transcription(
        model="melious/<your-transcription-model>",
        file=audio_file,
    )

print(response.text)
```

## Usage - LiteLLM Proxy

Add Melious to your LiteLLM Proxy configuration:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: melious-chat
    litellm_params:
      model: melious/<your-chat-model>
      api_key: os.environ/MELIOUS_API_KEY

  - model_name: melious-embed
    litellm_params:
      model: melious/<your-embedding-model>
      api_key: os.environ/MELIOUS_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Start the proxy:

```bash showLineNumbers title="Start LiteLLM Proxy"
export MELIOUS_API_KEY="your-melious-api-key"
export LITELLM_MASTER_KEY="sk-melious-proxy"
litellm --config config.yaml --port 4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Melious via Proxy - OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="sk-melious-proxy",
)

response = client.chat.completions.create(
    model="melious-chat",
    messages=[{"role": "user", "content": "hello from litellm"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="Melious via Proxy - LiteLLM SDK"
import litellm

response = litellm.completion(
    model="litellm_proxy/melious-chat",
    messages=[{"role": "user", "content": "hello from litellm"}],
    api_base="http://localhost:4000",
    api_key="sk-melious-proxy",
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Melious via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-melious-proxy" \
  -d '{
    "model": "melious-chat",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

```bash showLineNumbers title="Melious Embeddings via Proxy - cURL"
curl http://localhost:4000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-melious-proxy" \
  -d '{
    "model": "melious-embed",
    "input": ["hello from litellm"]
  }'
```

</TabItem>
</Tabs>

## Notes

- Melious' OpenAI-compatible base URL is `https://api.melious.ai/v1`.
- LiteLLM supports Melious through the `melious/` provider prefix.
- Melious documents additional endpoints such as rerank, batches, and files. This LiteLLM provider entry wires the OpenAI-compatible chat completions, embeddings, image generation, and audio transcription paths, plus the Anthropic-compatible messages path.
- Melious' chat completions docs use `max_tokens`; LiteLLM does not add a `max_completion_tokens` parameter mapping for this provider.
