import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Vertex AI Audio Transcription

| Property | Details |
|-------|-------|
| Description | Gemini speech-to-text on Vertex AI via the OpenAI `/v1/audio/transcriptions` endpoint, and Chirp streaming speech-to-text via `/v1/realtime` |
| Provider Route on LiteLLM | `vertex_ai/gemini-3.5-transcribe-preview` (batch), `vertex_ai/chirp_3` (realtime, [see below](#chirp-realtime-transcription)) |
| Supported OpenAI Params | `language`, `response_format` (`json`, `text`) |

Gemini transcribe models on Vertex AI are served from the `global` location, which LiteLLM uses by default when no `vertex_location` is set. If you set a regional location (in config, `litellm.vertex_location`, or the `VERTEXAI_LOCATION` / `VERTEX_LOCATION` env vars), that value takes precedence and Vertex returns a 404 for regions where the model is unavailable, so pin `vertex_location: global` for these models.

Prefer an API key over a GCP service account? The same model is available through [Google AI Studio](./gemini.md#audio-transcription-speech-to-text) as `gemini/gemini-3.5-transcribe`.

## Quick Start

### LiteLLM Python SDK

```python showLineNumbers title="Gemini Transcribe Quick Start"
from litellm import transcription

audio_file = open("speech.wav", "rb")
response = transcription(
    model="vertex_ai/gemini-3.5-transcribe-preview",
    file=audio_file,
    language="en",
    vertex_project="your-project-id",
    vertex_credentials="/path/to/service_account.json",
)
print(response.text)
```

### LiteLLM AI Gateway

**1. Setup config.yaml**

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gemini-transcribe
    litellm_params:
      model: vertex_ai/gemini-3.5-transcribe-preview
      vertex_project: "your-project-id"
      vertex_credentials: "/path/to/service_account.json"
```

**2. Start the proxy**

```bash title="Start LiteLLM Proxy"
litellm --config /path/to/config.yaml
```

**3. Make requests**

<Tabs>
<TabItem value="curl" label="curl">

```bash showLineNumbers title="Gemini Transcribe Quick Start"
curl http://0.0.0.0:4000/v1/audio/transcriptions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -F file=@speech.wav \
  -F model=gemini-transcribe \
  -F language=en
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI Python SDK">

```python showLineNumbers title="Gemini Transcribe Quick Start"
import openai

client = openai.OpenAI(api_key="sk-<your-litellm-api-key>", base_url="http://0.0.0.0:4000")

audio_file = open("speech.wav", "rb")
response = client.audio.transcriptions.create(
    model="gemini-transcribe",
    file=audio_file,
    language="en",
)
print(response.text)
```

</TabItem>
</Tabs>

## Supported Params

`language` accepts two-letter codes or BCP-47 tags and is normalized to BCP-47 before being sent to Gemini. `response_format` supports `json` (default) and `text`; Gemini transcription on Vertex AI returns no word timestamps, so `verbose_json`, `srt`, and `vtt` are rejected with a 400 unless `drop_params` is set, in which case they are dropped and the plain transcript is returned.

## Usage and Cost Tracking

Vertex AI reports token usage split by modality, and LiteLLM tracks audio input tokens and text output tokens separately, so spend logs and the `x-litellm-response-cost` header reflect Google's published per-token audio transcription pricing.

## Chirp Realtime Transcription

LiteLLM serves Google Cloud Speech-to-Text Chirp models through the proxy's OpenAI-compatible `/v1/realtime` endpoint. Clients speak the OpenAI Realtime transcription protocol; LiteLLM streams their PCM16 audio to Speech-to-Text v2 `StreamingRecognize` over gRPC and maps Google's interim and final results back to OpenAI events. The [Python example](#example-openai-sdk-client) below is a complete push to talk session using the OpenAI SDK

### 1. Install the Speech-to-Text client

Streaming uses `google-cloud-speech`, which the `stt-vertex-chirp` extra installs. The official Docker images already include it

```bash showLineNumbers title="Install the extra"
pip install 'litellm[stt-vertex-chirp]'
```

Without it the first session fails with `google-cloud-speech is not installed`

### 2. Add the model to your config

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: chirp-3
    litellm_params:
      model: vertex_ai/chirp_3
      vertex_project: "your-project-id"
      vertex_location: us
      vertex_credentials: "/path/to/service_account.json"
```

`vertex_credentials` falls back to the `VERTEXAI_CREDENTIALS` environment variable; `vertex_project` and `vertex_location` fall back to `litellm.vertex_project` and `litellm.vertex_location`, then to `VERTEXAI_PROJECT` and `VERTEXAI_LOCATION`. The location defaults to `us` and selects the regional endpoint `<location>-speech.googleapis.com` (`speech.googleapis.com` for `global`), so pick a location where Speech-to-Text serves the model. `api_base` is optional and only its host is used. Realtime health checks are not supported for Chirp deployments: health check them with `mode: audio_transcription`, which goes through the batch `/v1/audio/transcriptions` endpoint the same deployment serves

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config /path/to/config.yaml
```

### 3. Connect

```text
ws://localhost:4000/v1/realtime?model=chirp-3&intent=transcription
```

Authenticate with `Authorization: Bearer <proxy key>`. `model` is the `model_name` from your config and is required; `intent=transcription` alone routes to the proxy's default OpenAI transcription model. `intent=transcription` makes the session transcription-only and pins any model named in `session.update` to the one you were authorized for

LiteLLM emits `session.created` with `object: realtime.transcription_session` as soon as the socket is accepted. It carries the defaults: model `chirp_3`, mono `audio/pcm` at 24000 Hz, server VAD and no language

### 4. Configure the session

Send one `session.update` (or `transcription_session.update`). LiteLLM answers with `session.updated` echoing the normalized session, and any later update is ignored. Audio sent before the update is buffered and replayed after it, so you can start streaming right away

```json showLineNumbers title="session.update"
{
  "type": "session.update",
  "session": {
    "type": "transcription",
    "audio": {
      "input": {
        "format": {"type": "audio/pcm", "rate": 24000, "channels": 1},
        "transcription": {"model": "chirp_3", "language": "en"},
        "turn_detection": {"type": "server_vad"}
      }
    }
  }
}
```

| Field | Rules |
| --- | --- |
| `type` | `transcription`, `realtime` or omitted. Anything else is rejected. |
| `format` | `type` must be `audio/pcm` (or `pcm16`), `rate` any integer from `8000` to `48000`, `channels` must be `1` if present. Omitted means mono 24 kHz. |
| `transcription.model` | Optional. With `intent=transcription` the proxy replaces it with the model you were authorized for; without it, only `chirp_3` or `vertex_ai/chirp_3` is accepted. |
| `transcription.language` | Optional BCP-47 tag. A bare two-letter code for a common language is expanded to its default region (`en` becomes `en-US`, `pt` becomes `pt-BR`, `zh` becomes `zh-CN`); other values are sent as given. Omitted means Google detects the language. |
| `turn_detection` | Selects the mode (table below). Any `type` other than `server_vad` is rejected; an object without `type` means server VAD. |
| Other `transcription` keys | Ignored, with a debug log line. |
| Beta layout | `input_audio_format: "pcm16"` plus top-level `input_audio_transcription` and `turn_detection` is accepted, at 24 kHz. Do not mix the two layouts in one update. |

| | Push to talk | Server VAD |
| --- | --- | --- |
| `turn_detection` | `null` | omitted, or `{"type": "server_vad"}` |
| Turn boundaries | One turn per commit; you decide when it ends | Google detects utterances; each gets its own `item_id` |
| Speech events | None | `input_audio_buffer.speech_started` and `speech_stopped` around each utterance |
| Ending the turn | `input_audio_buffer.commit` (or `input_audio_buffer.end`) finishes the turn and yields `completed`; the next `append` starts a new turn | Utterances complete on their own; `commit` or `end` completes the turn in progress |

An invalid `session.update` (wrong encoding, channel count, sample rate, session type, turn detection type or a different model) closes the connection with code `1006` and no `error` event; the reason is logged at debug level as `Error in client ack messages: ...`. Invalid base64 or an odd number of PCM bytes in an append closes the same way

### 5. Stream audio

`input_audio_buffer.append` carries base64 mono PCM16 at the configured rate. There is no size limit per event; LiteLLM splits the audio into gRPC requests of at most 25 KB and forwards them as they arrive, without pacing, so a file can be sent faster than real time. `input_audio_buffer.clear` discards the turn in progress, audio already sent and text not yet completed included, without any event. Every other client event, including `response.create`, is dropped

Google limits how long one streaming request may run, so LiteLLM moves to a fresh stream once one has been open for 240 seconds. It waits for the next pause in speech (Google's voice activity end) before switching, and switches at 280 seconds at the latest. A push-to-talk turn carries across the switch: the text so far is kept and the `completed` after your `commit` holds the whole turn under one `item_id`. With server VAD, Google finalizes the audio sent so far when the old stream closes, so an utterance still in progress at a forced switch (continuous speech from 240 to 280 seconds) completes in two parts under two `item_id`s. Billed seconds carry across streams

### 6. Read transcripts

| Event | Fields | When |
| --- | --- | --- |
| `session.created` | `session.object: realtime.transcription_session`, default session | On connect |
| `session.updated` | Normalized session: no `channels`, `model` is `chirp_3`, `language` as a BCP-47 tag (`en` becomes `en-US`) or absent | After LiteLLM accepts your `session.update` |
| `input_audio_buffer.speech_started` | `item_id` | Server VAD only: Google detects speech, or the first transcript text of a turn arrives |
| `conversation.item.input_audio_transcription.delta` | `item_id`, `content_index: 0`, `delta` | Words added since the previous delta of the turn, interim results included |
| `input_audio_buffer.speech_stopped` | `item_id` | Server VAD only: Google detects the end of the utterance, or the turn completes |
| `conversation.item.input_audio_transcription.completed` | `item_id`, `content_index: 0`, `transcript`; `usage: {"type": "duration", "seconds": 18.0}` when Google billed audio since the previous `completed` | Server VAD: each final result, a forced stream switch during continuous speech included. Push to talk: after `commit` or `end` |
| `error` | `error.type: server_error`; `error.message` is `upstream websocket closed with code 1011: Google Speech-to-Text streaming failed: ...` | Google's stream failed; the proxy closes with code `1011` right after |

Deltas are computed word by word, ignoring case and punctuation, so when Google revises an earlier word the delta restarts from that word. Take the final text from `completed.transcript`, which is Google's final result with its punctuation, rather than joining deltas. Turns are correlated by `item_id`. The session stays open after the last `completed` until you close it; the proxy closes it on its own only after a Google failure

### Pricing and usage

Chirp is billed per second of audio (`input_cost_per_second` in the model cost map). `usage.seconds` is the audio Google billed since the previous `completed`, silence included, so it can exceed the utterance length. Audio billed after the last `completed` event, such as trailing silence, is logged for cost when the session closes

Transcripts are stored in the spend log's messages unless message logging is turned off

### Guardrails

Guardrails with `mode: realtime_input_transcription` run on each completed transcript; see [Realtime Guardrails](/docs/proxy/guardrails/realtime_guardrails). The `completed` event reaches the client before the guardrail runs, and deltas are not checked. Select guardrails per connection with a `guardrails=name1,name2` query parameter

:::warning
With a `realtime_input_transcription` guardrail configured, LiteLLM rewrites a client's `turn_detection: null` into `{"create_response": false}` before the session is configured, so push to talk clients run in server VAD mode: utterances complete on their own and `input_audio_buffer.commit` only completes the turn in progress. Server VAD clients are unaffected
:::

### Example OpenAI SDK client

Push to talk: connect with the OpenAI SDK, configure, stream a mono PCM16 WAV file in 100 ms chunks, commit, then read events until the final transcript arrives

```python showLineNumbers title="Chirp push to talk client"
import asyncio
import base64
import wave

from openai import AsyncOpenAI

client = AsyncOpenAI(base_url="http://localhost:4000/v1", api_key="sk-1234")


def pcm_chunks(path, chunk_ms=100):
    with wave.open(path) as w:
        rate, frames = w.getframerate(), w.readframes(w.getnframes())
    step = rate * 2 * chunk_ms // 1000
    return rate, [frames[i : i + step] for i in range(0, len(frames), step)]


async def main():
    rate, chunks = pcm_chunks("speech.wav")
    async with client.realtime.connect(model="chirp-3", extra_query={"intent": "transcription"}) as conn:
        await conn.session.update(
            session={
                "type": "transcription",
                "audio": {
                    "input": {
                        "format": {"type": "audio/pcm", "rate": rate},
                        "transcription": {"model": "chirp-3", "language": "en"},
                        "turn_detection": None,
                    }
                },
            }
        )
        for chunk in chunks:
            await conn.input_audio_buffer.append(audio=base64.b64encode(chunk).decode())
            await asyncio.sleep(0.1)
        await conn.input_audio_buffer.commit()
        async for event in conn:
            if event.type == "conversation.item.input_audio_transcription.delta":
                print(event.delta, end="", flush=True)
            elif event.type == "conversation.item.input_audio_transcription.completed":
                print(f"\n{event.transcript} ({event.usage.seconds} s)")
                break
            elif event.type == "error":
                print(event.error.message)
                break
            else:
                print(event.type)


asyncio.run(main())
```

```text
session.created
session.updated
what is the weather in Paris
What is the weather in Paris? (2.4 s)
```

For server VAD, send `"turn_detection": {"type": "server_vad"}` instead of `None` and keep reading events for as long as the microphone is open: each detected utterance arrives with its own `item_id` and completes on its own, and `input_audio_buffer.commit` completes whatever is in progress
