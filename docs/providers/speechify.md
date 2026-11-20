# Speechify Text to Speech (tts)

## Overview

| Property | Details |
|-------|-------|
| Description | Text to speech with the Speechify Simba models, including your own cloned voices |
| Provider Route on LiteLLM | `speechify/` |
| Supported Operations | `/audio/speech` |
| Link to Provider Doc | [Speechify Create Speech ↗](https://docs.speechify.ai/build/api-reference/v1/audio/speech?utm_source=github&utm_medium=docs&utm_campaign=litellm) |

## Quick Start

Get an API key from the [Speechify console](https://platform.speechify.ai/signup?utm_source=github&utm_medium=docs&utm_campaign=litellm) and set it as `SPEECHIFY_API_KEY`.

### **LiteLLM SDK**

```python showLineNumbers title="SDK Usage"
import os
from pathlib import Path

import litellm

os.environ["SPEECHIFY_API_KEY"] = ""

response = litellm.speech(
    model="speechify/simba-3.5",
    voice="geffen_32",
    input="the quick brown fox jumped over the lazy dogs",
)
response.stream_to_file(Path(__file__).parent / "speech.mp3")
```

### **LiteLLM PROXY**

```yaml showLineNumbers title="proxy_config.yaml"
model_list:
  - model_name: simba-3.5
    litellm_params:
      model: speechify/simba-3.5
      api_key: os.environ/SPEECHIFY_API_KEY
```

```bash showLineNumbers title="Request"
curl http://0.0.0.0:4000/v1/audio/speech \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "simba-3.5",
    "input": "the quick brown fox jumped over the lazy dogs",
    "voice": "geffen_32"
  }' \
  --output speech.mp3
```

## Models

| Model | Languages |
|-------|-----------|
| `speechify/simba-3.5` | 48 languages, English included, and every voice. The recommended model, and the first with pronunciation support |
| `speechify/simba-3.2` | English only |
| `speechify/simba-3.0` | English, German, Spanish, French, Italian and Portuguese |

Call `GET https://api.speechify.ai/v1/audio/models` to see the models your workspace can use.

## Voices

Pass any Speechify voice id as `voice`, for example `geffen_32`, `george` or `carly`. Cloned voices from your workspace work the same way. List the voices your key can use with `GET https://api.speechify.ai/v1/voices`. OpenAI voice names like `alloy` are not Speechify voices, so a request that sends one gets a 404 back from Speechify.

## Supported Parameters

| Parameter | Maps to | Notes |
|-----------|---------|-------|
| `voice` | `voice_id` | Required |
| `response_format` | `audio_format` | `mp3` (default), `wav`, `pcm`, `aac`, and `opus` (sent as `ogg`). `flac` is not supported |
| `language` | `language` | Optional, for example `fr-FR` with `simba-3.5`. Set it when the text is not in the voice's own language |
| `output_format` | `output_format` | Optional, sets the sample rate and bitrate, for example `mp3_24000_128` or `ulaw_8000`. Overrides `response_format` |

`speed` and `instructions` are not sent. Use [SSML](https://docs.speechify.ai/build/guides/text-to-speech/ssml?utm_source=github&utm_medium=docs&utm_campaign=litellm) in `input` to control rate, pitch and emotion.

```python showLineNumbers title="French with simba-3.5"
import litellm

response = litellm.speech(
    model="speechify/simba-3.5",
    voice="geffen_32",
    input="Bonjour, comment allez-vous ?",
    language="fr-FR",
    response_format="wav",
)
```

## Cost Tracking

Spend is tracked per input character, using the Starter plan rates from [speechify.ai/pricing](https://speechify.ai/pricing?utm_source=github&utm_medium=docs&utm_campaign=litellm). `simba-3.5` is $20 per 1M characters on Starter ($16 on Pro and $12 on Scale). `simba-3.2` and `simba-3.0` are $10, $8 and $6 per 1M characters on Starter, Pro and Scale. If you are on a plan with a lower rate, override the cost map with [custom pricing](../proxy/custom_pricing).

## Limits

The speech endpoint takes up to 2,000 characters of `input` per request. See [Speechify API limits](https://docs.speechify.ai/build/guides/concepts/api-limits?utm_source=github&utm_medium=docs&utm_campaign=litellm) for rate and concurrency limits by plan.
