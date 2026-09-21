import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Eden AI

## Overview

| Property | Details |
|-------|-------|
| Description | Eden AI is an AI gateway: one API key and one bill for 1000+ LLMs from 30+ providers (OpenAI, Anthropic, Google, Mistral, DeepSeek, xAI, Amazon Bedrock, Azure and more), with the real cost of every request reported in the response. |
| Provider Route on LiteLLM | `edenai/` |
| Link to Provider Doc | [Eden AI Documentation ↗](https://www.edenai.co/docs) |
| Base URL | `https://api.edenai.run/v3` |
| Supported Operations | [`/chat/completions`](#usage---litellm-python-sdk), [`/responses`](#usage---responses-api), [`/v1/messages`](#usage---anthropic-messages-api), [`/embeddings`](#usage---embeddings), [`/audio/transcriptions`](#usage---audio-transcription-and-speech), [`/audio/speech`](#usage---audio-transcription-and-speech), [`/images/generations`](#usage---image-generation), [`/videos`](#usage---video-generation) |

<br />
<br />

https://www.edenai.co/docs

**We support ALL Eden AI chat models, just set `edenai/` as a prefix when sending completion requests**

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key
```

Keys are created in the Eden AI dashboard at https://app.edenai.run under Settings, API Keys.

## Optional Variables

```python showLineNumbers title="Environment Variables"
os.environ["EDENAI_API_BASE"] = "https://api.eu.edenai.run/v3"  # EU endpoint, same key. Default is https://api.edenai.run/v3
```

The EU endpoint accepts the same API key but serves only the subset of the catalog hosted in the EU, so model ids that work on the default host, including the `openai/gpt-mini-latest` and `anthropic/claude-sonnet-latest` examples on this page, may not exist there. Check https://api.eu.edenai.run/v3/models for the ids the EU host serves before switching.

## Model Names

Eden AI model ids are `provider/model`, for example `openai/gpt-mini-latest`, `anthropic/claude-sonnet-latest` or `google/gemini-3.7-flash`. Add the `edenai/` prefix and LiteLLM strips only that prefix, so `edenai/openai/gpt-mini-latest` reaches Eden AI as `openai/gpt-mini-latest`. A bare model name such as `edenai/mistral-small-latest` also works: Eden AI then picks the seller that serves the model (provider routing). Eden AI's own stable aliases, the catalog entries with an `alias_of` such as `openai/gpt-mini-latest`, only resolve with their vendor prefix. Region variants keep their suffix, as in `edenai/vertex/gemini-3.7-flash@eu`.

The catalog is public at https://app.edenai.run/models. From LiteLLM, `litellm.get_valid_models(custom_llm_provider="edenai", check_provider_endpoint=True)` returns the same list with the `edenai/` prefix applied.

## Route Every Eden AI Model Through One Deployment

The proxy can expose the whole catalog with a wildcard deployment. With `check_provider_endpoint` on, `/v1/models` lists every model from `https://api.edenai.run/v3/models` under the `edenai/` prefix, and a request for any of them, such as `edenai/mistral/mistral-small-latest`, routes through this deployment.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: edenai/*
    litellm_params:
      model: edenai/*
      api_key: os.environ/EDENAI_API_KEY

litellm_settings:
  check_provider_endpoint: true
```

## Cost Tracking

Every Eden AI response reports the request's cost in USD, after any account discount, and LiteLLM records that number as the request's spend instead of a price map estimate. On chat completion streams the cost arrives on the final usage chunk. LiteLLM always asks Eden AI for that chunk, and forwards it to your client only when you set `stream_options={"include_usage": True}`, so streaming clients see exactly the OpenAI behavior they expect.

| Endpoint | Non-streaming | Streaming |
|-------|-------|-------|
| `/chat/completions` | Eden AI's `cost` | Eden AI's `cost`, from the final usage chunk |
| `/responses` | Eden AI's `cost` | Eden AI's `cost`, from `usage.cost` on the `response.completed` event |
| `/v1/messages` | Eden AI's `cost` | Price map estimate, which is 0 unless you register the model's prices: Eden AI does not report a cost inside a Messages stream |
| `/embeddings` | Eden AI's `cost` | Not streamed |
| `/audio/transcriptions` | Eden AI's `cost` for the JSON formats; price map estimate from the clip's duration for `text`, `srt` and `vtt`, which Eden AI returns without a cost | Not streamed |
| `/audio/speech` | Eden AI's `cost`, from the `x-edenai-cost` response header | Not streamed |
| `/images/generations` | Eden AI's `cost` | Not streamed |
| `/videos` | 0 on the create call, which is what Eden AI reports while the job is queued; the settled cost appears on the job's status once it completes, as `usage.provider_reported_cost_usd`. Register the model's per-second price to bill an estimate on the create call instead | Not streamed |

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Eden AI Non-streaming Completion"
import os
from litellm import completion

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="edenai/openai/gpt-mini-latest",
    messages=messages,
)

print(response)
```

### Streaming

```python showLineNumbers title="Eden AI Streaming Completion"
import os
from litellm import completion

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

messages = [{"content": "Write a short story about AI", "role": "user"}]

response = completion(
    model="edenai/anthropic/claude-sonnet-latest",
    messages=messages,
    stream=True,
    stream_options={"include_usage": True},
)

for chunk in response:
    print(chunk)
```

### Eden AI parameters: fallbacks and routing

Eden AI accepts a few fields beyond the OpenAI set. `fallbacks` lists up to three `provider/model` ids tried in order when the primary model fails, and `routing` steers provider routing for bare model names (`sort` is `cost`, `speed`, `latency` or `exact`, and `allowed_providers` restricts the sellers). Pass them through `extra_body`:

```python showLineNumbers title="Eden AI fallbacks and routing"
import os
from litellm import completion

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

response = completion(
    model="edenai/gpt-5-mini",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
    extra_body={
        "fallbacks": ["anthropic/claude-sonnet-latest"],
        "routing": {"sort": "latency", "allowed_providers": ["openai", "azure"]},
    },
)

print(response)
```

## Usage - Responses API

Eden AI serves OpenAI's Responses API at `/v3/responses` for every model in its catalog, and LiteLLM routes `litellm.responses` and the proxy's `/v1/responses` there natively rather than emulating them over chat completions. Stateful features (`previous_response_id`, `store`, retrieving or deleting a response) only work when the seller natively supports the Responses API, which today means the OpenAI models; other sellers answer statelessly.

```python showLineNumbers title="Eden AI Responses API"
import os
import litellm

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

response = litellm.responses(
    model="edenai/openai/gpt-mini-latest",
    input="Hello, how are you?",
    max_output_tokens=200,
)

print(response.output_text)

stream = litellm.responses(
    model="edenai/anthropic/claude-sonnet-latest",
    input="Write a short story about AI",
    stream=True,
)

for event in stream:
    print(event)
```

`fallbacks` and `routing` go through `extra_body` here too.

## Usage - Anthropic Messages API

Eden AI serves Anthropic's Messages API at `/v3/v1/messages` for every model in its catalog, OpenAI and Google models included, and LiteLLM forwards `litellm.anthropic.messages` calls and the proxy's `/v1/messages` there untranslated, so `system` blocks with `cache_control`, `thinking` and tool results reach Eden AI exactly as your client sent them. Eden AI's `fallbacks` and `routing` fields cannot be sent on this route.

```python showLineNumbers title="Eden AI Anthropic Messages API"
import os
import litellm

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

response = await litellm.anthropic.messages.acreate(
    model="edenai/anthropic/claude-sonnet-latest",
    max_tokens=200,
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response["content"][0]["text"])
```

## Usage - Embeddings

Eden AI serves OpenAI's embeddings API at `/v3/embeddings` for every embedding model in its catalog (OpenAI, Google, Cohere, Mistral, Amazon and more). `dimensions`, `encoding_format` and `user` go through as-is; Eden AI's own fields such as `metadata` go through `extra_body`.

```python showLineNumbers title="Eden AI Embeddings"
import os
import litellm

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

response = litellm.embedding(
    model="edenai/openai/text-embedding-3-small",
    input=["Hello, how are you?", "Fine, thanks"],
    dimensions=256,
)

print(len(response.data[0]["embedding"]))
print(response._hidden_params["response_cost"])  # the cost Eden AI reported
```

## Usage - Audio (transcription and speech)

Eden AI serves OpenAI's speech-to-text API at `/v3/audio/transcriptions` and text-to-speech API at `/v3/audio/speech`. Transcription takes the usual multipart upload plus `language`, `prompt`, `response_format`, `temperature` and `timestamp_granularities`; speech takes `voice`, `response_format`, `speed` and `instructions`. Both report Eden AI's cost: transcription in the body, speech in the `x-edenai-cost` response header since the body is the audio itself.

```python showLineNumbers title="Eden AI Audio"
import os
import litellm

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

speech = litellm.speech(
    model="edenai/openai/tts-1",
    input="Hello, how are you?",
    voice="alloy",
    response_format="mp3",
)
speech.stream_to_file("hello.mp3")

with open("hello.mp3", "rb") as audio:
    transcript = litellm.transcription(
        model="edenai/openai/whisper-1",
        file=audio,
        language="en",
    )

print(transcript.text)
```

## Usage - Image Generation

Eden AI serves OpenAI's image generation API at `/v3/images/generations` for every image model in its catalog (OpenAI, Google, Amazon, Stability and more). Images come back as `b64_json` or a hosted `url` depending on the seller, with Eden AI's cost on the response.

```python showLineNumbers title="Eden AI Image Generation"
import base64
import os
import litellm

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

response = litellm.image_generation(
    model="edenai/openai/gpt-image-1-mini",
    prompt="A watercolor lighthouse at dawn",
    size="1024x1024",
    quality="low",
)

image = response.data[0]
if image.b64_json:
    with open("lighthouse.png", "wb") as f:
        f.write(base64.b64decode(image.b64_json))
else:
    print(image.url)
```

## Usage - Video Generation

Eden AI serves OpenAI's video API at `/v3/videos` for every video model in its catalog (OpenAI, Google, Amazon, MiniMax, Pixverse and more). A job is created, polled and downloaded through LiteLLM's video functions; the id LiteLLM returns routes the later calls back to Eden AI on its own. `seconds` and `size` go through as-is, a reference image goes through `input_reference` as a file or as `{"image_url": ...}` / `{"file_id": ...}`, and Eden AI's own `seed`, `provider_params`, `webhook_receiver` and `user_webhook_parameters` pass through for Eden AI to validate. OpenAI's `characters` and `user` are forwarded as well, and Eden AI answers with a 422 for them until it supports them.

```python showLineNumbers title="Eden AI Video Generation"
import os
import time
import litellm

os.environ["EDENAI_API_KEY"] = ""  # your Eden AI API key

job = litellm.video_generation(
    model="edenai/pruna/p-video",
    prompt="A red ball rolling across a wooden table",
    seconds="4",
    size="1280x720",
)

while job.status not in ("completed", "failed"):
    time.sleep(5)
    job = litellm.video_status(video_id=job.id)

print(job.status, job.usage)  # usage carries Eden AI's settled cost as provider_reported_cost_usd
with open("ball.mp4", "wb") as f:
    f.write(litellm.video_content(video_id=job.id))
```

## Usage - LiteLLM Proxy Server

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gpt-mini-latest
    litellm_params:
      model: edenai/openai/gpt-mini-latest
      api_key: os.environ/EDENAI_API_KEY
  - model_name: claude-sonnet
    litellm_params:
      model: edenai/anthropic/claude-sonnet-latest
      api_key: os.environ/EDENAI_API_KEY
  - model_name: gemini-flash-eu
    litellm_params:
      model: edenai/vertex/gemini-3.7-flash
      api_key: os.environ/EDENAI_API_KEY
      api_base: https://api.eu.edenai.run/v3
  - model_name: text-embedding-3-small
    litellm_params:
      model: edenai/openai/text-embedding-3-small
      api_key: os.environ/EDENAI_API_KEY
  - model_name: whisper-1
    litellm_params:
      model: edenai/openai/whisper-1
      api_key: os.environ/EDENAI_API_KEY
  - model_name: tts-1
    litellm_params:
      model: edenai/openai/tts-1
      api_key: os.environ/EDENAI_API_KEY
  - model_name: gpt-image-1-mini
    litellm_params:
      model: edenai/openai/gpt-image-1-mini
      api_key: os.environ/EDENAI_API_KEY
  - model_name: p-video
    litellm_params:
      model: edenai/pruna/p-video
      api_key: os.environ/EDENAI_API_KEY
```

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Eden AI via Proxy"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key",      # Your proxy API key
)

response = client.chat.completions.create(
    model="gpt-mini-latest",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="Eden AI via Proxy - LiteLLM SDK"
import litellm

response = litellm.completion(
    model="litellm_proxy/gpt-mini-latest",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key",
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Eden AI via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "gpt-mini-latest",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

The proxy's `x-litellm-response-cost` response header and the spend logs carry the cost Eden AI reported for the request.

The same deployments serve `/v1/responses` and `/v1/messages`:

```bash showLineNumbers title="Eden AI via Proxy - Responses API"
curl http://localhost:4000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "gpt-mini-latest",
    "input": "Hello, how are you?"
  }'
```

```bash showLineNumbers title="Eden AI via Proxy - Anthropic Messages API"
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-proxy-api-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet",
    "max_tokens": 200,
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

Embeddings, audio and images work the same way, on the OpenAI routes:

```bash showLineNumbers title="Eden AI via Proxy - Embeddings, Audio, Images"
curl http://localhost:4000/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{"model": "text-embedding-3-small", "input": "Hello, how are you?"}'

curl http://localhost:4000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{"model": "tts-1", "input": "Hello, how are you?", "voice": "alloy"}' \
  --output hello.mp3

curl http://localhost:4000/v1/audio/transcriptions \
  -H "Authorization: Bearer your-proxy-api-key" \
  -F model=whisper-1 \
  -F file=@hello.mp3

curl http://localhost:4000/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{"model": "gpt-image-1-mini", "prompt": "A watercolor lighthouse at dawn", "size": "1024x1024", "quality": "low"}'
```

Video jobs use the OpenAI video routes: create on `/v1/videos`, poll `/v1/videos/{id}` until `status` is `completed`, then download `/v1/videos/{id}/content`:

```bash showLineNumbers title="Eden AI via Proxy - Videos"
curl http://localhost:4000/v1/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{"model": "p-video", "prompt": "A red ball rolling across a wooden table", "seconds": "4", "size": "1280x720"}'

curl http://localhost:4000/v1/videos/<id from the create response> \
  -H "Authorization: Bearer your-proxy-api-key"

curl http://localhost:4000/v1/videos/<id from the create response>/content \
  -H "Authorization: Bearer your-proxy-api-key" \
  --output ball.mp4
```

## Supported OpenAI Parameters

Eden AI takes the full OpenAI chat completions parameter set: `temperature`, `top_p`, `max_tokens`, `max_completion_tokens`, `n`, `stop`, `seed`, `stream`, `stream_options`, `tools`, `tool_choice`, `parallel_tool_calls`, `response_format`, `reasoning_effort`, `logprobs`, `top_logprobs`, `frequency_penalty`, `presence_penalty`, `logit_bias`, `web_search_options`, `modalities`, `audio`, `prediction` and `service_tier`. Provider-specific parameters go through `extra_body`, which Eden AI passes to the underlying provider.
