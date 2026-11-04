# Paxa

## Overview

| Property | Details |
|-------|-------|
| Description | Text to speech in Thai, English and Mandarin, through Paxa's OpenAI compatible speech endpoint |
| Provider Route on LiteLLM | `paxa/` |
| Supported Operations | `/audio/speech` |
| Link to Provider Doc | [Paxa text to speech](https://paxalabs.com/docs/text-to-speech) |

## Quick Start

Create an API key at [paxalabs.com/app/keys](https://paxalabs.com/app/keys) and set it as `PAXA_API_KEY`. `PAXA_API_BASE` overrides the base URL, which defaults to `https://api.paxalabs.com/v1`.

### **LiteLLM SDK**

```python showLineNumbers title="SDK Usage"
import os

import litellm

os.environ["PAXA_API_KEY"] = ""

response = litellm.speech(
    model="paxa/paxa-tts-flash-v2",
    voice="foithong",
    input="สวัสดีครับ ยินดีต้อนรับ",
)
response.stream_to_file("speech.mp3")
```

### **LiteLLM PROXY**

```yaml showLineNumbers title="proxy_config.yaml"
model_list:
  - model_name: paxa-tts
    litellm_params:
      model: paxa/paxa-tts-flash-v2
      api_key: os.environ/PAXA_API_KEY
```

```bash showLineNumbers title="Request"
curl http://0.0.0.0:4000/v1/audio/speech \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "paxa-tts", "input": "Hello from Paxa", "voice": "foithong"}' \
  --output speech.mp3
```

## Voices and formats

`voice` takes any voice id from [paxalabs.com/voices](https://paxalabs.com/voices). `response_format` takes `mp3` (the default), `opus`, `wav` or `pcm` (raw 16-bit mono at 24 kHz), and `speed` runs from 0.5 to 1.5.
