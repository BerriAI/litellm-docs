---
title: "deAPI API with LiteLLM: Python SDK and Gateway"
sidebar_label: "deAPI"
description: "Call open chat, image, speech, transcription, embedding and video models on deAPI from the Python SDK or AI Gateway, with deAPI-reported cost on every request."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# deAPI

## Overview

| Property | Details |
|-------|-------|
| Description | deAPI serves open models for chat, image generation and editing, text to speech, transcription, embeddings and video behind one OpenAI-compatible API, and reports the real cost of every request in the response. |
| Provider Route on LiteLLM | `deapi/` |
| Link to Provider Doc | [deAPI Documentation ↗](https://docs.deapi.ai/openai-compatibility) |
| Base URL | `https://oai.deapi.ai/v1` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/embeddings`](#usage---embeddings), [`/images/generations`](#usage---images), [`/images/edits`](#usage---images), [`/audio/speech`](#usage---audio-transcription-and-speech), [`/audio/transcriptions`](#usage---audio-transcription-and-speech), [`/videos`](#usage---video-generation) |

<br />
<br />

https://docs.deapi.ai/openai-compatibility

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["DEAPI_API_KEY"] = ""  # your deAPI API key, starts with sk-dp-
```

Keys are created in the deAPI dashboard at https://app.deapi.ai/settings/api-keys.

## Optional Variables

```python showLineNumbers title="Environment Variables"
os.environ["DEAPI_API_BASE"] = "https://oai.deapi.ai/v1"  # default
```

## Model Names

Use the deAPI model id with the `deapi/` prefix, for example `deapi/deepseek-v4.1-flash`, `deapi/Flux_2_Klein_4B_BF16` or `deapi/Kokoro`. LiteLLM strips only the prefix. `GET https://oai.deapi.ai/v1/models` lists the models your key can call, and chat models there carry their per-token `pricing`, context length and supported parameters. From LiteLLM, `litellm.get_valid_models(custom_llm_provider="deapi", check_provider_endpoint=True)` returns the same list with the `deapi/` prefix applied.

| Operation | Models (November 2026) |
|-------|-------|
| Chat | `deepseek-v4.1-flash`, `deepseek-v4.1-flash:economy`, `glm-5.3`, `glm-5.3-flash`, `gpt-6-luna`, `hy3`, `kimi-k3`, `qwen3.8-flash`, `qwen3.8-max`, `seed-2.0-lite`, `seed-2.0-mini`, `seed-2.0-pro`, `seed-2.1-turbo` |
| Image generation | `Flux_2_Klein_4B_BF16`, `Flux1schnell`, `ZImageTurbo_INT8`, `ZAnimeDistill_8Step_INT8` |
| Image editing | `Flux_2_Klein_4B_BF16`, `QwenImageEdit_Plus_NF4` |
| Text to speech | `Kokoro`, `Chatterbox`, `Qwen3_TTS_12Hz_1_7B_CustomVoice`, `Qwen3_TTS_12Hz_1_7B_VoiceDesign` |
| Transcription | `WhisperLargeV3Ct2`, `WhisperLargeV3` |
| Embeddings | `Bge_M3_FP16` |
| Video | `Ltx2_5_22B_Dist_INT8`, `Ltx2_3_22B_Dist_INT8`, `Ltxv_13B_0_9_8_Distilled_FP8`, `MiniMaxH3_33B_Turbo_INT8` |

The catalog changes over time, so treat `/v1/models` as the source of truth.

## Cost Tracking

deAPI reports what it charged for each request, in USD, as `usage.cost` in JSON answers and in the `X-DeAPI-Cost` response header. LiteLLM records that number as the request's spend instead of a price map estimate. On chat completion streams the cost arrives on the final usage chunk. LiteLLM always asks deAPI for that chunk, and forwards it to your client only when you set `stream_options={"include_usage": True}`.

| Endpoint | Cost source |
|-------|-------|
| `/chat/completions` | `usage.cost`, from the final usage chunk when streaming |
| `/embeddings` | `usage.cost` |
| `/images/generations`, `/images/edits` | `usage.cost`, the total for all `n` images |
| `/audio/speech` | `X-DeAPI-Cost` header, since the body is the audio |
| `/audio/transcriptions` | `X-DeAPI-Cost` header, for every `response_format` including `text` |
| `/videos` | Nothing on the create call while the job is queued. The status read of a completed job carries the settled cost as `usage.provider_reported_cost_usd` |

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="deAPI Non-streaming Completion"
import os
from litellm import completion

os.environ["DEAPI_API_KEY"] = ""  # your deAPI API key

response = completion(
    model="deapi/deepseek-v4.1-flash",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)

print(response.choices[0].message.content)
print(response._hidden_params["response_cost"])  # the cost deAPI reported
```

### Streaming

```python showLineNumbers title="deAPI Streaming Completion"
import os
from litellm import completion

os.environ["DEAPI_API_KEY"] = ""  # your deAPI API key

response = completion(
    model="deapi/qwen3.8-flash",
    messages=[{"content": "Write a short story about AI", "role": "user"}],
    stream=True,
    stream_options={"include_usage": True},
)

for chunk in response:
    print(chunk)
```

### Reasoning

Every deAPI chat model takes `reasoning_effort`. `none` turns reasoning off on most models, while `glm-5.3` accepts only `low`, `high` and `max`. A value a model does not accept comes back as a 400 that lists the supported values. Reasoning tokens count toward `max_tokens` and are billed as output, so leave room for them, and read the reasoning text from `reasoning_content` on the message or the stream delta.

```python showLineNumbers title="deAPI Reasoning"
response = completion(
    model="deapi/seed-2.0-pro",
    messages=[{"content": "A train leaves at 09:47 and arrives at 13:15. How many minutes is the trip?", "role": "user"}],
    reasoning_effort="low",
    max_tokens=2048,
)

print(response.choices[0].message.reasoning_content)
print(response.choices[0].message.content)
```

## Usage - Embeddings

```python showLineNumbers title="deAPI Embeddings"
import litellm

response = litellm.embedding(model="deapi/Bge_M3_FP16", input=["Hello, how are you?", "Fine, thanks"])

print(len(response.data[0]["embedding"]))
```

`usage.prompt_tokens` is always 0 because the embedding model does not count tokens, while `usage.cost` holds the real charge.

## Usage - Images

```python showLineNumbers title="deAPI Image Generation and Editing"
import base64
import litellm

image = litellm.image_generation(
    model="deapi/Flux_2_Klein_4B_BF16",
    prompt="A watercolor lighthouse at dawn",
    size="1024x1024",
    response_format="b64_json",
)
with open("lighthouse.png", "wb") as f:
    f.write(base64.b64decode(image.data[0].b64_json))

with open("lighthouse.png", "rb") as source:
    edited = litellm.image_edit(
        model="deapi/Flux_2_Klein_4B_BF16",
        image=source,
        prompt="Make the sky stormy",
        response_format="b64_json",
    )
```

`quality` maps to the model's step and guidance presets. Images are PNG, so `background="transparent"` and other output formats are rejected with a 400, and edits do not take a `mask`.

## Usage - Audio (transcription and speech)

```python showLineNumbers title="deAPI Audio"
import litellm

speech = litellm.speech(model="deapi/Kokoro", input="Hello, how are you?", voice="af_bella")
speech.stream_to_file("hello.mp3")

with open("hello.mp3", "rb") as audio:
    transcript = litellm.transcription(model="deapi/WhisperLargeV3Ct2", file=audio, language="en")

print(transcript.text)
```

Speech is returned as MP3. Transcription takes `language`, `response_format` (`json`, `text`, `verbose_json` or `diarized_json`) and `timestamp_granularities`.

## Usage - Video Generation

A job is created, polled and downloaded through LiteLLM's video functions, and the id LiteLLM returns routes the later calls back to deAPI. A start image goes through `input_reference`.

```python showLineNumbers title="deAPI Video Generation"
import time
import litellm

job = litellm.video_generation(model="deapi/Ltx2_5_22B_Dist_INT8", prompt="A red ball rolling across a wooden table", seconds="4")

while job.status not in ("completed", "failed"):
    time.sleep(5)
    job = litellm.video_status(video_id=job.id)

print(job.usage)  # provider_reported_cost_usd is deAPI's settled cost
with open("ball.mp4", "wb") as f:
    f.write(litellm.video_content(video_id=job.id))
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: deepseek-v4.1-flash
    litellm_params:
      model: deapi/deepseek-v4.1-flash
      api_key: os.environ/DEAPI_API_KEY
  - model_name: bge-m3
    litellm_params:
      model: deapi/Bge_M3_FP16
      api_key: os.environ/DEAPI_API_KEY
  - model_name: flux-2-klein
    litellm_params:
      model: deapi/Flux_2_Klein_4B_BF16
      api_key: os.environ/DEAPI_API_KEY
  - model_name: kokoro
    litellm_params:
      model: deapi/Kokoro
      api_key: os.environ/DEAPI_API_KEY
  - model_name: whisper-large-v3-ct2
    litellm_params:
      model: deapi/WhisperLargeV3Ct2
      api_key: os.environ/DEAPI_API_KEY
```

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="deAPI via Proxy"
from openai import OpenAI

client = OpenAI(base_url="http://localhost:4000", api_key="your-proxy-api-key")

response = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="deAPI via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{"model": "deepseek-v4.1-flash", "messages": [{"role": "user", "content": "Hello, how are you?"}]}'
```

</TabItem>
</Tabs>

The proxy's `x-litellm-response-cost` response header and the spend logs carry the cost deAPI reported for the request.

## Supported OpenAI Parameters

Chat models take `temperature`, `top_p`, `max_tokens`, `max_completion_tokens`, `stop`, `presence_penalty`, `frequency_penalty`, `stream`, `stream_options`, `tools`, `tool_choice`, `parallel_tool_calls`, `response_format` and `reasoning_effort`. Each model's `supported_parameters` in `/v1/models` lists what it accepts, and a parameter or value a model cannot honor is rejected with a 400 instead of being ignored.
