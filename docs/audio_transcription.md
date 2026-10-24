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
| Supported Providers | `openai`, `azure`, `vertex_ai`, `gemini`, `deepgram`, `groq`, `fireworks_ai`, `ovhcloud`, `mistral` | |

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
  master_key: os.environ/LITELLM_MASTER_KEY
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
  master_key: os.environ/LITELLM_MASTER_KEY
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
--header "Authorization: Bearer $LITELLM_API_KEY" \
--form 'file=@"/Users/krrishdholakia/Downloads/gettysburg.wav"' \
--form 'model="whisper"'
```

</TabItem>
<TabItem value="openai" label="OpenAI Python SDK">

```python showLineNumbers title="Test with OpenAI Python SDK"
from openai import OpenAI
client = openai.OpenAI(
    api_key="sk-<your-litellm-api-key>",
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

Use the `openai` provider with a custom `api_base` to route audio transcription
to a self-hosted OpenAI-compatible server. Requests go to the configured ASR
endpoint. For example, FunASR's `funasr-server` can serve SenseVoice behind
LiteLLM without adding a new provider.

### Start FunASR

On the ASR host, prepare an isolated Python environment with PyTorch and a
matching `torchaudio` build for your platform using the
[FunASR installation guide](https://github.com/modelscope/FunASR/blob/main/docs/installation/installation.md).
Then install FunASR and the web server dependencies:

```bash showLineNumbers title="Install FunASR"
python -m pip install -U "funasr>=1.3.26" fastapi uvicorn python-multipart
```

Start a local SenseVoice server:

```bash showLineNumbers title="Start FunASR Server"
funasr-server --host 127.0.0.1 --model sensevoice --device cpu --port 8000
```

Startup can download model weights; wait for model loading to finish before
sending a request. Use `--device cuda` only after preparing a compatible GPU
environment. The server exposes an OpenAI-compatible endpoint at:

```text
http://127.0.0.1:8000/v1/audio/transcriptions
```

### Configure LiteLLM Proxy

Set `api_base` to the OpenAI-compatible base URL, not the full
`/audio/transcriptions` path. Use the service's `sensevoice` alias as the model
suffix; the packaged server does not accept an arbitrary checkpoint repository
ID as a request model.

This example runs both processes on the same host. Inside a container,
`127.0.0.1` refers to that container; use an authorized reachable service address
for a remote backend. FunASR does not authenticate the placeholder `dummy-key`.
Keep its port private; LiteLLM's master key protects the Proxy endpoint, not
direct access to FunASR. Review the
[FunASR security guide](https://github.com/modelscope/FunASR/blob/main/examples/openai_api/SECURITY.md)
before exposing the backend to a network.

```yaml showLineNumbers title="FunASR Proxy Configuration"
model_list:
- model_name: funasr-sensevoice
  litellm_params:
    model: openai/sensevoice
    api_base: http://127.0.0.1:8000/v1
    api_key: dummy-key
  model_info:
    mode: audio_transcription

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

From your LiteLLM Proxy environment, generate a key for this new local instance
and start the Proxy. For an existing deployment, use its configured key rather
than replacing it; see [master-key rotation](./proxy/master_key_rotations.md).

```bash showLineNumbers title="Start FunASR Proxy"
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
litellm --config /path/to/config.yaml --host 127.0.0.1 --port 4000
```

In a client terminal, set `LITELLM_MASTER_KEY` to the same value used by this
Proxy, then call its OpenAI-compatible transcription endpoint. Do not generate
a second key for the client. Use a real local audio file in place of `sample.wav`.

```bash showLineNumbers title="Test FunASR through LiteLLM"
curl --location 'http://127.0.0.1:4000/v1/audio/transcriptions' \
--header "Authorization: Bearer $LITELLM_MASTER_KEY" \
--form 'file=@"sample.wav"' \
--form 'model="funasr-sensevoice"'
```

For other models, use a service alias returned by your deployed `/v1/models`.
A packaged server started with `--model-path` accepts the request alias
`custom`, so configure that backend as `openai/custom`. Model-specific
dependencies and hardware requirements still apply.

## Supported Providers

- OpenAI
- Azure
- [Fireworks AI](./providers/fireworks_ai.md#audio-transcription)
- [Groq](./providers/groq.md#speech-to-text---whisper)
- [Deepgram](./providers/deepgram.md)
- [Google AI Studio (Gemini)](./providers/gemini.md#audio-transcription-speech-to-text)
- [Mistral (Voxtral)](./providers/mistral.md#audio-transcription)
- [OVHcloud AI Endpoints](./providers/ovhcloud.md)
- Self-hosted OpenAI-compatible servers via `openai` with a custom `api_base`, such as FunASR or SenseVoice

---

## Fallbacks

You can configure fallbacks for audio transcription to automatically retry with different models if the primary model fails.

<Tabs>
<TabItem value="curl" label="Curl">

```bash showLineNumbers title="Test with cURL and Fallbacks"
curl --location 'http://0.0.0.0:4000/v1/audio/transcriptions' \
--header "Authorization: Bearer $LITELLM_API_KEY" \
--form 'file=@"gettysburg.wav"' \
--form 'model="groq/whisper-large-v3"' \
--form 'fallbacks[]="openai/whisper-1"'
```

</TabItem>
<TabItem value="openai" label="OpenAI Python SDK">

```python showLineNumbers title="Test with OpenAI Python SDK and Fallbacks"
from openai import OpenAI
client = OpenAI(
    api_key="sk-<your-litellm-api-key>",
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

:::warning[Deprecated for Proxy requests]
Starting in LiteLLM Proxy v1.85.0, `mock_testing_fallbacks` is stripped from incoming Proxy requests and has no effect. It remains supported only for direct `litellm.Router` calls in tests.
:::

To validate audio transcription fallbacks through the Proxy, trigger an actual provider error in a non-production environment and send a normal request with the fallback configuration.
