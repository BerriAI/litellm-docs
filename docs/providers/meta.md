import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Meta Model API

| Property | Details |
|-------|-------|
| Description | Meta's Model API provides access to Muse Spark reasoning models and Muse Voice transcription. |
| Provider Route on LiteLLM | `meta/` |
| Supported Endpoints | `/chat/completions`, `/responses`, `/v1/messages`, `/v1/realtime` |
| Developer Portal | [Meta Model API ↗](https://dev.meta.ai/) |
| Speech-to-Text Reference | [Muse Voice transcription ↗](https://dev.meta.ai/docs/speech-to-text) |

## Required Variables

```python showLineNumbers title="Environment Variables"
os.environ["META_API_KEY"] = ""  # your Meta Model API key
```

Chat, Responses and Messages requests go to `https://api.meta.ai/v1` by default; set `META_API_BASE` to override that base. Muse Voice realtime uses the same `META_API_KEY` and connects to `wss://api.meta.ai/v1/asr/realtime`; see [Muse Voice Realtime Transcription](#muse-voice-realtime-transcription) for how to point it elsewhere.

## Supported Models

:::info
We actively maintain the list of models, pricing, token window, etc. [here](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json).
:::

| Model ID | Input context length | Input Modalities | Output Modalities |
| --- | --- | --- | --- |
| `muse-spark-1.1` | 1M | Text, Image, Video, PDF | Text |
| `muse-voice-transcribe-1.0` | N/A | Audio | Text |

`muse-spark-1.1` supports function calling, parallel function calling, structured outputs, prompt caching, web search grounding, and reasoning via `reasoning_effort` (`"minimal"` through `"xhigh"`).

`muse-voice-transcribe-1.0` is a realtime speech-to-text model served over the proxy's `/v1/realtime` WebSocket and billed per second of audio. It is realtime only: `/v1/audio/transcriptions` and other batch or file transcription endpoints are not supported.

The API also natively exposes the Anthropic Messages format, so LiteLLM forwards `/v1/messages` requests to `https://api.meta.ai/v1/messages` untranslated, preserving Anthropic-only features like thinking blocks.

## Muse Voice Realtime Transcription

LiteLLM serves Muse Voice through the proxy's OpenAI-compatible `/v1/realtime` endpoint. Clients speak the OpenAI Realtime transcription protocol; LiteLLM streams their PCM16 audio to `wss://api.meta.ai/v1/asr/realtime` as binary frames and maps Muse's transcript frames back to OpenAI events. The [Python example](#example-python-client) below is a complete push to talk session.

### 1. Add the model to your config

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: muse-voice-transcribe
    litellm_params:
      model: meta/muse-voice-transcribe-1.0
      api_key: os.environ/META_API_KEY
```

`api_key` falls back to `META_API_KEY`. `api_base` is optional and must be an absolute `wss://` or `https://` URL; LiteLLM keeps its host and port and replaces the path with `/v1/asr/realtime`. `http://`, `ws://`, embedded credentials and URL fragments are rejected, and `META_API_BASE` is ignored for realtime sessions.

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 2. Connect

```text
ws://localhost:4000/v1/realtime?model=muse-voice-transcribe&intent=transcription
```

Authenticate with `Authorization: Bearer <proxy key>`. `model` is the `model_name` from your config and is required; `intent=transcription` alone routes to the proxy's default OpenAI transcription model. `intent=transcription` makes the session transcription-only and pins any model named in `session.update` to the one you were authorized for.

LiteLLM emits `session.created` with `object: realtime.transcription_session` once it has connected to Meta, before the Muse handshake.

### 3. Configure the session

Send one `session.update` (or `transcription_session.update`). Muse's acknowledgement comes back as `session.updated`, and any later update is ignored. Audio sent before `session.updated` is buffered and replayed, so you can start streaming right away.

```json showLineNumbers title="session.update"
{
  "type": "session.update",
  "session": {
    "type": "transcription",
    "audio": {
      "input": {
        "format": {"type": "audio/pcm", "rate": 24000, "channels": 1},
        "transcription": {"model": "meta/muse-voice-transcribe-1.0", "language": "en"},
        "turn_detection": null
      }
    }
  }
}
```

| Field | Rules |
| --- | --- |
| `format` | `type` must be `audio/pcm`, `rate` must be `16000` or `24000`, `channels` must be `1`. Omitted means mono 24 kHz. |
| `transcription.model` | Optional. With `intent=transcription` the proxy replaces it with `muse-voice-transcribe-1.0`; without it, only `muse-voice-transcribe-1.0` or `meta/muse-voice-transcribe-1.0` is accepted. |
| `transcription.language` | Optional bias toward one language, as a name or ISO 639 code. Region suffixes are ignored, so `en-US`, `zh-Hans` and `pt-BR` work. |
| `turn_detection` | Selects the mode (table below). Any `type` other than `server_vad` is rejected; an object without `type` means server VAD. |
| Anything else | Dropped with a warning in the proxy log. |
| Beta layout | `input_audio_format: "pcm16"` plus `input_audio_transcription` is accepted at 24 kHz. Do not mix the two layouts in one update. |

Supported languages: Arabic, Bengali, Dutch, English, French, German, Hebrew, Hindi, Indonesian, Italian, Japanese, Kannada, Korean, Malay, Mandarin Chinese, Marathi, Polish, Portuguese, Spanish, Tagalog, Tamil, Telugu, Thai, Turkish and Vietnamese.

| | Push to talk | Server VAD |
| --- | --- | --- |
| `turn_detection` | `null` | omitted, or `{"type": "server_vad"}` |
| Turn boundaries | One turn per session; you decide when it ends | Muse detects utterances; each gets its own `item_id` |
| Ending the turn | `input_audio_buffer.commit` flushes buffered audio and ends the Muse stream | `input_audio_buffer.commit` only flushes; send `input_audio_buffer.end` when you are done |

An invalid `session.update` (bad rate, channel count, turn detection type or language) closes the connection with code `1006` and no `error` event; the reason is logged at debug level as `Error in client ack messages: ...`. Protocol violations after setup, such as an append over four seconds, invalid base64 or an odd number of PCM bytes, close the same way.

### 4. Stream audio

`input_audio_buffer.append` carries base64 mono PCM16 at the configured rate, at most four seconds per event. LiteLLM repackets the audio into 80 ms binary frames and paces them to Muse in real time. `input_audio_buffer.clear` drops the partial frame LiteLLM is still holding; audio already sent to Muse cannot be recalled. Every other client event, including `response.create`, is dropped.

Server VAD needs audio to keep arriving in real time. Stream silence during pauses and send `input_audio_buffer.end` (a LiteLLM event, not part of the OpenAI protocol) when you are finished. If the client simply stops sending, Meta closes with code `1008` (`Ingress below real-time`), which the proxy relays as an `error` event followed by a `1008` close.

### 5. Read transcripts

| Event | Fields | When |
| --- | --- | --- |
| `session.created` | `session.object: realtime.transcription_session` | On connect, before the Muse handshake |
| `session.updated` | Normalized session: no `channels`, `model` is `muse-voice-transcribe-1.0`, `language` is the full name (`en` becomes `English`) | After Muse accepts your `session.update` |
| `input_audio_buffer.speech_started` | `item_id` | Muse detects the start of a turn |
| `conversation.item.input_audio_transcription.delta` | `item_id`, `content_index: 0`, `delta` | Partial transcript text |
| `input_audio_buffer.speech_stopped` | `item_id` | Muse detects the end of a turn |
| `conversation.item.input_audio_transcription.completed` | `item_id`, `content_index: 0`, `transcript`; `usage: {"type": "duration", "seconds": 1.36}` when Muse processed new audio since the previous `completed` | Final transcript for the turn |
| `error` | `error.type: server_error`; `error.message` is `Meta Muse realtime transcription failed`, or `upstream websocket closed with code <N>: <reason>` before a non-1000 close | Muse reported a failure or closed abnormally |

Turns may overlap and are correlated by `item_id`. When Muse has no more segments it closes with code `1000`, normally with reason `No more transcript segments`, and the proxy relays that close.

### Pricing and usage

Muse Voice is billed per second of input audio (`input_cost_per_second` in the model cost map). `usage.seconds` is the audio Muse processed since the last billed point, silence included, so it can exceed the utterance length. Audio after the last `completed` event, such as trailing silence, is billed when the session closes.

Transcripts are stored in the spend log's messages unless message logging is turned off. The proxy log carries no transcript text, apart from the first 80 characters of a guardrail-blocked transcript at warning level.

### Guardrails

Guardrails with `mode: realtime_input_transcription` run on each completed transcript; see [Realtime Guardrails](/docs/proxy/guardrails/realtime_guardrails). The `completed` event reaches the client before the guardrail runs, and deltas are not checked. A block sends an `error` event with `type: guardrail_violation` and `code: content_policy_violation`; `on_violation: end_session` also closes the socket with code `1000`.

Select guardrails per connection with a `guardrails=name1,name2` query parameter.

:::warning
With a `realtime_input_transcription` guardrail configured, LiteLLM rewrites a client's `turn_detection: null` into `{"create_response": false}` before Muse sees it, so push to talk clients run in server VAD mode: `input_audio_buffer.commit` no longer ends the stream, and a client that stops streaming is disconnected with code `1008`. Server VAD clients are unaffected.
:::

### Example Python client

Push to talk: configure, stream a mono PCM16 WAV file in 100 ms chunks, commit, then read events until the proxy closes the socket.

```python showLineNumbers title="Muse Voice push to talk client"
import asyncio
import base64
import json
import wave

import websockets

URL = "ws://localhost:4000/v1/realtime?model=muse-voice-transcribe&intent=transcription"
HEADERS = {"Authorization": "Bearer sk-1234"}  # your proxy API key


def pcm_chunks(path, chunk_ms=100):
    with wave.open(path) as w:  # mono PCM16 at 16 kHz or 24 kHz
        rate, frames = w.getframerate(), w.readframes(w.getnframes())
    step = rate * 2 * chunk_ms // 1000
    return rate, [frames[i : i + step] for i in range(0, len(frames), step)]


async def main():
    rate, chunks = pcm_chunks("question.wav")
    async with websockets.connect(URL, additional_headers=HEADERS) as ws:
        print(json.loads(await ws.recv())["type"])  # session.created
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "type": "transcription",
                "audio": {
                    "input": {
                        "format": {"type": "audio/pcm", "rate": rate},
                        "transcription": {"model": "meta/muse-voice-transcribe-1.0"},
                        "turn_detection": None,
                    }
                },
            },
        }))
        print(json.loads(await ws.recv())["type"])  # session.updated
        for chunk in chunks:
            await ws.send(json.dumps({"type": "input_audio_buffer.append", "audio": base64.b64encode(chunk).decode()}))
            await asyncio.sleep(0.1)
        await ws.send(json.dumps({"type": "input_audio_buffer.commit"}))
        try:
            while True:
                event = json.loads(await ws.recv())
                if event["type"] == "conversation.item.input_audio_transcription.delta":
                    print(event["delta"], end="", flush=True)
                elif event["type"] == "conversation.item.input_audio_transcription.completed":
                    seconds = event.get("usage", {}).get("seconds")  # absent when Muse reported no new audio
                    print(f"\n{event['transcript']} ({seconds} s)")
        except websockets.exceptions.ConnectionClosedOK:
            pass  # close code 1000: no more transcript segments


asyncio.run(main())
```

```text
session.created
session.updated
What is the weather in Paris?
What is the weather in Paris? (1.36 s)
```

For server VAD, send `"turn_detection": {"type": "server_vad"}` instead of `None`, keep streaming (silence included) for as long as the microphone is open, and finish with `{"type": "input_audio_buffer.end"}`. Each detected utterance arrives with its own `item_id`.

## Usage - LiteLLM Python SDK

### Non-streaming

```python showLineNumbers title="Meta Model API Non-streaming Completion"
import os
import litellm
from litellm import completion

os.environ["META_API_KEY"] = ""  # your Meta Model API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(model="meta/muse-spark-1.1", messages=messages)
```

### Streaming

```python showLineNumbers title="Meta Model API Streaming Completion"
import os
import litellm
from litellm import completion

os.environ["META_API_KEY"] = ""  # your Meta Model API key

messages = [{"content": "Hello, how are you?", "role": "user"}]

response = completion(
    model="meta/muse-spark-1.1",
    messages=messages,
    stream=True
)

for chunk in response:
    print(chunk)
```

### Reasoning Effort

`muse-spark-1.1` accepts `reasoning_effort` values `"minimal"`, `"low"`, `"medium"`, `"high"`, and `"xhigh"`.

```python showLineNumbers title="Meta Model API Reasoning Effort"
import os
import litellm
from litellm import completion

os.environ["META_API_KEY"] = ""  # your Meta Model API key

messages = [{"content": "What is 15% of 2840?", "role": "user"}]

response = completion(
    model="meta/muse-spark-1.1",
    messages=messages,
    reasoning_effort="xhigh"
)

print(response.choices[0].message.content)
print(response.usage.completion_tokens_details.reasoning_tokens)
```

### Function Calling

```python showLineNumbers title="Meta Model API Function Calling"
import os
import litellm
from litellm import completion

os.environ["META_API_KEY"] = ""  # your Meta Model API key

messages = [{"content": "What's the weather like in San Francisco?", "role": "user"}]

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"]
                    }
                },
                "required": ["location"]
            }
        }
    }
]

response = completion(
    model="meta/muse-spark-1.1",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

print(response.choices[0].message.tool_calls)
```

## Usage - LiteLLM Proxy

Add the following to your LiteLLM Proxy configuration file:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: muse-spark-1.1
    litellm_params:
      model: meta/muse-spark-1.1
      api_key: os.environ/META_API_KEY
```

Start your LiteLLM Proxy server:

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

<Tabs>
<TabItem value="openai-sdk" label="OpenAI SDK">

```python showLineNumbers title="Meta Model API via Proxy - Non-streaming"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key"       # Your proxy API key
)

response = client.chat.completions.create(
    model="muse-spark-1.1",
    messages=[{"role": "user", "content": "Write a short poem about AI."}],
    reasoning_effort="minimal"
)

print(response.choices[0].message.content)
```

```python showLineNumbers title="Meta Model API via Proxy - Streaming"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",  # Your proxy URL
    api_key="your-proxy-api-key"       # Your proxy API key
)

response = client.chat.completions.create(
    model="muse-spark-1.1",
    messages=[{"role": "user", "content": "Write a short poem about AI."}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

</TabItem>

<TabItem value="litellm-sdk" label="LiteLLM SDK">

```python showLineNumbers title="Meta Model API via Proxy - LiteLLM SDK"
import litellm

response = litellm.completion(
    model="litellm_proxy/muse-spark-1.1",
    messages=[{"role": "user", "content": "Write a short poem about AI."}],
    api_base="http://localhost:4000",
    api_key="your-proxy-api-key"
)

print(response.choices[0].message.content)
```

</TabItem>

<TabItem value="curl" label="cURL">

```bash showLineNumbers title="Meta Model API via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "muse-spark-1.1",
    "messages": [{"role": "user", "content": "Write a short poem about AI."}],
    "reasoning_effort": "minimal"
  }'
```

</TabItem>
</Tabs>

### Anthropic Messages API

The proxy's `/v1/messages` route forwards requests for `meta/` models to Meta's native Anthropic-compatible endpoint without translation.

```bash showLineNumbers title="Meta Model API via Proxy - /v1/messages"
curl http://localhost:4000/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-api-key" \
  -d '{
    "model": "muse-spark-1.1",
    "max_tokens": 2048,
    "messages": [{"role": "user", "content": "Write a short poem about AI."}]
  }'
```
