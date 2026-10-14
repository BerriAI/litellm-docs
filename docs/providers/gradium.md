# Gradium Text to Speech (tts)

## Overview

| Property | Details |
|-------|-------|
| Description | Convert text to natural-sounding speech using Gradium's voice AI models |
| Provider Route on LiteLLM | `gradium/` |
| Supported Operations | `/audio/speech` |
| Link to Provider Doc | [Gradium TTS ↗](https://docs.gradium.ai/api-reference/endpoint/tts-post) |

## Quick Start

### **LiteLLM SDK**

```python showLineNumbers title="SDK Usage"
import litellm
from pathlib import Path
import os

os.environ["GRADIUM_API_KEY"] = "gd_..."

speech_file_path = Path(__file__).parent / "speech.wav"
response = litellm.speech(
    model="gradium/default",
    voice="alloy",
    input="the quick brown fox jumped over the lazy dogs",
    response_format="wav",
)
response.write_to_file(speech_file_path)
```

### **LiteLLM PROXY**

```yaml showLineNumbers title="proxy_config.yaml"
model_list:
  - model_name: gradium-tts
    litellm_params:
      model: gradium/default
      api_key: os.environ/GRADIUM_API_KEY
```

```bash showLineNumbers title="curl"
curl http://0.0.0.0:4000/v1/audio/speech \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gradium-tts",
    "input": "the quick brown fox jumped over the lazy dogs",
    "voice": "alloy",
    "response_format": "wav"
  }' \
  --output speech.wav
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GRADIUM_API_KEY` | Yes | Your Gradium API key. Sent upstream as the `x-api-key` header. |
| `GRADIUM_API_BASE` | No | Override the API base. Defaults to `https://api.gradium.ai`. Set this to pin a data-residency region (see below) or to reach a self-hosted deployment. |

## Voices

The six canonical OpenAI voice names map to Gradium library voices, so existing OpenAI clients work without code changes:

| OpenAI voice | Gradium voice ID |
|--------------|------------------|
| `alloy` | `YTpq7expH9539ERJ` |
| `echo` | `s0PhgjzOTRD5wo5L` |
| `fable` | `1VAVLmmbQFDw7TMn` |
| `onyx` | `QkmUhBH4hIV2_BkY` |
| `nova` | `w9V1722uEmTkWqnR` |
| `shimmer` | `BbLb4TxdlrldgpHI` |

Any other value is forwarded verbatim, so you can pass a raw Gradium voice ID — including a custom or cloned voice — directly:

```python showLineNumbers title="Using a raw Gradium voice ID"
response = litellm.speech(
    model="gradium/default",
    voice="m86j6D7UZpGzHsNu",
    input="Hello world",
)
```

## Response Formats

Gradium serves WAV, raw PCM and Ogg-wrapped Opus:

| OpenAI `response_format` | Gradium `output_format` |
|--------------------------|-------------------------|
| `wav` (default) | `wav` |
| `pcm` | `pcm_24000` |
| `opus` | `opus` |

Gradium has no mp3, aac or flac encoder. Requesting one of those raises `UnsupportedParamsError` rather than returning audio with a misleading format; set `litellm.drop_params = True` to fall back to the default format instead.

## Models

| Model | Description | Cost (per 1M chars) |
|-------|-------------|---------------------|
| `gradium/default` | Default Gradium TTS model | $69.00 |
| `gradium/pro-voice-clone` | TTS using a Pro Voice Clone voice (1.2 credits/char) | $82.80 |

Gradium bills **per character of input text** (1 credit per character), not per second of generated audio. The costs above are derived from the published add-on credit rate on the XS plan; larger plans are cheaper, so override `input_cost_per_character` to match your own plan:

```yaml showLineNumbers title="proxy_config.yaml"
model_list:
  - model_name: gradium-tts
    litellm_params:
      model: gradium/default
      api_key: os.environ/GRADIUM_API_KEY
    model_info:
      input_cost_per_character: 0.0000380  # L plan
```

## Unsupported Parameters

`speed` and `instructions` are OpenAI-only; Gradium's REST endpoint has no equivalent, so they are accepted and dropped rather than erroring.

## Data Residency

The default base, `https://api.gradium.ai`, routes to the nearest cluster and makes no residency commitment. Point `GRADIUM_API_BASE` at a regional endpoint when you need one:

| Region | API base |
|--------|----------|
| EU | `https://eu.api.gradium.ai` |
| US | `https://us.api.gradium.ai` |

```python showLineNumbers title="Pinning to the EU endpoint"
os.environ["GRADIUM_API_BASE"] = "https://eu.api.gradium.ai"
```

The trailing `/api` that Gradium's own docs show on these hosts is optional here — `https://eu.api.gradium.ai` and `https://eu.api.gradium.ai/api` both resolve to the same endpoint.
