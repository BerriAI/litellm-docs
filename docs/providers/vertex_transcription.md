import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Vertex AI Audio Transcription

| Property | Details |
|-------|-------|
| Description | Gemini speech-to-text on Vertex AI via the OpenAI `/v1/audio/transcriptions` endpoint |
| Provider Route on LiteLLM | `vertex_ai/gemini-3.5-transcribe-preview` |
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
  -H "Authorization: Bearer sk-1234" \
  -F file=@speech.wav \
  -F model=gemini-transcribe \
  -F language=en
```

</TabItem>
<TabItem value="openai-sdk" label="OpenAI Python SDK">

```python showLineNumbers title="Gemini Transcribe Quick Start"
import openai

client = openai.OpenAI(api_key="sk-1234", base_url="http://0.0.0.0:4000")

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
