import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Alibaba Cloud Token Plan

Token Plan is Alibaba Cloud Model Studio's subscription plan. One `sk-sp-` API key covers a fixed set of text, image, speech, realtime voice and video models. LiteLLM exposes all of them under the `alibaba_token_plan/` prefix, translating each OpenAI-format request to the matching Token Plan endpoint

## Overview

| Property | Details |
|-------|-------|
| Description | Subscription access to Qwen, DeepSeek, GLM, Wan, HappyHorse and Qwen-Audio models on Alibaba Cloud Model Studio (Singapore region) |
| Provider Route on LiteLLM | `alibaba_token_plan/` |
| Supported Endpoints | `/chat/completions`, `/v1/messages`, `/responses`, `/images/generations`, `/images/edits`, `/audio/speech`, `/audio/transcriptions`, `/v1/realtime`, `/videos` |
| Link to Provider Doc | [Token Plan overview ↗](https://www.alibabacloud.com/help/en/model-studio/token-plan-personal-overview), [Multimodal models on Token Plan ↗](https://www.alibabacloud.com/help/en/model-studio/token-plan-multimodal-gen) |

:::warning Plan terms

Alibaba Cloud states the Token Plan is meant for interactive use inside coding tools and must not back automation scripts, custom application backends or batch jobs. Check the current plan terms before you put it behind a shared gateway

:::

Token Plan keys and base URLs are isolated from pay-as-you-go and Coding Plan. Alibaba warns that pairing a Token Plan key with a different base URL can return 401/403 or bill the pay-as-you-go channel instead, so keep the defaults below unless you route through your own gateway. For pay-as-you-go DashScope keys, use the [QwenCloud](./qwencloud) or [DashScope](./dashscope) routes

## Required Variables

```python showLineNumbers title="Environment Variables"
import os

os.environ["ALIBABA_TOKEN_PLAN_API_KEY"] = "sk-sp-..."  # Token Plan key from the My Subscription page
```

LiteLLM picks the endpoint for each API from the same host:

| API | Default URL |
|-------|-------|
| Chat Completions, Responses | `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1` |
| Anthropic Messages | `https://token-plan.ap-southeast-1.maas.aliyuncs.com/apps/anthropic` |
| Images, transcription | `https://token-plan.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |
| Speech | `https://token-plan.ap-southeast-1.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer` |
| Video | `https://token-plan.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis`, polled at `/api/v1/tasks/{task_id}` |
| Realtime | `wss://token-plan.ap-southeast-1.maas.aliyuncs.com/api-ws/v1/realtime` |

To send traffic through your own gateway, set `ALIBABA_TOKEN_PLAN_API_BASE` or `api_base` to the gateway's OpenAI-compatible base, such as `https://gateway.example.com/token-plan/compatible-mode/v1`. Chat and Responses use it as is, and every other API swaps the `/compatible-mode/v1` suffix for its own path on the same host, so one value works for every model

## Supported Models

:::info
We actively maintain the list of models, capabilities and context windows [here](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json)
:::

| Model | LiteLLM endpoints | Notes |
| --- | --- | --- |
| `auto` | `/chat/completions`, `/v1/messages`, `/responses` | Alibaba picks the underlying model per request; reasoning, tools, image input |
| `qwen3.8-max`, `qwen3.8-flash`, `qwen3.7-plus`, `qwen3.6-flash` | `/chat/completions`, `/v1/messages`, `/responses` | Reasoning, tools, image input |
| `qwen3.7-max` | `/chat/completions`, `/v1/messages`, `/responses` | Reasoning, tools |
| `deepseek-v4.1-flash` | `/chat/completions`, `/v1/messages`, `/responses` | Reasoning, tools, image input |
| `deepseek-v4-pro`, `deepseek-v4-pro-0813`, `glm-5.3`, `glm-5.2` | `/chat/completions`, `/v1/messages`, `/responses` | Reasoning, tools |
| `deepseek-v4-flash-0731` | `/chat/completions`, `/v1/messages`, `/responses` | Reasoning, tools |
| `qwen-image-3.0-pro` | `/images/generations`, `/images/edits` | Up to 3 input images for edits |
| `wan2.7-image`, `wan2.7-image-pro` | `/images/generations`, `/images/edits` | Up to 9 input images for edits |
| `qwen-audio-3.0-tts-plus` | `/audio/speech` | |
| `qwen-audio-3.0-asr-flash` | `/audio/transcriptions` | |
| `qwen-audio-3.0-realtime-plus` | `/v1/realtime` | Speech-to-speech with function calling |
| `happyhorse-1.1-t2v` | `/videos` | Text to video |
| `happyhorse-1.1-i2v` | `/videos` | First frame image to video |
| `happyhorse-1.1-r2v` | `/videos` | 1 to 9 reference images to video |

Embeddings and rerank are not part of the Token Plan subscription, so the provider does not expose them

### Cost tracking

The plan bills in subscription credits, not per token, so these models carry no per-token prices in LiteLLM and requests are logged at $0 spend. Use the Model Studio console for real credit usage. To track an internal rate, set `input_cost_per_token` and `output_cost_per_token` in `model_info` on your deployment

## Usage - LiteLLM Python SDK

### Chat Completions

```python showLineNumbers title="Token Plan Chat Completion"
import os
from litellm import completion

os.environ["ALIBABA_TOKEN_PLAN_API_KEY"] = "sk-sp-..."

response = completion(
    model="alibaba_token_plan/qwen3.8-max",
    messages=[{"role": "user", "content": "Write a haiku about load balancers"}],
    reasoning_effort="low",
)

print(response.choices[0].message.content)
```

Streaming, tools and `reasoning_effort` work the same way as on the [DashScope route](./dashscope), and `cache_control` markers on messages are passed through. Two Alibaba limits apply to tools: `auto` rejects `tool_choice` altogether, and the Qwen models reject `tool_choice` set to `required` or a named function while thinking is on, so send `"enable_thinking": false` with those or keep `tool_choice` at `auto`. Models without image input do not reject image parts; they answer as if no image was sent, so check the table above before sending images

### Anthropic Messages

`/v1/messages` requests go to the native Anthropic-compatible endpoint untranslated, which is what coding tools such as Claude Code use

```python showLineNumbers title="Token Plan Anthropic Messages"
import asyncio
import os
import litellm

os.environ["ALIBABA_TOKEN_PLAN_API_KEY"] = "sk-sp-..."

async def main():
    response = await litellm.anthropic.messages.acreate(
        model="alibaba_token_plan/qwen3.8-max",
        messages=[{"role": "user", "content": "Explain this stack trace in one paragraph"}],
        max_tokens=1024,
    )
    print(response)

asyncio.run(main())
```

### Responses API

```python showLineNumbers title="Token Plan Responses"
import os
import litellm

os.environ["ALIBABA_TOKEN_PLAN_API_KEY"] = "sk-sp-..."

response = litellm.responses(
    model="alibaba_token_plan/qwen3.8-flash",
    input="Summarize the CAP theorem in two sentences",
)

print(response.output_text)
```

### Image Generation

```python showLineNumbers title="Token Plan Image Generation"
import os
from litellm import image_generation

os.environ["ALIBABA_TOKEN_PLAN_API_KEY"] = "sk-sp-..."

response = image_generation(
    model="alibaba_token_plan/qwen-image-3.0-pro",
    prompt="A lighthouse on a cliff at dusk, watercolor",
    size="1024x1024",
    n=1,
)

print(response.data[0].url)
```

Token Plan returns signed image URLs, so `response_format` must be `url` (the default); `b64_json` is rejected unless `drop_params` is on. `size` uses OpenAI's `WxH` form; without it, Alibaba's default size applies. Pass native parameters such as `negative_prompt`, `prompt_extend` or `watermark` through `extra_body`. Clients that need explicit values, such as Open WebUI, should send `"response_format": "url"` and a concrete size

### Image Editing

```python showLineNumbers title="Token Plan Image Edit"
import os
from litellm import image_edit

os.environ["ALIBABA_TOKEN_PLAN_API_KEY"] = "sk-sp-..."

response = image_edit(
    model="alibaba_token_plan/wan2.7-image",
    image=open("room.png", "rb"),
    prompt="Repaint the walls sage green and keep everything else unchanged",
    size="1024x1024",
)

print(response.data[0].url)
```

`image` accepts a file, bytes, an `https://` URL or an image data URI, or a list of them; Alibaba sets how many images each model takes (up to 3 for `qwen-image-3.0-pro` and 9 for the `wan2.7` models). Besides `n` and `size`, LiteLLM forwards `seed`, `watermark`, `negative_prompt` and `prompt_extend`

### Text to Speech

```python showLineNumbers title="Token Plan Speech"
import os
from litellm import speech

os.environ["ALIBABA_TOKEN_PLAN_API_KEY"] = "sk-sp-..."

response = speech(
    model="alibaba_token_plan/qwen-audio-3.0-tts-plus",
    input="Your build finished without errors.",
    voice="longanhuan_v3.6",
    response_format="mp3",
)

response.stream_to_file("build.mp3")
```

`voice` takes a Token Plan voice name. OpenAI's `alloy` and an omitted voice both map to `longanhuan_v3.6`, the voice Alibaba uses in its Token Plan examples. `response_format` sets the audio format (default `mp3`); Token Plan accepts `mp3`, `wav`, `pcm` and `opus`, and rejects `aac` and `flac`. `sample_rate` sets the rate (default `24000`). Other OpenAI parameters such as `speed` and `instructions` are rejected unless `drop_params` is on

### Speech to Text

```python showLineNumbers title="Token Plan Transcription"
import os
from litellm import transcription

os.environ["ALIBABA_TOKEN_PLAN_API_KEY"] = "sk-sp-..."

response = transcription(
    model="alibaba_token_plan/qwen-audio-3.0-asr-flash",
    file=open("meeting.mp3", "rb"),
    language="en",
)

print(response.text)
```

LiteLLM uploads the file inline as base64, and Alibaba caps recordings at 10 MB and 5 minutes. The file extension sets the audio format; mp3, wav and m4a worked in testing, and Alibaba rejects formats it does not support. `language` is sent as a language hint and `prompt` as context. Responses are always JSON

### Video Generation

Video jobs are asynchronous: create a job, poll its status, then download the result

```python showLineNumbers title="Token Plan Video"
import os
import time
from litellm import video_content, video_generation, video_status

os.environ["ALIBABA_TOKEN_PLAN_API_KEY"] = "sk-sp-..."

video = video_generation(
    model="alibaba_token_plan/happyhorse-1.1-t2v",
    prompt="A paper boat drifting down a rainy street, cinematic",
    size="1280x720",
    seconds="5",
)

while video.status in ("queued", "in_progress"):
    time.sleep(15)
    video = video_status(video_id=video.id)

if video.status == "completed":
    with open("boat.mp4", "wb") as f:
        f.write(video_content(video_id=video.id))
```

`seconds` sets the duration (Alibaba accepts 3 to 15). `size` is converted to Token Plan's `resolution` and `ratio`, so its shorter side should be 480, 720 or 1080 and its ratio one Alibaba supports, such as `1280x720` for 16:9 (`854x480` reduces to 427:240 and is rejected); to set them directly, send `"parameters": {"resolution": "720P", "ratio": "16:9"}`. Use `input_reference` with `happyhorse-1.1-i2v` for the first frame. For `happyhorse-1.1-r2v`, pass one reference image with `input_reference`, or up to 9 through a native `"input": {"media": [...]}` list of `reference_image` entries. Image-to-video keeps the source image's aspect ratio. Videos carry a small HappyHorse watermark unless you send `"parameters": {"watermark": false}`, which also takes `seed`. Jobs took 80 to 105 seconds in testing, and every clip includes an AAC audio track. Remix, list and delete are not available on Token Plan

## Usage - LiteLLM Proxy

A wildcard route makes every Token Plan model available under its own name:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: alibaba_token_plan/*
    litellm_params:
      model: alibaba_token_plan/*
      api_key: os.environ/ALIBABA_TOKEN_PLAN_API_KEY
```

You can also list models one by one:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: qwen3.8-max
    litellm_params:
      model: alibaba_token_plan/qwen3.8-max
      api_key: os.environ/ALIBABA_TOKEN_PLAN_API_KEY
  - model_name: qwen-image
    litellm_params:
      model: alibaba_token_plan/qwen-image-3.0-pro
      api_key: os.environ/ALIBABA_TOKEN_PLAN_API_KEY
  - model_name: qwen-voice
    litellm_params:
      model: alibaba_token_plan/qwen-audio-3.0-realtime-plus
      api_key: os.environ/ALIBABA_TOKEN_PLAN_API_KEY
```

```bash showLineNumbers title="Start LiteLLM Proxy"
export ALIBABA_TOKEN_PLAN_API_KEY="sk-sp-..."
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

In the Admin UI, pick **Alibaba Cloud Token Plan** on the Add Model page and paste the Token Plan key; the API Base field is optional

<Tabs>
<TabItem value="chat" label="Chat">

```bash showLineNumbers title="Chat Completions"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "alibaba_token_plan/qwen3.8-max",
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
<TabItem value="messages" label="Messages">

```bash showLineNumbers title="Anthropic Messages"
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "alibaba_token_plan/qwen3.8-max",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "hello from litellm"}]
  }'
```

</TabItem>
<TabItem value="image" label="Image">

```bash showLineNumbers title="Image Generation"
curl http://localhost:4000/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "alibaba_token_plan/qwen-image-3.0-pro",
    "prompt": "A lighthouse on a cliff at dusk, watercolor",
    "size": "1024x1024",
    "response_format": "url"
  }'
```

</TabItem>
<TabItem value="speech" label="Speech">

```bash showLineNumbers title="Text to Speech"
curl http://localhost:4000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "alibaba_token_plan/qwen-audio-3.0-tts-plus",
    "input": "Your build finished without errors.",
    "voice": "longanhuan_v3.6"
  }' \
  --output build.mp3
```

</TabItem>
<TabItem value="transcription" label="Transcription">

```bash showLineNumbers title="Speech to Text"
curl http://localhost:4000/v1/audio/transcriptions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -F model="alibaba_token_plan/qwen-audio-3.0-asr-flash" \
  -F file="@meeting.mp3"
```

</TabItem>
<TabItem value="video" label="Video">

```bash showLineNumbers title="Video Generation"
curl http://localhost:4000/v1/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "alibaba_token_plan/happyhorse-1.1-t2v",
    "prompt": "A paper boat drifting down a rainy street, cinematic",
    "seconds": "5",
    "size": "1280x720"
  }'

curl http://localhost:4000/v1/videos/$VIDEO_ID \
  -H "Authorization: Bearer $LITELLM_API_KEY"

curl http://localhost:4000/v1/videos/$VIDEO_ID/content \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  --output boat.mp4
```

</TabItem>
</Tabs>

## Realtime Voice

`qwen-audio-3.0-realtime-plus` is served on the proxy's `/v1/realtime` WebSocket. Clients speak the OpenAI Realtime protocol, and LiteLLM translates Qwen-Audio's events to the OpenAI GA event names

```text
ws://localhost:4000/v1/realtime?model=qwen-voice
```

Authenticate with `Authorization: Bearer <proxy key>`. Audio is mono PCM16. Qwen-Audio takes 16 kHz input and always replies with 24 kHz audio. OpenAI clients default to 24 kHz input, so declare 16 kHz in your first `session.update` and send audio captured at that rate:

```json showLineNumbers title="session.update"
{
  "type": "session.update",
  "session": {
    "type": "realtime",
    "instructions": "You are a concise voice assistant.",
    "output_modalities": ["audio"],
    "audio": {
      "input": {
        "format": {"type": "audio/pcm", "rate": 16000},
        "turn_detection": {"type": "server_vad"}
      },
      "output": {"voice": "longanqian"}
    }
  }
}
```

The client events `session.update`, `input_audio_buffer.append`, `input_audio_buffer.commit`, `input_audio_buffer.clear`, `conversation.item.create`, `conversation.item.delete`, `conversation.item.retrieve`, `response.create` and `response.cancel` are supported. Qwen-Audio has a few limits that LiteLLM enforces before forwarding:

| Setting | Supported values |
| --- | --- |
| `turn_detection` | `server_vad`, `smart_turn` or `null` for manual turns; `create_response` and `interrupt_response` cannot be turned off |
| `tools` | Function tools only, with `tool_choice` `auto`; cannot be combined with `enable_search` |
| Guardrails | `realtime_input_transcription` guardrails are not supported, because they need auto-response turned off |
| Input sample rate | 16000 Hz only; declaring 24 kHz (`pcm16` or `rate: 24000`) closes the session, and the reason appears in LiteLLM's debug log |
| `response.create` | Only `modalities` / `output_modalities` and `voice` overrides |
| `response.cancel` | Cancels the active response; omit `response_id` |

Qwen-Audio session fields such as `enable_search`, `search_options`, `enable_speech_emotion` and `max_history_turns` pass through `session.update` unchanged.

:::note Known issue

With input transcription turned on, each turn currently ends with an extra `error` event saying a response is already in progress. LiteLLM sends its own `response.create` after every transcript, while Qwen-Audio has already started replying. The reply still completes normally. The same happens with Azure OpenAI and is tracked in [issue #31726](https://github.com/BerriAI/litellm/issues/31726), with a fix proposed in [PR #43791](https://github.com/BerriAI/litellm/pull/43791)

:::

## Limitations

Embeddings, rerank, batches, moderations, video remix, list and delete are not available on Token Plan. Image responses are URLs only. Token Plan is currently offered only in the Singapore region, and every API key is bound to its subscription, so the key changes if you resubscribe
