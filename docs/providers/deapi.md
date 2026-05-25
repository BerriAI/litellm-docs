import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# deAPI

## Overview

| Property | Details |
|-------|-------|
| Description | deAPI is an OpenAI-compatible inference gateway that exposes embeddings, text-to-speech, transcription, and image generation/editing endpoints over a decentralized compute network. |
| Provider Route on LiteLLM | `deapi/` |
| Link to Provider Doc | [deAPI Documentation ↗](https://docs.deapi.ai) |
| OpenAI Compatibility | [deAPI OpenAI Compatibility ↗](https://docs.deapi.ai/openai-compatibility) |
| Base URL | `https://oai.deapi.ai/v1` |
| Supported Operations | [`/embeddings`](#embeddings), [`/audio/speech`](#text-to-speech), [`/audio/transcriptions`](#transcription), [`/images/generations`](#image-generation), [`/images/edits`](#image-edits) |

<br />
<br />

**deAPI does not currently support chat/completions, messages, responses, moderations, rerank, or batches.** See [https://docs.deapi.ai/openai-compatibility](https://docs.deapi.ai/openai-compatibility) for the authoritative endpoint and model list.

## Available Models

Model identifiers are passed to LiteLLM as `deapi/<MODEL>`. The exact model IDs available on the deAPI gateway change over time — always cross-check against [https://docs.deapi.ai/openai-compatibility](https://docs.deapi.ai/openai-compatibility) for the current list.

| Endpoint | Example Model |
|-------|-------|
| Embeddings | `deapi/Bge_M3_FP16` |
| Text-to-Speech | `deapi/Kokoro` |
| Transcription | `deapi/WhisperLargeV3` |
| Image Generation | `deapi/Flux1schnell` |
| Image Edits | `deapi/Flux_2_Klein_4B_BF16` |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["DEAPI_API_KEY"] = ""   # your deAPI key, e.g. "dpn-sk-..."
os.environ["DEAPI_API_BASE"] = "https://oai.deapi.ai/v1"  # optional, this is the default
```

## Embeddings

### Usage - LiteLLM Python SDK

```python showLineNumbers title="deAPI Embeddings"
import os
import litellm
from litellm import embedding

os.environ["DEAPI_API_KEY"] = ""  # your deAPI key

response = embedding(
    model="deapi/Bge_M3_FP16",
    input=["good morning from litellm", "hello world"],
)

print(response)
```

### Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deapi-embed
    litellm_params:
      model: deapi/Bge_M3_FP16
      api_key: os.environ/DEAPI_API_KEY
      api_base: https://oai.deapi.ai/v1
```

## Image Generation

### Usage - LiteLLM Python SDK

```python showLineNumbers title="deAPI Image Generation"
import os
import litellm
from litellm import image_generation

os.environ["DEAPI_API_KEY"] = ""  # your deAPI key

response = image_generation(
    model="deapi/Flux1schnell",
    prompt="a serene mountain lake at sunrise, photorealistic",
    n=1,
    size="1024x1024",
)

print(response)
```

:::note
Supported `size` values are model-specific (Flux1schnell supports 256–2048 px in 128 px steps). Refer to [https://docs.deapi.ai/openai-compatibility](https://docs.deapi.ai/openai-compatibility) for per-model limits.
:::

### Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deapi-image
    litellm_params:
      model: deapi/Flux1schnell
      api_key: os.environ/DEAPI_API_KEY
      api_base: https://oai.deapi.ai/v1
```

## Image Edits

Image edits require a model with `img2img` support. On deAPI this includes `Flux_2_Klein_4B_BF16` and `QwenImageEdit_Plus_NF4`. `Flux1schnell` is text-to-image only and will reject edit requests.

### Usage - LiteLLM Python SDK

```python showLineNumbers title="deAPI Image Edits"
import os
import litellm
from litellm import image_edit

os.environ["DEAPI_API_KEY"] = ""  # your deAPI key

with open("input.png", "rb") as image_file:
    response = image_edit(
        model="deapi/Flux_2_Klein_4B_BF16",
        image=image_file,
        prompt="add a small red boat on the water",
    )

print(response)
```

:::note
deAPI's image edits endpoint does not currently support inpainting masks; passing a `mask` parameter will return a 400 error.
:::

### Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deapi-image-edit
    litellm_params:
      model: deapi/Flux_2_Klein_4B_BF16
      api_key: os.environ/DEAPI_API_KEY
      api_base: https://oai.deapi.ai/v1
```

## Text-to-Speech

### Usage - LiteLLM Python SDK

```python showLineNumbers title="deAPI Text-to-Speech"
import os
from pathlib import Path
import litellm
from litellm import speech

os.environ["DEAPI_API_KEY"] = ""  # your deAPI key

speech_file_path = Path(__file__).parent / "speech.mp3"

response = speech(
    model="deapi/Kokoro",
    voice="af_nova",
    input="Hello from LiteLLM and deAPI.",
)

response.stream_to_file(speech_file_path)
```

:::note
deAPI's `Kokoro` model uses language-prefixed voice slugs (e.g., `af_alloy`, `af_nova`, `am_adam`, `bf_alice`, `bm_george`). The first two characters indicate language and gender — `af`/`am` for American Female/Male, `bf`/`bm` for British Female/Male, plus Spanish/French/etc. variants. Fetch the full voice catalog via `GET https://api.deapi.ai/api/v2/models`.
:::

### Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deapi-tts
    litellm_params:
      model: deapi/Kokoro
      api_key: os.environ/DEAPI_API_KEY
      api_base: https://oai.deapi.ai/v1
```

## Transcription

### Usage - LiteLLM Python SDK

```python showLineNumbers title="deAPI Transcription"
import os
import litellm
from litellm import transcription

os.environ["DEAPI_API_KEY"] = ""  # your deAPI key

with open("audio.mp3", "rb") as audio_file:
    response = transcription(
        model="deapi/WhisperLargeV3",
        file=audio_file,
    )

print(response)
```

:::note
deAPI's transcription endpoint accepts audio/video uploads. Refer to [https://docs.deapi.ai/openai-compatibility](https://docs.deapi.ai/openai-compatibility) for current file-size limits.
:::

### Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deapi-transcribe
    litellm_params:
      model: deapi/WhisperLargeV3
      api_key: os.environ/DEAPI_API_KEY
      api_base: https://oai.deapi.ai/v1
```

## Custom API Base

**Option 1: Environment variable**

```python showLineNumbers title="Custom API Base via env var"
import os
from litellm import embedding

os.environ["DEAPI_API_BASE"] = "https://oai.deapi.ai/v1"
os.environ["DEAPI_API_KEY"] = ""  # your API key

response = embedding(
    model="deapi/Bge_M3_FP16",
    input=["hello"],
)
```

**Option 2: Pass directly**

```python showLineNumbers title="Custom API Base via parameter"
from litellm import embedding

response = embedding(
    model="deapi/Bge_M3_FP16",
    input=["hello"],
    api_base="https://oai.deapi.ai/v1",
    api_key="dpn-sk-...",
)
```

## Pricing

deAPI publishes pricing per model on [https://deapi.ai/pricing](https://deapi.ai/pricing).
