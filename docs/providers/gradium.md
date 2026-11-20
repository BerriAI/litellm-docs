---
title: "Gradium Text-to-Speech API with LiteLLM"
sidebar_label: "Gradium"
description: "Generate speech with Gradium from the Python SDK or AI Gateway on /v1/audio/speech, with OpenAI voice mapping, regional endpoints and per-character cost tracking."
---

# Gradium

<SinceVersion v="1.112.0" />

Gradium is a voice AI provider. LiteLLM calls Gradium's text-to-speech API through the OpenAI-compatible `/audio/speech` endpoint, so existing OpenAI clients work without code changes.

| Property | Details |
|----------|---------|
| Description | Convert text to natural-sounding speech using Gradium's voice AI models. |
| Provider Route on LiteLLM | `gradium/` |
| Provider Doc | [Gradium TTS ↗](https://docs.gradium.ai/api-reference/endpoint/tts-post) |
| Supported Endpoints | `/audio/speech` |

## Models

Use `gradium/default` for Gradium's default model, or `gradium/gradium-tts-beta` for the beta model. Any other name after `gradium/` is forwarded to Gradium as its `model_name`. The cost map has prices for `gradium/default` and `gradium/gradium-tts-beta`.

## Credentials and regions

LiteLLM reads no Gradium environment variable and has no default region. Every deployment or call must set both `api_key` and `api_base`. The key is sent upstream as the `x-api-key` header.

| API base | Region |
|----------|--------|
| `https://api.gradium.ai` | Closest region |
| `https://eu.api.gradium.ai` | EU |
| `https://us.api.gradium.ai` | US |

The trailing `/api` that Gradium's own docs show on these hosts is optional here, so `https://eu.api.gradium.ai` and `https://eu.api.gradium.ai/api` reach the same endpoint. When you add a Gradium model with the Add Model form in the LiteLLM UI, the API Base field is a dropdown with these three bases.

## Quick Start

### LiteLLM Python SDK

```python showLineNumbers title="Generate speech with the SDK"
import os
from pathlib import Path

import litellm

response = litellm.speech(
    model="gradium/default",
    input="the quick brown fox jumped over the lazy dogs",
    voice="alloy",
    response_format="wav",
    api_key=os.environ["GRADIUM_API_KEY"],
    api_base="https://eu.api.gradium.ai",
)
response.write_to_file(Path("speech.wav"))
```

`litellm.aspeech` takes the same arguments for async code.

### LiteLLM Proxy

#### 1. Configure your proxy

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gradium-tts
    litellm_params:
      model: gradium/default
      api_key: os.environ/GRADIUM_API_KEY
      api_base: https://eu.api.gradium.ai

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

`os.environ/GRADIUM_API_KEY` tells the proxy to read the key from that variable when it loads the config. You can pick any variable name.

#### 2. Start the proxy

```bash showLineNumbers title="Start LiteLLM proxy server"
export GRADIUM_API_KEY="your-gradium-api-key"
export LITELLM_MASTER_KEY="sk-your-master-key"
litellm --config config.yaml
```

#### 3. Generate speech

```bash showLineNumbers title="curl"
curl http://localhost:4000/v1/audio/speech \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gradium-tts",
    "input": "the quick brown fox jumped over the lazy dogs",
    "voice": "alloy",
    "response_format": "wav"
  }' \
  --output speech.wav
```

## Streaming

Set `stream: true` in the request body, or `stream=True` in the SDK, to forward audio to the client as Gradium sends it. Without it, LiteLLM buffers the whole clip and returns it in one response.

## Voices

The OpenAI voice names `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse`, `marin` and `cedar` map to English voices in Gradium's catalog, picked to match the OpenAI voice's gender. Any other value is sent to Gradium as a raw voice ID, so you can pass the ID of any Gradium voice, including a voice in another language or a custom or cloned one, as `voice`. For French text, pick a French voice from Gradium's voice library and pass its ID. A request without a voice answers 400.

## Response formats

| `response_format` | Gradium `output_format` |
|-------------------|-------------------------|
| `wav` (default) | `wav` |
| `pcm` | `pcm_24000` (24 kHz) |
| `opus` | `opus` |

Gradium's own format names are also accepted and sent as is. These are `ulaw_8000`, `mulaw_8000`, `alaw_8000`, `pcm_8000`, `pcm_16000`, `pcm_22050`, `pcm_24000`, `pcm_44100` and `pcm_48000`.

## Unsupported parameters

Gradium has no mp3, aac or flac encoder, so those formats answer 400 instead of returning audio with a misleading format. `instructions`, and any `speed` other than OpenAI's default of `1.0`, have no equivalent on Gradium's endpoint, so they answer 400 as well. To change the speaking pace, use Gradium's own `padding_bonus` setting, described below.

Set [`drop_params`](../completion/drop_params.md) to drop these instead. A dropped format falls back to wav. You can set it on the call (`drop_params=True` in the SDK, or `"drop_params": true` in the request body), on the deployment (`drop_params: true` under `litellm_params`), or for every model (`litellm.drop_params = True`, or `drop_params: true` under `litellm_settings` in the proxy config).

## Gradium settings

Send Gradium's `json_config` in the request body and LiteLLM forwards it to Gradium unchanged. For example, `padding_bonus` sets the pace. A negative value speaks faster and a positive value speaks slower, as described in [Gradium's voice settings](https://docs.gradium.ai/guides/voice-settings).

```bash showLineNumbers title="Speak faster"
curl http://localhost:4000/v1/audio/speech \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gradium-tts",
    "input": "the quick brown fox jumped over the lazy dogs",
    "voice": "alloy",
    "response_format": "wav",
    "json_config": {"padding_bonus": -2.0}
  }' \
  --output speech.wav
```

In the SDK, pass `json_config={"padding_bonus": -2.0}` to `litellm.speech`. With the OpenAI client, pass it in `extra_body`.

## Cost tracking

Gradium bills 1 credit per input character, spaces included, and LiteLLM bills the same character count. The cost map prices `gradium/default` and `gradium/gradium-tts-beta` at the add-on credit rate of the XS plan, $7 per 100k credits, which is $0.00007 per character.

Larger plans are cheaper per credit, and Pro Voice Clone voices bill 1.2 credits per character. For either case, set `input_cost_per_character` on the deployment with [custom pricing](../proxy/custom_pricing.md). Gradium's response does not say which kind of voice it used, so LiteLLM bills a clone voice at the deployment's price. Send clone voices to their own deployment. For example, a Pro Voice Clone voice at the XS rate costs 1.2 × $0.00007 = $0.000084 per character:

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: gradium-tts-clone
    litellm_params:
      model: gradium/default
      api_key: os.environ/GRADIUM_API_KEY
      api_base: https://us.api.gradium.ai
    model_info:
      input_cost_per_character: 0.000084
```
