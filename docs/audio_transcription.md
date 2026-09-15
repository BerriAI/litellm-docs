import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# /audio/transcriptions

## Overview 

| Feature | Supported | Notes | 
|-------|-------|-------|
| Cost Tracking | ✅ | Works with all supported models |
| Logging | ✅ | Works across all integrations |
| End-user Tracking | ✅ | |
| Fallbacks | ✅ | Works between supported models |
| Loadbalancing | ✅ | Works between supported models |
| Guardrails | ✅ | Applies to output transcribed text (non-streaming only) |
| Supported Providers | `openai`, `azure`, `vertex_ai`, `gemini`, `deepgram`, `groq`, `fireworks_ai`, `ovhcloud`, `mistral`, `custom_openai` | |

## Quick Start

### LiteLLM Python SDK

```python showLineNumbers title="Python SDK Example"
from litellm import transcription
import os 

# set api keys 
os.environ["OPENAI_API_KEY"] = ""
audio_file = open("/path/to/audio.mp3", "rb")

response = transcription(model="whisper", file=audio_file)

print(f"response: {response}")
```

### LiteLLM Proxy

### Add model to config 


<Tabs>
<TabItem value="openai" label="OpenAI">

```yaml showLineNumbers title="OpenAI Configuration"
model_list:
- model_name: whisper
  litellm_params:
    model: whisper-1
    api_key: os.environ/OPENAI_API_KEY
  model_info:
    mode: audio_transcription
    
general_settings:
  master_key: sk-1234
```
</TabItem>
<TabItem value="openai+azure" label="OpenAI + Azure">

```yaml showLineNumbers title="OpenAI + Azure Configuration"
model_list:
- model_name: whisper
  litellm_params:
    model: whisper-1
    api_key: os.environ/OPENAI_API_KEY
  model_info:
    mode: audio_transcription
- model_name: whisper
  litellm_params:
    model: azure/azure-whisper
    api_version: 2024-02-15-preview
    api_base: os.environ/AZURE_EUROPE_API_BASE
    api_key: os.environ/AZURE_EUROPE_API_KEY
  model_info:
    mode: audio_transcription

general_settings:
  master_key: sk-1234
```

</TabItem>
</Tabs>

### Start proxy 

```bash showLineNumbers title="Start Proxy Server"
litellm --config /path/to/config.yaml 

# RUNNING on http://0.0.0.0:4000
```

### Test 

<Tabs>
<TabItem value="curl" label="Curl">

```bash showLineNumbers title="Test with cURL"
curl --location 'http://0.0.0.0:4000/v1/audio/transcriptions' \
--header 'Authorization: Bearer sk-1234' \
--form 'file=@"/Users/krrishdholakia/Downloads/gettysburg.wav"' \
--form 'model="whisper"'
```

</TabItem>
<TabItem value="openai" label="OpenAI Python SDK">

```python showLineNumbers title="Test with OpenAI Python SDK"
from openai import OpenAI
client = openai.OpenAI(
    api_key="sk-1234",
    base_url="http://0.0.0.0:4000"
)


audio_file = open("speech.mp3", "rb")
transcript = client.audio.transcriptions.create(
  model="whisper",
  file=audio_file
)
```
</TabItem>
</Tabs>

## Self-hosted OpenAI-compatible ASR

Use `custom_openai` when you want LiteLLM Proxy to expose a self-hosted
OpenAI-compatible speech-to-text server. For example, FunASR's `funasr-server`
can serve SenseVoice or Fun-ASR models behind LiteLLM without adding a new
LiteLLM provider.

### Start FunASR

Install FunASR and the web server dependencies on the ASR host:

```bash showLineNumbers title="Install FunASR"
python -m pip install -U "funasr>=1.3.26" fastapi uvicorn python-multipart
```

Start a SenseVoice server:

```bash showLineNumbers title="Start FunASR Server"
funasr-server --model sensevoice --device cuda --port 8000
```

Use `--device cpu` for a CPU-only smoke test. The server exposes an
OpenAI-compatible endpoint at:

```text
http://localhost:8000/v1/audio/transcriptions
```

### Configure LiteLLM Proxy

Set `api_base` to the OpenAI-compatible base URL, not the full
`/audio/transcriptions` path.

```yaml showLineNumbers title="FunASR Proxy Configuration"
model_list:
- model_name: funasr-sensevoice
  litellm_params:
    model: custom_openai/FunAudioLLM/SenseVoiceSmall
    api_base: http://localhost:8000/v1
    api_key: dummy-key
  model_info:
    mode: audio_transcription

general_settings:
  master_key: sk-1234
```

Start LiteLLM Proxy:

```bash showLineNumbers title="Start Proxy Server"
litellm --config /path/to/config.yaml
```

Then call LiteLLM's OpenAI-compatible transcription endpoint:

```bash showLineNumbers title="Test FunASR through LiteLLM"
curl --location 'http://0.0.0.0:4000/v1/audio/transcriptions' \
--header 'Authorization: Bearer sk-1234' \
--form 'file=@"sample.wav"' \
--form 'model="funasr-sensevoice"'
```

If you deploy Fun-ASR-Nano or another FunASR-compatible model, set the
`custom_openai/<model-id>` suffix to the exact model id accepted by your
FunASR server.

## Supported Providers

- OpenAI
- Azure
- [Fireworks AI](./providers/fireworks_ai.md#audio-transcription)
- [Groq](./providers/groq.md#speech-to-text---whisper)
- [Deepgram](./providers/deepgram.md)
- [Google AI Studio (Gemini)](./providers/gemini.md#audio-transcription-speech-to-text)
- [Mistral (Voxtral)](./providers/mistral.md#audio-transcription)
- [OVHcloud AI Endpoints](./providers/ovhcloud.md)
- Self-hosted OpenAI-compatible servers via `custom_openai`, such as FunASR or SenseVoice

---

## Fallbacks

You can configure fallbacks for audio transcription to automatically retry with different models if the primary model fails.

<Tabs>
<TabItem value="curl" label="Curl">

```bash showLineNumbers title="Test with cURL and Fallbacks"
curl --location 'http://0.0.0.0:4000/v1/audio/transcriptions' \
--header 'Authorization: Bearer sk-1234' \
--form 'file=@"gettysburg.wav"' \
--form 'model="groq/whisper-large-v3"' \
--form 'fallbacks[]="openai/whisper-1"'
```

</TabItem>
<TabItem value="openai" label="OpenAI Python SDK">

```python showLineNumbers title="Test with OpenAI Python SDK and Fallbacks"
from openai import OpenAI
client = OpenAI(
    api_key="sk-1234",
    base_url="http://0.0.0.0:4000"
)

audio_file = open("gettysburg.wav", "rb")
transcript = client.audio.transcriptions.create(
    model="groq/whisper-large-v3",
    file=audio_file,
    extra_body={
        "fallbacks": ["openai/whisper-1"]
    }
)
```
</TabItem>
</Tabs>

### Testing Fallbacks

:::warning Deprecated for Proxy requests
Starting in LiteLLM Proxy v1.85.0, `mock_testing_fallbacks` is stripped from incoming Proxy requests and has no effect. It remains supported only for direct `litellm.Router` calls in tests.
:::

To validate audio transcription fallbacks through the Proxy, trigger an actual provider error in a non-production environment and send a normal request with the fallback configuration.
