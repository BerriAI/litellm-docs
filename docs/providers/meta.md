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

LiteLLM serves Muse Voice through the proxy's OpenAI-compatible `/v1/realtime` endpoint. You speak the OpenAI Realtime transcription protocol to the proxy; LiteLLM opens a session to `wss://api.meta.ai/v1/asr/realtime`, streams your PCM16 audio to Muse as binary frames, and turns Muse's transcript frames back into OpenAI transcription events. Any WebSocket client works, and the [Python example](#example-python-client) below is a complete push to talk session.

### 1. Add the model to your config

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: muse-voice-transcribe
    litellm_params:
      model: meta/muse-voice-transcribe-1.0
      api_key: os.environ/META_API_KEY
```

`api_key` is the only required credential. `api_base` is optional and must be an absolute `wss://` or `https://` URL: LiteLLM keeps its host and port, replaces the path with `/v1/asr/realtime`, and rejects `http://`, `ws://`, embedded credentials and URL fragments. `META_API_BASE` is not consulted for realtime sessions.

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 2. Connect

```text
ws://localhost:4000/v1/realtime?model=muse-voice-transcribe&intent=transcription
```

Send your proxy key as `Authorization: Bearer <key>`. `model` is the `model_name` from your config, and `intent=transcription` marks the session as transcription-only and pins any model named in a later `session.update` to the one you were authorized for. LiteLLM emits a `session.created` event with `object: realtime.transcription_session` as soon as the socket opens, before the Muse handshake, so clients that wait for it do not stall.

### 3. Configure the session

Send one `session.update` (or `transcription_session.update`). Muse's own handshake acknowledgement is relayed as `session.updated`; any further `session.update` is ignored for the rest of the session. The GA layout below is recommended. The beta layout (`input_audio_format: "pcm16"` plus `input_audio_transcription`) is also accepted at 24 kHz, but one update cannot mix the two layouts.

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

`format.type` must be `audio/pcm`, `rate` must be `16000` or `24000`, and `channels` must be `1`; when `format` is omitted LiteLLM assumes mono 24 kHz. `transcription.model` is optional; the proxy rewrites it to the model you connected with, so any other value is overwritten rather than honored. `transcription.language` is optional and biases recognition toward one language, given as a name or an ISO 639 code; a region suffix is ignored, so `en-US`, `zh-Hans` and `pt-BR` all work. Muse Voice supports Arabic, Bengali, Dutch, English, French, German, Hebrew, Hindi, Indonesian, Italian, Japanese, Kannada, Korean, Malay, Mandarin Chinese, Marathi, Polish, Portuguese, Spanish, Tagalog, Tamil, Telugu, Thai, Turkish and Vietnamese. Any other transcription setting, such as `prompt`, is dropped with a warning in the proxy log.

`turn_detection` selects the mode. LiteLLM rejects every `turn_detection.type` other than `server_vad`.

| | Push to talk | Server VAD |
| --- | --- | --- |
| `turn_detection` | `null` | omitted, or `{"type": "server_vad"}` |
| Turn boundaries | One turn per session; you decide when it ends | Muse detects utterances; each gets its own `item_id` |
| Ending the turn | `input_audio_buffer.commit` flushes buffered audio and ends the Muse stream | `input_audio_buffer.commit` only flushes; send `input_audio_buffer.end` when you are done |

An invalid `session.update` (unsupported rate, channel count, turn detection type or language) is rejected and the connection is dropped; the reason is written to the proxy debug log.

### 4. Stream audio

Send `input_audio_buffer.append` events whose `audio` field is base64 mono PCM16 at the configured rate. Each append may carry at most four seconds of audio; LiteLLM repackets the stream into 80 ms binary frames and paces them to Muse at real time. `input_audio_buffer.clear` drops any partial frame LiteLLM is still holding; audio already forwarded to Muse cannot be recalled. Every other client event, including `response.create`, is dropped because the session is transcription-only.

In server VAD mode Muse expects audio to keep arriving at real time. Stream silence during pauses and send `input_audio_buffer.end` when you are finished; when a client simply stops sending, Meta closes the upstream socket with code `1008` (`Ingress below real-time`) and the proxy relays that as an `error` event followed by a `1008` close.

### 5. Read transcripts

| Event | Fields | When |
| --- | --- | --- |
| `session.created` | `session.object: realtime.transcription_session` | On connect, before the Muse handshake |
| `session.updated` | Configured `audio.input.format`, `transcription` and `turn_detection` | After Muse accepts your `session.update` |
| `input_audio_buffer.speech_started` | `item_id` | Muse detects the start of a turn |
| `conversation.item.input_audio_transcription.delta` | `item_id`, `content_index: 0`, `delta` | Partial transcript text |
| `input_audio_buffer.speech_stopped` | `item_id` | Muse detects the end of a turn |
| `conversation.item.input_audio_transcription.completed` | `item_id`, `transcript`, `usage: {"type": "duration", "seconds": 1.36}` | Final transcript for the turn |
| `error` | `error.type: server_error`, `error.message: Meta Muse realtime transcription failed` | Muse reported a failure |

Overlapping turns are emitted independently as their frames arrive, correlated by `item_id`. When Muse has no more segments the proxy closes the socket with code `1000` and reason `No more transcript segments`.

### Pricing and usage

`meta/muse-voice-transcribe-1.0` is priced per second of input audio (`input_cost_per_second` in the model cost map). Each `completed` event carries the billed duration of its turn in `usage.seconds`, and audio Muse consumed after the last turn, such as trailing silence, is billed when the session closes so the spend log matches what Meta charged. LiteLLM's debug log never contains transcript text or raw Muse frames.

### Guardrails

Guardrails with `mode: realtime_input_transcription` run on every completed transcript; see [Realtime Guardrails](/docs/proxy/guardrails/realtime_guardrails). A blocked transcript produces an `error` event with `type: guardrail_violation` and `code: content_policy_violation`, and `on_violation: end_session` then closes the socket with code `1000`.

:::warning
When a `realtime_input_transcription` guardrail is configured, LiteLLM's shared realtime guardrail code rewrites a client's `turn_detection: null` into `{"create_response": false}` before Muse sees it. That runs push to talk clients in server VAD mode: `input_audio_buffer.commit` no longer ends the Muse stream, and a client that stops streaming after it is disconnected with close code `1008`. Server VAD clients are unaffected.
:::

### Example Python client

Push to talk session: configure, stream a mono PCM16 WAV file in 100 ms chunks, commit, then read events until the proxy closes the socket.

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
                    print(f"\n{event['transcript']} ({event['usage']['seconds']} s)")
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
