import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ElevenLabs

ElevenLabs provides high-quality AI voice technology, including speech-to-text capabilities through their transcription API.

| Property | Details |
|----------|---------|
| Description | ElevenLabs offers advanced AI voice technology with speech-to-text transcription and text-to-speech capabilities that support multiple languages and speaker diarization. |
| Provider Route on LiteLLM | `elevenlabs/` |
| Provider Doc | [ElevenLabs API ↗](https://elevenlabs.io/docs/api-reference) |
| Supported Endpoints | `/audio/transcriptions`, `/audio/speech`, `/v1/realtime` |

## Quick Start

### LiteLLM Python SDK

<Tabs>
<TabItem value="basic" label="Basic Usage">

```python showLineNumbers title="Basic audio transcription with ElevenLabs"
import litellm

# Transcribe audio file
with open("audio.mp3", "rb") as audio_file:
    response = litellm.transcription(
        model="elevenlabs/scribe_v1",
        file=audio_file,
        api_key="your-elevenlabs-api-key"  # or set ELEVENLABS_API_KEY env var
    )

print(response.text)
```

</TabItem>

<TabItem value="advanced" label="Advanced Features">

```python showLineNumbers title="Audio transcription with advanced features"
import litellm

# Transcribe with speaker diarization and language specification
with open("audio.wav", "rb") as audio_file:
    response = litellm.transcription(
        model="elevenlabs/scribe_v1",
        file=audio_file,
        language="en",           # Language hint (maps to language_code)
        temperature=0.3,         # Control randomness in transcription
        diarize=True,           # Enable speaker diarization
        api_key="your-elevenlabs-api-key"
    )

print(f"Transcription: {response.text}")
print(f"Language: {response.language}")

# Access word-level timestamps if available
if hasattr(response, 'words') and response.words:
    for word_info in response.words:
        print(f"Word: {word_info['word']}, Start: {word_info['start']}, End: {word_info['end']}")
```

</TabItem>

<TabItem value="async" label="Async Usage">

```python showLineNumbers title="Async audio transcription"
import litellm
import asyncio

async def transcribe_audio():
    with open("audio.mp3", "rb") as audio_file:
        response = await litellm.atranscription(
            model="elevenlabs/scribe_v1",
            file=audio_file,
            api_key="your-elevenlabs-api-key"
        )
    
    return response.text

# Run async transcription
result = asyncio.run(transcribe_audio())
print(result)
```

</TabItem>
</Tabs>

### LiteLLM Proxy

#### 1. Configure your proxy

<Tabs>
<TabItem value="config-yaml" label="config.yaml">

```yaml showLineNumbers title="ElevenLabs configuration in config.yaml"
model_list:
  - model_name: elevenlabs-transcription
    litellm_params:
      model: elevenlabs/scribe_v1
      api_key: os.environ/ELEVENLABS_API_KEY

general_settings:
  master_key: your-master-key
```

</TabItem>

<TabItem value="env-vars" label="Environment Variables">

```bash showLineNumbers title="Required environment variables"
export ELEVENLABS_API_KEY="your-elevenlabs-api-key"
export LITELLM_MASTER_KEY="your-master-key"
```

</TabItem>
</Tabs>

#### 2. Start the proxy

```bash showLineNumbers title="Start LiteLLM proxy server"
litellm --config config.yaml

# Proxy will be available at http://localhost:4000
```

#### 3. Make transcription requests

<Tabs>
<TabItem value="curl" label="Curl">

```bash showLineNumbers title="Audio transcription with curl"
curl http://localhost:4000/v1/audio/transcriptions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F file="@audio.mp3" \
  -F model="elevenlabs-transcription" \
  -F language="en" \
  -F temperature="0.3"
```

</TabItem>

<TabItem value="openai-sdk" label="OpenAI Python SDK">

```python showLineNumbers title="Using OpenAI SDK with LiteLLM proxy"
from openai import OpenAI

# Initialize client with your LiteLLM proxy URL
client = OpenAI(
    base_url="http://localhost:4000",
    api_key="your-litellm-api-key"
)

# Transcribe audio file
with open("audio.mp3", "rb") as audio_file:
    response = client.audio.transcriptions.create(
        model="elevenlabs-transcription",
        file=audio_file,
        language="en",
        temperature=0.3,
        # ElevenLabs-specific parameters
        diarize=True,
        speaker_boost=True,
        custom_vocabulary="technical,AI,machine learning"
    )

print(response.text)
```

</TabItem>

<TabItem value="javascript" label="JavaScript/Node.js">

```javascript showLineNumbers title="Audio transcription with JavaScript"
import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  baseURL: 'http://localhost:4000',
  apiKey: 'your-litellm-api-key'
});

async function transcribeAudio() {
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream('audio.mp3'),
    model: 'elevenlabs-transcription',
    language: 'en',
    temperature: 0.3,
    diarize: true,
    speaker_boost: true
  });

  console.log(response.text);
}

transcribeAudio();
```

</TabItem>
</Tabs>

## Response Format

ElevenLabs returns transcription responses in OpenAI-compatible format:

```json showLineNumbers title="Example transcription response"
{
  "text": "Hello, this is a sample transcription with multiple speakers.",
  "task": "transcribe",
  "language": "en",
  "words": [
    {
      "word": "Hello",
      "start": 0.0,
      "end": 0.5
    },
    {
      "word": "this",
      "start": 0.5,
      "end": 0.8
    }
  ]
}
```

### Common Issues

1. **Invalid API Key**: Ensure `ELEVENLABS_API_KEY` is set correctly

## Realtime Transcription (Scribe v2 Realtime)

LiteLLM serves `scribe_v2_realtime` through the proxy's OpenAI-compatible `/v1/realtime` WebSocket. Clients speak the OpenAI Realtime transcription protocol; LiteLLM opens the ElevenLabs realtime speech-to-text socket after the client's first `session.update`, forwards the audio and maps ElevenLabs transcripts back to OpenAI events. The model is realtime only; for file transcription use `scribe_v2` on `/audio/transcriptions`.

### 1. Add the model to your config

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: scribe-realtime
    litellm_params:
      model: elevenlabs/scribe_v2_realtime
      api_key: os.environ/ELEVENLABS_API_KEY
      # optional ElevenLabs settings
      keyterms: ["LiteLLM", "Scribe"]
      no_verbatim: true
      vad_silence_threshold_secs: 1.2
```

`api_key` falls back to `ELEVENLABS_API_KEY` and is sent only in the `xi-api-key` header. `api_base` is optional and falls back to `ELEVENLABS_API_BASE`; set it to a regional host such as `https://api.eu.residency.elevenlabs.io`. It must be an absolute `https://` or `wss://` URL; LiteLLM keeps its host and port and replaces the path with `/v1/speech-to-text/realtime`. Embedded credentials and URL fragments are rejected.

These optional `litellm_params` become ElevenLabs session settings. Invalid values fail the session before anything is sent to ElevenLabs.

| Setting | Type | Effect |
| --- | --- | --- |
| `keyterms` | list of strings | Bias recognition toward these terms |
| `secondary_languages` | list of ISO language codes | Additional languages to expect |
| `no_verbatim` | bool | Remove filler words and disfluencies |
| `filter_background_audio` | bool | Suppress background audio |
| `vad_threshold` | number, at least 0 | Voice activity detection threshold |
| `vad_silence_threshold_secs` | number, at least 0 | Silence that ends a VAD segment |
| `min_speech_duration_ms` | integer, at least 0 | Shortest speech that counts |
| `min_silence_duration_ms` | integer, at least 0 | Shortest silence that counts |
| `enable_logging` | bool | `false` turns on ElevenLabs zero retention mode, which ElevenLabs limits to enterprise accounts |

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml

# RUNNING on http://0.0.0.0:4000
```

### 2. Connect

```text
ws://localhost:4000/v1/realtime?model=scribe-realtime
```

Authenticate with `Authorization: Bearer <proxy key>`. LiteLLM sends `session.created` right away with default settings (24 kHz PCM, server VAD); nothing is sent to ElevenLabs yet.

### 3. Configure the session

Send one `session.update` (or `transcription_session.update`). LiteLLM opens the ElevenLabs session with these settings and sends `session.updated`, with the same session id, once ElevenLabs accepts it. Later updates are ignored. Audio sent before `session.updated` is buffered and replayed, so you can start streaming right away.

```json showLineNumbers title="session.update"
{
  "type": "session.update",
  "session": {
    "type": "transcription",
    "audio": {
      "input": {
        "format": {"type": "audio/pcm", "rate": 24000},
        "turn_detection": {"type": "server_vad"},
        "transcription": {"model": "scribe_v2_realtime", "language": "en"}
      }
    }
  }
}
```

| Field | Rules |
| --- | --- |
| `format` | `type` must be `audio/pcm` and `channels` must be `1`. `rate` must be `8000`, `16000`, `22050`, `24000`, `44100` or `48000`; omitted means 24 kHz. |
| `transcription.model` | Optional. Only `scribe_v2_realtime` or `elevenlabs/scribe_v2_realtime` is accepted. |
| `transcription.language` | Optional ISO 639-1 or ISO 639-3 code. Region suffixes are dropped, so `en-US` becomes `en`. |
| `turn_detection` | Omitted or `{"type": "server_vad"}` selects ElevenLabs VAD commits; `null` selects manual commits. Any other `type` is rejected, or falls back to server VAD when [`drop_params`](/docs/completion/drop_params) is set. |
| Beta layout | `input_audio_format: "pcm16"` plus `input_audio_transcription` is accepted at 24 kHz. |

An invalid `session.update` (bad format, rate, model, language or turn detection type) closes the connection without an `error` event; the reason is in the proxy log at debug level. Invalid audio after setup, such as invalid base64 or an odd number of PCM bytes, closes the same way.

### 4. Stream audio

`input_audio_buffer.append` carries base64 mono PCM16 at the configured rate. LiteLLM forwards it as ElevenLabs `input_audio_chunk` messages, splitting large appends into chunks of at most 32000 bytes. `input_audio_buffer.commit` and `input_audio_buffer.end` commit the current segment in either mode. `input_audio_buffer.clear` and every other client event, including `response.create`, are dropped.

With server VAD, ElevenLabs commits a segment after a pause of `vad_silence_threshold_secs`, so keep streaming audio (silence included) in real time, or send `input_audio_buffer.commit` to commit at once.

### 5. Read transcripts

| Event | Fields | When |
| --- | --- | --- |
| `session.created` | `session.type: transcription`, default 24 kHz server VAD settings | On connect |
| `session.updated` | Effective settings, same `session.id` | After ElevenLabs accepts your `session.update` |
| `input_audio_buffer.speech_started` | `item_id` | First partial transcript of a segment |
| `conversation.item.input_audio_transcription.delta` | `item_id`, `content_index: 0`, `delta` | New words of the partial transcript |
| `input_audio_buffer.speech_stopped` | `item_id` | The segment is committed |
| `conversation.item.input_audio_transcription.completed` | `item_id`, `content_index: 0`, `transcript`, `usage: {"type": "duration", "seconds": 7.57}` | Final transcript for the segment |
| `error` | `error.type: server_error`, `error.message: ElevenLabs realtime transcription failed: <type>` | ElevenLabs reported an error such as `auth_error` or `quota_exceeded` |

ElevenLabs keeps revising the last word of each partial transcript, so a delta carries a word only after a later partial confirms it. The `completed` transcript is the authoritative text for the segment. An invalid ElevenLabs key arrives as an `error` event with `auth_error`, followed by a normal close. If LiteLLM cannot open the ElevenLabs socket at all (a network failure, a timeout or an HTTP rejection of the handshake), the proxy closes the client connection with code `1011` and a reason such as `ElevenLabs realtime connection failed (HTTP 403)`.

### Pricing and usage

Scribe v2 Realtime is billed per second of input audio (`input_cost_per_second` in the model cost map). `usage.seconds` is the audio LiteLLM sent to ElevenLabs since the previous `completed` event, silence included. Audio after the last `completed` event is billed when the session closes. The keyterm and transcript edit add-on rates are not included in the cost.

### Example Python client

Server VAD: configure, stream a mono PCM16 WAV file in 100 ms chunks in real time, add silence so ElevenLabs commits, then print transcript events.

```python showLineNumbers title="Scribe v2 Realtime client"
import asyncio
import base64
import json
import os
import wave

import websockets

URL = "ws://localhost:4000/v1/realtime?model=scribe-realtime"
HEADERS = {"Authorization": f'Bearer {os.environ["LITELLM_API_KEY"]}'}


async def main():
    with wave.open("speech.wav") as w:  # mono PCM16
        rate, audio = w.getframerate(), w.readframes(w.getnframes())
    step = rate * 2 // 10
    async with websockets.connect(URL, additional_headers=HEADERS) as ws:
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "type": "transcription",
                "audio": {"input": {
                    "format": {"type": "audio/pcm", "rate": rate},
                    "turn_detection": {"type": "server_vad"},
                    "transcription": {"model": "scribe_v2_realtime"},
                }},
            },
        }))

        async def send_audio():
            for i in range(0, len(audio), step):
                chunk = base64.b64encode(audio[i : i + step]).decode()
                await ws.send(json.dumps({"type": "input_audio_buffer.append", "audio": chunk}))
                await asyncio.sleep(0.1)
            silence = base64.b64encode(b"\x00\x00" * rate * 3).decode()
            await ws.send(json.dumps({"type": "input_audio_buffer.append", "audio": silence}))

        sender = asyncio.create_task(send_audio())
        async for raw in ws:
            event = json.loads(raw)
            if event["type"].endswith(".delta"):
                print(event["delta"], end="", flush=True)
            elif event["type"].endswith(".completed"):
                print("\n" + event["transcript"], event.get("usage"))
                break
            elif event["type"] == "error":
                print(event["error"])
                break
        sender.cancel()


asyncio.run(main())
```

---

## Text-to-Speech (TTS)

ElevenLabs provides high-quality text-to-speech capabilities through their TTS API, supporting multiple voices, languages, and audio formats.

### Overview

| Property | Details |
|----------|---------|
| Description | Convert text to natural-sounding speech using ElevenLabs' advanced TTS models |
| Provider Route on LiteLLM | `elevenlabs/` |
| Supported Operations | `/audio/speech` |
| Link to Provider Doc | [ElevenLabs TTS API ↗](https://elevenlabs.io/docs/api-reference/text-to-speech) |

### Supported Models

| Model | Route | Description |
|-------|-------|-------------|
| Eleven v3 | `elevenlabs/eleven_v3` | Most expressive model. 70+ languages, audio tags support for sound effects and pauses. |
| Eleven Multilingual v2 | `elevenlabs/eleven_multilingual_v2` | Default TTS model. 29 languages, stable and production-ready. |

### Quick Start

#### LiteLLM Python SDK

```python showLineNumbers title="ElevenLabs Text-to-Speech with SDK"
import litellm
import os

os.environ["ELEVENLABS_API_KEY"] = "your-elevenlabs-api-key"

# Basic usage with voice mapping
audio = litellm.speech(
    model="elevenlabs/eleven_multilingual_v2",
    input="Testing ElevenLabs speech from LiteLLM.",
    voice="alloy",  # Maps to ElevenLabs voice ID automatically
)

# Save audio to file
with open("test_output.mp3", "wb") as f:
    f.write(audio.read())
```

#### Using Eleven v3 with Audio Tags

Eleven v3 supports [audio tags](https://elevenlabs.io/docs/overview/capabilities/text-to-speech#audio-tags) for adding sound effects and pauses directly in the text:

```python showLineNumbers title="Eleven v3 with audio tags"
import litellm
import os

os.environ["ELEVENLABS_API_KEY"] = "your-elevenlabs-api-key"

audio = litellm.speech(
    model="elevenlabs/eleven_v3",
    input='Welcome back. <sfx>applause</sfx> Today we have a special guest. <pause duration="1.5s"/> Let me introduce them.',
    voice="alloy",
)

with open("eleven_v3_output.mp3", "wb") as f:
    f.write(audio.read())
```

#### Advanced Usage: Overriding Parameters and ElevenLabs-Specific Features

```python showLineNumbers title="Advanced TTS with custom parameters"
import litellm
import os

os.environ["ELEVENLABS_API_KEY"] = "your-elevenlabs-api-key"

# Example showing parameter overriding and ElevenLabs-specific parameters
audio = litellm.speech(
    model="elevenlabs/eleven_multilingual_v2",
    input="Testing ElevenLabs speech from LiteLLM.",
    voice="alloy",  # Can use mapped voice name or raw ElevenLabs voice_id
    response_format="pcm",  # Maps to ElevenLabs output_format
    speed=1.1,  # Maps to voice_settings.speed
    # ElevenLabs-specific parameters - passed directly to API
    pronunciation_dictionary_locators=[
        {"pronunciation_dictionary_id": "dict_123", "version_id": "v1"}
    ],
    model_id="eleven_multilingual_v2",  # Override model if needed
)

# Save audio to file
with open("test_output.mp3", "wb") as f:
    f.write(audio.read())
```

### Voice Mapping

LiteLLM automatically maps common OpenAI voice names to ElevenLabs voice IDs:

| OpenAI Voice | ElevenLabs Voice ID | Description |
|--------------|---------------------|-------------|
| `alloy` | `21m00Tcm4TlvDq8ikWAM` | Rachel - Neutral and balanced |
| `amber` | `5Q0t7uMcjvnagumLfvZi` | Paul - Warm and friendly |
| `ash` | `AZnzlk1XvdvUeBnXmlld` | Domi - Energetic |
| `august` | `D38z5RcWu1voky8WS1ja` | Fin - Professional |
| `blue` | `2EiwWnXFnvU5JabPnv8n` | Clyde - Deep and authoritative |
| `coral` | `9BWtsMINqrJLrRacOk9x` | Aria - Expressive |
| `lily` | `EXAVITQu4vr4xnSDxMaL` | Sarah - Friendly |
| `onyx` | `29vD33N1CtxCmqQRPOHJ` | Drew - Strong |
| `sage` | `CwhRBWXzGAHq8TQ4Fs17` | Roger - Calm |
| `verse` | `CYw3kZ02Hs0563khs1Fj` | Dave - Conversational |

**Using Custom Voice IDs**: You can also pass any ElevenLabs voice ID directly. If the voice name is not in the mapping, LiteLLM will use it as-is:

```python showLineNumbers title="Using custom ElevenLabs voice ID"
audio = litellm.speech(
    model="elevenlabs/eleven_multilingual_v2",
    input="Testing with a custom voice.",
    voice="21m00Tcm4TlvDq8ikWAM",  # Direct ElevenLabs voice ID
)
```

### Response Format Mapping

LiteLLM maps OpenAI response formats to ElevenLabs output formats:

| OpenAI Format | ElevenLabs Format |
|---------------|-------------------|
| `mp3` | `mp3_44100_128` |
| `pcm` | `pcm_44100` |
| `opus` | `opus_48000_128` |

You can also pass ElevenLabs-specific output formats directly using the `output_format` parameter.

### Supported Parameters

```python showLineNumbers title="All Supported Parameters"
audio = litellm.speech(
    model="elevenlabs/eleven_multilingual_v2",  # Required
    input="Text to convert to speech",           # Required
    voice="alloy",                               # Required: Voice selection (mapped or raw ID)
    response_format="mp3",                      # Optional: Audio format (mp3, pcm, opus)
    speed=1.0,                                  # Optional: Speech speed (maps to voice_settings.speed)
    # ElevenLabs-specific parameters (passed directly):
    model_id="eleven_multilingual_v2",           # Optional: Override model
    voice_settings={                             # Optional: Voice customization
        "stability": 0.5,
        "similarity_boost": 0.75,
        "speed": 1.0
    },
    pronunciation_dictionary_locators=[         # Optional: Custom pronunciation
           {"pronunciation_dictionary_id": "dict_123", "version_id": "v1"}
    ],
)
```

### LiteLLM Proxy

#### 1. Configure your proxy

```yaml showLineNumbers title="ElevenLabs TTS configuration in config.yaml"
model_list:
  - model_name: elevenlabs-tts
    litellm_params:
      model: elevenlabs/eleven_multilingual_v2
      api_key: os.environ/ELEVENLABS_API_KEY

general_settings:
  master_key: your-master-key
```

#### 2. Make TTS requests

##### Simple Usage (OpenAI Parameters)

You can use standard OpenAI-compatible parameters without any provider-specific configuration:

```bash showLineNumbers title="Simple TTS request with curl"
curl http://localhost:4000/v1/audio/speech \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "elevenlabs-tts",
    "input": "Testing ElevenLabs speech via the LiteLLM proxy.",
    "voice": "alloy",
    "response_format": "mp3"
  }' \
  --output speech.mp3
```

```python showLineNumbers title="Simple TTS with OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="your-litellm-api-key"
)

response = client.audio.speech.create(
    model="elevenlabs-tts",
    input="Testing ElevenLabs speech via the LiteLLM proxy.",
    voice="alloy",
    response_format="mp3"
)

# Save audio
with open("speech.mp3", "wb") as f:
    f.write(response.content)
```

##### Advanced Usage (ElevenLabs-Specific Parameters)

**Note**: When using the proxy, provider-specific parameters (like `pronunciation_dictionary_locators`, `voice_settings`, etc.) must be passed in the `extra_body` field.

```bash showLineNumbers title="Advanced TTS request with curl"
curl http://localhost:4000/v1/audio/speech \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "elevenlabs-tts",
    "input": "Testing ElevenLabs speech via the LiteLLM proxy.",
    "voice": "alloy",
    "response_format": "pcm",
    "extra_body": {
      "pronunciation_dictionary_locators": [
          {"pronunciation_dictionary_id": "dict_123", "version_id": "v1"}
      ],
      "voice_settings": {
        "speed": 1.1,
        "stability": 0.5,
        "similarity_boost": 0.75
      }
    }
  }' \
  --output speech.mp3
```

```python showLineNumbers title="Advanced TTS with OpenAI SDK"
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000",
    api_key="your-litellm-api-key"
)

response = client.audio.speech.create(
    model="elevenlabs-tts",
    input="Testing ElevenLabs speech via the LiteLLM proxy.",
    voice="alloy",
    response_format="pcm",
    extra_body={
        "pronunciation_dictionary_locators": [
               {"pronunciation_dictionary_id": "dict_123", "version_id": "v1"}
        ],
        "voice_settings": {
            "speed": 1.1,
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }
)

# Save audio
with open("speech.mp3", "wb") as f:
    f.write(response.content)
```



