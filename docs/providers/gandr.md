# Gandr

Gandr is a spoken-audio inference provider. Its API is OpenAI-compatible: the same `voice`, `response_format` and `speed` fields, one base URL.

| Property | Details |
|----------|---------|
| Description | Neural text-to-speech with OpenAI-compatible APIs |
| Provider Route on LiteLLM | `gandr/` |
| Provider Doc | [Gandr API ↗](https://gandr.ai/docs) |
| Supported Endpoints | `/audio/speech` |

## Supported Models

| Model | Route | Description |
|-------|-------|-------------|
| Gandr (default) | `gandr/gandr` | `tts-1` compatible model alias |

## Quick Start

### 1. Set the API key

```bash showLineNumbers title="Set your Gandr API key"
export GANDR_API_KEY="gnd_..."
```

Get a key at [https://gandr.ai](https://gandr.ai).

Optionally, `GANDR_API_BASE` overrides the endpoint base URL (default `https://tts.gandr.ai/v1`). Most setups never set it.

### 2. LiteLLM Python SDK

```python showLineNumbers title="Text-to-speech with Gandr"
import litellm

audio = litellm.speech(
    model="gandr/gandr",        # OpenAI-compatible model alias
    input="Hello from Gandr.",  # Text to synthesize
    voice="alloy",               # OpenAI voice alias or a gandr-* voice id
    api_key="gnd_...",           # optional; defaults to GANDR_API_KEY
    response_format="wav",       # wav or pcm (24 kHz, 16-bit, mono)
    speed=1.0,                   # 0.6 to 1.5
)

# audio.read() returns raw audio bytes
with open("speech.wav", "wb") as f:
    f.write(audio.read())
```

### 3. OpenAI Python SDK through the LiteLLM proxy

```python showLineNumbers title="Proxied OpenAI-compatible TTS"
from openai import OpenAI

client = OpenAI(base_url="http://localhost:4000", api_key="sk-...")
response = client.audio.speech.create(
    model="gandr-tts",           # model alias configured in the proxy
    input="Hello from Gandr.",
    voice="alloy",
    response_format="wav",
    speed=1.0,
)
with open("speech.wav", "wb") as f:
    f.write(response.content)
```

## LiteLLM Proxy

### 1. Configure your proxy

```yaml showLineNumbers title="Gandr configuration in config.yaml"
model_list:
  - model_name: gandr-tts
    litellm_params:
      model: gandr/gandr
      api_key: os.environ/GANDR_API_KEY

general_settings:
  master_key: your-master-key
```

### 2. Make TTS requests

```bash showLineNumbers title="TTS request with curl"
curl http://localhost:4000/v1/audio/speech \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gandr-tts",
    "input": "Hello from Gandr.",
    "voice": "alloy",
    "response_format": "wav",
    "speed": 1.0
  }' \
  --output speech.wav
```

## Supported Parameters

| Param | Type | Description |
|-------|------|-------------|
| `voice` | str | OpenAI voice alias (`alloy`, `ash`, `onyx`, `coral`, `sage`, `shimmer`, `echo`, `verse`, `ballad`, `fable`, `nova`) or a `gandr-*` voice id. Default `alloy`. |
| `response_format` | str | `wav` (default, RIFF header) or `pcm` (headerless). Anything else returns an honest 400 naming the supported formats. |
| `speed` | float | Pitch-preserving rate from 0.6 to 1.5, applied after synthesis. Out-of-range values clamp server-side. |

## Voice Aliases

LiteLLM passes the OpenAI names through to Gandr, which maps them so an unmodified client always gets audio:

| OpenAI Voice | Gandr Voice |
|--------------|-------------|
| `alloy` (default) | mia |
| `ash`, `onyx` | dane |
| `ballad`, `fable` | lewis |
| `coral`, `sage`, `shimmer` | ava |
| `echo`, `verse` | leo |
| `nova` | jenny |

Own `gandr-*` voice ids pass through unchanged.

## Common Issues

1. **Invalid API key**: Set `GANDR_API_KEY` to a valid `gnd_` token, or pass `api_key` to `litellm.speech()` for a per-call key.
2. **Unsupported format**: Gandr serves `wav` and `pcm` only (24 kHz, 16-bit, mono). Return an honest 400 names the fix.