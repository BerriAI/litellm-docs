---
title: "Gnani Speech to Text with LiteLLM"
sidebar_label: "Gnani"
description: "Transcribe audio with Gnani Prisma v3.0 and v2.5 using litellm.transcription(), the OpenAI-compatible /audio/transcriptions endpoint, or live over the /v1/realtime WebSocket on the LiteLLM AI Gateway."
---

# Gnani

<SinceVersion v="1.112.0" />

LiteLLM supports Gnani's Prisma REST speech-to-text API for one recording of up to 30 seconds, and the proxy streams live audio to Gnani over the OpenAI-compatible `/v1/realtime` WebSocket ([see below](#realtime-transcription)).

| Property | Details |
|-------|-------|
| Description | Gnani's Prisma models transcribe Indic and English speech, including mixed-language audio. |
| Provider Route on LiteLLM | `gnani/` |
| Supported Models | `gnani/prisma-v3.0`, `gnani/prisma-v2.5` |
| Provider Doc | [Gnani REST reference ↗](https://docs.gnani.ai/api/STT/speech-to-text) |
| Supported OpenAI Endpoints | `/audio/transcriptions`, `/realtime` (transcription only, proxy) |

Gnani accepts WAV, MP3, OGG, FLAC, AAC and M4A. Keep the correct extension on the upload because Gnani selects its decoder from the filename. For in-memory compressed audio, pass a tuple such as `("clip.mp3", audio_bytes)`.

Set `GNANI_API_KEY` to your Gnani key or pass `api_key`. To use a different provider host, set `GNANI_API_BASE` or pass `api_base`. LiteLLM appends `/stt/v3` to it, and the default host is `https://api.vachana.ai`.

## Quick Start

```python
import asyncio
import os
from pathlib import Path

import litellm

os.environ["GNANI_API_KEY"] = ""

audio = Path("lecture.wav")
result = litellm.transcription(model="gnani/prisma-v3.0", file=audio)
print(result.text)

result_v25 = litellm.transcription(model="gnani/prisma-v2.5", file=audio, language="hi")
print(result_v25.text)


async def transcribe():
    result = await litellm.atranscription(
        model="gnani/prisma-v3.0",
        file=audio,
        language="hi,en",
        format="codemix",
        keyterms=["fractions"],
    )
    print(result.text)


asyncio.run(transcribe())
```

## LiteLLM Proxy Usage

Save this as `config.yaml`, set `GNANI_API_KEY` and `LITELLM_MASTER_KEY`, and start the proxy with `litellm --config config.yaml`.

```yaml
model_list:
  - model_name: gnani-prisma-v3
    litellm_params:
      model: gnani/prisma-v3.0
      api_key: os.environ/GNANI_API_KEY
    model_info:
      mode: audio_transcription
  - model_name: gnani-prisma-v2-5
    litellm_params:
      model: gnani/prisma-v2.5
      api_key: os.environ/GNANI_API_KEY
      language: hi
    model_info:
      mode: audio_transcription

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Prisma v2.5 needs exactly one language, so set `language` on its deployment. Requests that pass no `language` use it, and the proxy's `/health` check needs it to call the model.

Send a recording with curl.

```bash
curl http://localhost:4000/v1/audio/transcriptions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -F model=gnani-prisma-v3 \
  -F file=@lecture.wav
```

Or use the OpenAI SDK. Multipart clients send arrays as JSON strings.

```python
import os
from pathlib import Path

from openai import OpenAI

client = OpenAI(base_url="http://localhost:4000/v1", api_key=os.environ["LITELLM_MASTER_KEY"])
result = client.audio.transcriptions.create(
    model="gnani-prisma-v3",
    file=Path("lecture.wav"),
    extra_body={"format": "codemix", "keyterms": '["fractions"]'},
)
print(result.text)
```

## Parameters and response

On v3.0, omit `language` for automatic detection or supply one to four comma-separated hints such as `en`, `hi-IN` or `hi,en`. On v2.5, pass exactly one language such as `hi` or `en-IN`. Gnani's own `language_code` field also works and takes priority over `language`. OpenAI's `languages` list works too, so `languages=["hi", "en"]` sends `hi-IN,en-IN`. It takes priority over `language`, including a deployment's default `language`, and `language_code` takes priority over both. LiteLLM sends a two-letter code as its Indian locale, so `hi` becomes `hi-IN`, and fixes the case of a region code, so `hi-in` becomes `hi-IN`. Other `gnani/` model names, such as a newer Prisma release, use the v3.0 parameters.

Both models return JSON with a `text` field. When Gnani reports them, the response also has `language` (the detected language code), `request_id`, and `truncated`, which is `true` when Gnani transcribed only part of the audio. A successful silent clip can return an empty string.

Both models accept `format=transcribe` for conventional number formatting and `format=verbatim` for spoken forms. Prisma v3.0 also accepts `codemix` for mixed scripts and `transliterate` for Latin script. Omit `format` to use the provider's default. OpenAI's separate `response_format` accepts only `json`.

Prisma v3.0 accepts up to 200 `keyterms`, a `topic` of up to 1,600 characters, `previous_text` (it uses the last 600 characters), and one to four `speaker_names`. On v3.0, LiteLLM sends OpenAI's `prompt` as `previous_text` unless you also pass `previous_text`. For word boosting on v2.5, pass `bias_list=["Prisma"]` and `bias_score=1.5`. OpenAI's `keywords` list becomes `keyterms` on v3.0 and `bias_list` on v2.5, unless you also pass that field. On v2.5, LiteLLM adds Gnani's recommended `bias_score` of 1.0 when you leave it out, since Gnani boosts nothing without a score. v2.5 boosts only single words made of letters, so a keyword such as `HDFC Bank` or `COVID-19` gets a 400 there, and `drop_params` drops the keywords instead. Use v3.0 for phrases. On v3.0, a `bias_list` you pass wins over `keywords`, since Gnani uses `keyterms` over `bias_list`. For digits in the target script on v2.5, use `format="transcribe"` and `itn_native_numerals=True`. See the [Prisma v3.0 model guide](https://docs.gnani.ai/api/STT/models/prisma-v3) and the [Prisma v2.5 model guide](https://docs.gnani.ai/api/STT/models/prisma-v2-5).

Both models support find-and-replace. Pass `enable_substitution=True` and a `substitution_map` of up to ten rules, for example `[{"patterns": ["maths"], "replacement": "mathematics"}]`. Gnani validates audio and context limits and LiteLLM returns its errors to the caller. LiteLLM sends other options it does not know, such as an option Gnani adds later, to Gnani as form fields. With caching on, Gnani's own options such as `format`, `language_code` and `keyterms` are part of the cache key only when `enable_caching_on_provider_specific_optional_params: true` is set under `litellm_settings`, so set it when the same audio is sent with different options.

To trace a request, set `X-API-Request-ID` in `extra_headers`, in the SDK call or in the deployment's `litellm_params`. LiteLLM sends `extra_headers` to Gnani as HTTP headers, and Gnani returns the id as `request_id`. LiteLLM always sends the configured key as `X-API-Key-ID` and drops any `X-API-Key-ID` in `extra_headers`, in any letter case. A number or boolean value, such as `1` in YAML, is sent as text.

```yaml
model_list:
  - model_name: gnani-prisma-v3
    litellm_params:
      model: gnani/prisma-v3.0
      api_key: os.environ/GNANI_API_KEY
      extra_headers:
        X-API-Request-ID: support-desk-7
    model_info:
      mode: audio_transcription
```

A transcription request to `gnani-prisma-v3` then returns `"request_id": "support-desk-7"` next to `text`.

## Limitations

These limits cover REST transcription. Prisma REST has no word timestamps, speaker diarization or streaming. For live audio, use [realtime transcription](#realtime-transcription). OpenAI `temperature`, `timestamp_granularities`, `chunking_strategy`, `include`, `known_speaker_names`, `known_speaker_references` and `stream=True` have no equivalent here, and neither does `prompt` on v2.5, so LiteLLM returns a 400 for them. It also returns a 400 for a Gnani option the chosen model does not accept, such as `topic` on v2.5. To drop them instead, pass `drop_params=True` in the SDK or set `drop_params: true` under `litellm_settings` on the proxy.

Gnani limits how many requests an account can run at once and answers an overlapping request with a 429. The account used in testing ran one request at a time, and keys on the same account share the limit. The proxy retries a 429 twice by default, which covered three overlapping requests in testing. For more parallel traffic, raise `num_retries` under `router_settings`. The SDK functions `litellm.transcription` and `litellm.atranscription` do not retry, so SDK code that sends overlapping requests should call `atranscription` on a `litellm.Router` with `num_retries` set.

```python
import asyncio
import os

import litellm

router = litellm.Router(
    model_list=[
        {
            "model_name": "gnani-prisma-v3",
            "litellm_params": {"model": "gnani/prisma-v3.0", "api_key": os.environ["GNANI_API_KEY"]},
        }
    ],
    num_retries=4,
)


async def main() -> None:
    results = await asyncio.gather(
        *(router.atranscription(model="gnani-prisma-v3", file=open("lecture.wav", "rb")) for _ in range(3))
    )
    print([result.text for result in results])


asyncio.run(main())
```

Gnani has no published per-second rate in the LiteLLM model cost map, so spend shows as zero until you set your contracted rate as `input_cost_per_second` in the deployment's `litellm_params`. LiteLLM multiplies it by the length of the uploaded recording, which it reads with the `soundfile` package. `pip install 'litellm[proxy]'` includes it, but a plain `pip install litellm` does not, so install `soundfile` for SDK spend. LiteLLM cannot read the length of AAC and M4A uploads or of OGG files that hold FLAC audio, so those requests still bill zero. While spend is zero, key and team budgets do not limit Gnani traffic.

```yaml
model_list:
  - model_name: gnani-prisma-v3
    litellm_params:
      model: gnani/prisma-v3.0
      api_key: os.environ/GNANI_API_KEY
      input_cost_per_second: 0.0001
    model_info:
      mode: audio_transcription
```

## Realtime Transcription

<SinceVersion v="1.113.0" />

The proxy serves Prisma v3.0 and v2.5 for live audio on its OpenAI-compatible `/v1/realtime` WebSocket. Clients speak the OpenAI Realtime transcription protocol. LiteLLM forwards the audio to Gnani's streaming API, and Gnani's voice activity detection decides where each utterance ends, so every utterance gets its own final transcript.

### 1. Add the model to your config

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gnani-prisma
    litellm_params:
      model: gnani/prisma-v3.0
      api_key: os.environ/GNANI_API_KEY
      input_cost_per_second: 0.0001

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

`api_key` falls back to `GNANI_API_KEY`. `api_base` falls back to `GNANI_API_BASE` and then to `https://api.vachana.ai`. It must be an `https://` or `wss://` URL, since LiteLLM sends the key in the WebSocket handshake. LiteLLM connects over `wss://` and appends `/stt/v3/stream` to the path. Set Gnani connection options such as `format` or `x-idle-timeout-sec` in the deployment's `extra_headers`.

The cost map has no Gnani price, so set your contracted rate as `input_cost_per_second` to track spend and enforce key and team budgets.

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 2. Transcribe a recording

Connect with `intent=transcription` in the query string. This example reads a 24 kHz mono PCM16 WAV file and prints its first final transcript.

```python
import asyncio
import base64
import os
import wave

from openai import AsyncOpenAI


async def transcribe(path):
    async with AsyncOpenAI(base_url="http://localhost:4000/v1", api_key=os.environ["LITELLM_API_KEY"]) as client:
        async with client.realtime.connect(model="gnani-prisma", extra_query={"intent": "transcription"}) as ws:
            await ws.session.update(session={
                "type": "transcription",
                "audio": {"input": {"transcription": {"model": "gnani-prisma", "language": "en"}}},
            })
            with wave.open(path, "rb") as audio:
                assert (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) == (24000, 1, 2)
                while chunk := audio.readframes(768):
                    await ws.input_audio_buffer.append(audio=base64.b64encode(chunk).decode())
            await ws.input_audio_buffer.commit()
            async for event in ws:
                if event.type == "error":
                    raise RuntimeError(event.error.message)
                if event.type == "conversation.item.input_audio_transcription.completed":
                    print(event.transcript)
                    return


asyncio.run(transcribe("speech.wav"))
```

### 3. Configure the session

| Field | Rules |
| --- | --- |
| `format` | `type` must be `audio/pcm` with one channel. `rate` must be `8000`, `16000`, `24000`, `44100` or `48000`, and omitted means 24 kHz. LiteLLM resamples the audio to the 16 kHz Gnani expects. |
| `transcription.language` | One language such as `hi` or `en-IN`, or `indic-auto` on Prisma v3.0 to detect the language, which is the default. Prisma v2.5 needs one explicit language before the first audio append. A comma-separated list is rejected. |
| `turn_detection` | Omitted or `{"type": "server_vad"}`. Gnani's server VAD has fixed settings, so `threshold`, `prefix_padding_ms`, `silence_duration_ms`, any other turn detection type and `turn_detection: null` are rejected. |
| `transcription.prompt` | Rejected. |

With [`drop_params`](/docs/completion/drop_params) set on the deployment, LiteLLM drops the rejected settings and keeps Gnani's server VAD instead. A rejected `session.update` returns an `error` event and the session stays open, so the client can send a corrected update.

### 4. Stream audio

`input_audio_buffer.append` carries base64 mono PCM16 at the session's rate, at most four seconds of audio per append. Gnani requires audio at real-time pace, so LiteLLM forwards it at that pace. Send each append as the audio arrives, since a recording sent faster than real time still takes its own length to reach Gnani.

`input_audio_buffer.commit` ends the current utterance at once. A commit with no speech since the last transcript, such as one after Gnani already ended the utterance on its own or one over silence only, gets no reply, so do not wait for `input_audio_buffer.committed` after it. Every other client event, including `input_audio_buffer.clear` and `response.create`, returns an `error` event and the session stays open.

### 5. Read transcripts

| Event | Fields | When |
| --- | --- | --- |
| `session.created` | `session.type: transcription` | Gnani accepted the connection |
| `session.updated` | Effective settings, same `session.id` | Gnani accepted your `session.update` |
| `input_audio_buffer.speech_started` | `item_id` | Gnani detected speech |
| `input_audio_buffer.speech_stopped` | `item_id` | Right before the utterance's transcript |
| `input_audio_buffer.committed` | `item_id`, `previous_item_id` | Right before the utterance's transcript |
| `conversation.item.input_audio_transcription.completed` | `item_id`, `transcript`, `usage: {"type": "duration", "seconds": 4.032}`, `detected_language_code` when Gnani reports it | Final transcript of each utterance |
| `error` | `error.message` | Gnani or LiteLLM rejected an event |

All four utterance events share one `item_id`. `usage.seconds` is the length of the utterance, and silence between utterances is billed with the next transcript or when the session closes.

### Session limits

Gnani closes a session after 15 minutes, or after 60 seconds without detected speech. Set `x-idle-timeout-sec` (5 to 900) in the deployment's `extra_headers` to change the idle limit. LiteLLM does not reconnect a closed session, so open a new one and continue from the last completed utterance.

```yaml
model_list:
  - model_name: gnani-prisma
    litellm_params:
      model: gnani/prisma-v3.0
      api_key: os.environ/GNANI_API_KEY
      input_cost_per_second: 0.0001
      extra_headers:
        x-idle-timeout-sec: "300"
```

A session on `gnani-prisma` then stays open through up to five minutes without speech.

On Python 3.13 and later, the resampler needs the `audioop-lts` package, which `pip install 'litellm[proxy]'` installs. {/* keep-python-version */}
